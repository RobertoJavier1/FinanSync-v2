// Envío de correo.
//
// Google Cloud no tiene un servicio propio de correo transaccional y Cloud Run
// bloquea los puertos SMTP salientes, así que el envío sale por un proveedor
// externo con API HTTP. El resto del sistema no sabe cuál es: este módulo es la
// única parte que habría que tocar para cambiarlo.
//
// Si no hay llave configurada no falla: registra en el log lo que habría
// mandado y sigue. Así el job se puede probar de punta a punta antes de
// contratar el proveedor, y una falla de correo nunca tumba el proceso.
//
// Variables de entorno:
//   RESEND_API_KEY   -> llave del proveedor. sin ella, modo registro
//   CORREO_REMITENTE -> ej. "FinanSync <reportes@finansync.me>"

export interface Adjunto {
  nombre: string
  contenido: Buffer
}

export interface CorreoEnviado {
  estado: 'enviado' | 'omitido'
  detalle?: string
}

const REMITENTE = process.env.CORREO_REMITENTE || 'FinanSync <reportes@finansync.me>'

export async function enviarCorreo(opciones: {
  para: string
  asunto: string
  html: string
  adjuntos?: Adjunto[]
}): Promise<CorreoEnviado> {
  const llave = process.env.RESEND_API_KEY

  if (!llave) {
    console.log(JSON.stringify({
      evento: 'correo_omitido',
      motivo: 'sin RESEND_API_KEY configurada',
      para: opciones.para,
      asunto: opciones.asunto,
      adjuntos: opciones.adjuntos?.map((a) => a.nombre) ?? [],
    }))
    return { estado: 'omitido', detalle: 'sin proveedor configurado' }
  }

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${llave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [opciones.para],
      subject: opciones.asunto,
      html: opciones.html,
      attachments: opciones.adjuntos?.map((a) => ({
        filename: a.nombre,
        content: a.contenido.toString('base64'),
      })),
    }),
  })

  if (!respuesta.ok) {
    throw new Error(`El proveedor de correo respondió ${respuesta.status}: ${await respuesta.text()}`)
  }

  return { estado: 'enviado' }
}

/** Cuerpo del correo del estado de cuenta. El detalle va en el PDF adjunto. */
export function htmlEstadoCuenta(opciones: {
  nombre: string | null
  mes: string
  anio: number
  ingresos: string
  gastos: string
  balance: string
}): string {
  const saludo = opciones.nombre ? `Hola, ${opciones.nombre}` : 'Hola'

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.5">
  <p>${saludo}:</p>
  <p>Este es tu estado de cuenta de <strong>${opciones.mes} de ${opciones.anio}</strong>.</p>
  <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
    <tr><td>Ingresos</td><td align="right"><strong>${opciones.ingresos}</strong></td></tr>
    <tr><td>Gastos</td><td align="right"><strong>${opciones.gastos}</strong></td></tr>
    <tr><td>Balance</td><td align="right"><strong>${opciones.balance}</strong></td></tr>
  </table>
  <p>El desglose por categoría, tus presupuestos y el avance de tus metas van en el PDF adjunto.</p>
  <p style="font-size:12px;color:#64748b">Si ya no quieres recibir este correo, puedes desactivarlo en Configuración dentro de FinanSync.</p>
</div>`
}
