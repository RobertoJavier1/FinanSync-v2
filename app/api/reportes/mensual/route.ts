// Job del estado de cuenta mensual.
//
// Lo llama Cloud Scheduler el día 1 de cada mes. No lo puede llamar un usuario
// cualquiera: se exige o bien el token OIDC que Cloud Scheduler firma con su
// cuenta de servicio, o bien un token compartido para poder probarlo a mano.
//
// Recorre los usuarios que tienen el reporte activado, arma el PDF de cada uno
// y se lo manda por correo. Un fallo en un usuario no detiene a los demás.
//
// Variables de entorno:
//   REPORTE_CRON_TOKEN     -> token compartido para disparar el job a mano
//   REPORTE_SERVICE_ACCOUNT-> cuenta de servicio con la que firma Cloud Scheduler.
//                             Es obligatoria para aceptar un token OIDC: sin ella
//                             se rechaza, porque si no cualquier token de Google
//                             con firma válida serviría para disparar el envío.
import { NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import {
  usuariosDelReporte, estadoCuentaDe, generarPdf, mesAnterior, nombreDelMes,
} from '@/lib/estado-cuenta'
import { enviarCorreo, htmlEstadoCuenta } from '@/lib/correo'

// el job puede tardar: son varias llamadas a la base y un PDF por usuario
export const maxDuration = 300

function monto(valor: number, moneda: string): string {
  return `${valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

/**
 * Escribe una línea de registro en JSON. El campo severity es el que lee Cloud
 * Logging para clasificar la entrada; sin él todo entra como INFO y las alertas
 * por severidad no ven nada.
 */
function registrar(severity: 'INFO' | 'ERROR', datos: Record<string, unknown>): void {
  const linea = JSON.stringify({ severity, ...datos })
  if (severity === 'ERROR') console.error(linea)
  else console.log(linea)
}

type Permiso = { ok: true } | { ok: false; motivo: string; detalle?: string }

/**
 * Autoriza la llamada. Dos caminos:
 *  1. token OIDC de Google, que es el que manda Cloud Scheduler. Se verifica la
 *     firma y que venga de REPORTE_SERVICE_ACCOUNT. Si esa variable no está
 *     configurada se rechaza: verificar solo la firma dejaría pasar el token de
 *     cualquier cuenta de Google.
 *  2. token compartido en la cabecera x-cron-token, para pruebas manuales.
 *
 * Quien rechaza no escribe el registro: devuelve el motivo y lo escribe POST,
 * en un solo lugar, para que ninguna vía se quede sin dejar rastro.
 */
async function autorizado(req: Request): Promise<Permiso> {
  const tokenCompartido = process.env.REPORTE_CRON_TOKEN
  const cabecera = req.headers.get('x-cron-token')
  if (cabecera) {
    if (tokenCompartido && cabecera === tokenCompartido) return { ok: true }
    return { ok: false, motivo: 'token compartido incorrecto' }
  }

  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false, motivo: 'sin credenciales' }
  }

  const esperada = process.env.REPORTE_SERVICE_ACCOUNT
  if (!esperada) {
    return { ok: false, motivo: 'falta configurar REPORTE_SERVICE_ACCOUNT' }
  }

  try {
    const cliente = new OAuth2Client()
    const ticket = await cliente.verifyIdToken({ idToken: authorization.slice(7) })
    const payload = ticket.getPayload()
    if (!payload) return { ok: false, motivo: 'token sin contenido' }

    if (payload.email !== esperada) {
      return { ok: false, motivo: 'cuenta distinta', detalle: payload.email }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, motivo: 'token invalido', detalle: String(error) }
  }
}

export async function POST(req: Request) {
  const permiso = await autorizado(req)
  if (!permiso.ok) {
    registrar('ERROR', {
      evento: 'reporte_mensual_rechazado',
      motivo: permiso.motivo,
      detalle: permiso.detalle,
    })
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // por defecto reporta el mes que acaba de cerrar; se puede pedir otro para probar
  const url = new URL(req.url)
  const porDefecto = mesAnterior()
  const anio = Number(url.searchParams.get('anio')) || porDefecto.anio
  const mes = Number(url.searchParams.get('mes')) || porDefecto.mes

  const inicio = Date.now()
  let enviados = 0
  let sinMovimientos = 0
  let omitidos = 0
  let fallidos = 0

  try {
    const usuarios = await usuariosDelReporte()
    registrar('INFO', { evento: 'reporte_mensual_inicio', anio, mes, usuarios: usuarios.length })

    for (const usuario of usuarios) {
      try {
        const datos = await estadoCuentaDe(usuario.idUsuario, anio, mes)

        // sin movimientos no hay nada que reportar; mandar un PDF vacío solo molesta
        if (datos.movimientos === 0) {
          sinMovimientos++
          continue
        }

        const pdf = generarPdf(usuario, datos)
        const mesTexto = nombreDelMes(mes)

        const resultado = await enviarCorreo({
          para: usuario.email,
          asunto: `Tu estado de cuenta de ${mesTexto} ${anio}`,
          html: htmlEstadoCuenta({
            nombre: usuario.nombre,
            mes: mesTexto,
            anio,
            ingresos: monto(datos.ingresos, usuario.moneda),
            gastos: monto(datos.gastos, usuario.moneda),
            balance: monto(datos.balance, usuario.moneda),
          }),
          adjuntos: [{ nombre: `estado-de-cuenta-${anio}-${String(mes).padStart(2, '0')}.pdf`, contenido: pdf }],
        })

        if (resultado.estado === 'enviado') enviados++
        else omitidos++
      } catch (error) {
        // un usuario que falle no debe tumbar el resto del envío
        fallidos++
        registrar('ERROR', {
          evento: 'reporte_mensual_error_usuario',
          usuario: usuario.idUsuario,
          error: String(error),
        })
      }
    }

    // se separan a proposito: "sin movimientos" es el caso normal de un usuario
    // que no registro nada ese mes, "omitidos" significa que habia que mandarle
    // el correo y no se mando (por ejemplo, sin proveedor configurado)
    const resumen = {
      evento: 'reporte_mensual_fin',
      anio, mes, enviados, sinMovimientos, omitidos, fallidos,
      ms: Date.now() - inicio,
    }
    registrar('INFO', resumen)

    // si fallaron todos hay un problema real: se devuelve 500 para que la alerta
    // de Cloud Monitoring lo note y Cloud Scheduler marque el intento como fallido
    const todosFallaron = fallidos > 0 && enviados === 0 && omitidos === 0 && sinMovimientos === 0
    return NextResponse.json(resumen, { status: todosFallaron ? 500 : 200 })
  } catch (error) {
    registrar('ERROR', { evento: 'reporte_mensual_error', error: String(error) })
    return NextResponse.json({ error: 'Error al generar los estados de cuenta' }, { status: 500 })
  }
}
