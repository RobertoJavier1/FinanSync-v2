// Estado de cuenta mensual: consulta de los datos y armado del PDF.
//
// Vive en lib/ y no en la página de Reportes a propósito. El PDF de Reportes se
// genera en el navegador con jsPDF, lo que sirve para descargarlo pero no para
// mandarlo por correo: el job mensual corre en el servidor, sin navegador. Este
// módulo hace el mismo trabajo del lado del servidor.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export interface UsuarioReporte {
  idUsuario: string
  nombre: string | null
  email: string
  moneda: string
}

export interface EstadoCuenta {
  anio: number
  mes: number
  ingresos: number
  gastos: number
  balance: number
  movimientos: number
  categorias: { categoria: string; total: number }[]
  presupuestos: { categoria: string; limite: number; gastado: number }[]
  metas: { nombre: string; objetivo: number; actual: number; fechaLimite: string | null }[]
}

/** Usuarios con correo y con el reporte mensual activado. */
export async function usuariosDelReporte(): Promise<UsuarioReporte[]> {
  const { data, error } = await supabaseAdmin().rpc('usuarios_reporte_mensual')
  if (error) throw error

  return (data ?? []).map((row: Record<string, unknown>) => ({
    idUsuario: row.id_usuario as string,
    nombre: (row.nombre as string) ?? null,
    email: row.email as string,
    moneda: (row.moneda as string) || 'GTQ',
  }))
}

/** Resumen del mes de un usuario, calculado en la base de datos. */
export async function estadoCuentaDe(
  idUsuario: string,
  anio: number,
  mes: number,
): Promise<EstadoCuenta> {
  const { data, error } = await supabaseAdmin().rpc('estado_cuenta_mensual', {
    p_user_id: idUsuario,
    p_anio: anio,
    p_mes: mes,
  })
  if (error) throw error

  const d = data as Record<string, unknown>
  return {
    anio: Number(d.anio),
    mes: Number(d.mes),
    ingresos: Number(d.ingresos ?? 0),
    gastos: Number(d.gastos ?? 0),
    balance: Number(d.balance ?? 0),
    movimientos: Number(d.movimientos ?? 0),
    categorias: (d.categorias as EstadoCuenta['categorias']) ?? [],
    presupuestos: (d.presupuestos as EstadoCuenta['presupuestos']) ?? [],
    metas: (d.metas as EstadoCuenta['metas']) ?? [],
  }
}

/** El mes anterior al de la fecha dada. El reporte del día 1 habla del mes que cerró. */
export function mesAnterior(hoy = new Date()): { anio: number; mes: number } {
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  return { anio: anterior.getFullYear(), mes: anterior.getMonth() + 1 }
}

export function nombreDelMes(mes: number): string {
  return MESES[mes - 1] ?? ''
}

function monto(valor: number, moneda: string): string {
  return `${valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

/**
 * Arma el PDF del estado de cuenta y lo devuelve como Buffer, listo para
 * adjuntarlo a un correo o guardarlo.
 */
export function generarPdf(usuario: UsuarioReporte, datos: EstadoCuenta): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const ancho = pdf.internal.pageSize.getWidth()
  const margen = 40
  let y = 56

  // encabezado
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(30, 41, 59)
  pdf.text('Estado de cuenta', margen, y)

  y += 18
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(100, 116, 139)
  pdf.text(`${nombreDelMes(datos.mes)} de ${datos.anio}`, margen, y)
  if (usuario.nombre) {
    pdf.text(usuario.nombre, ancho - margen, y, { align: 'right' })
  }

  // totales del mes
  y += 26
  const tarjetas: { etiqueta: string; valor: string; color: [number, number, number] }[] = [
    { etiqueta: 'Ingresos', valor: monto(datos.ingresos, usuario.moneda), color: [22, 163, 74] },
    { etiqueta: 'Gastos', valor: monto(datos.gastos, usuario.moneda), color: [220, 38, 38] },
    {
      etiqueta: 'Balance',
      valor: monto(datos.balance, usuario.moneda),
      color: datos.balance >= 0 ? [22, 163, 74] : [220, 38, 38],
    },
  ]
  const anchoCol = (ancho - margen * 2) / 3

  tarjetas.forEach((t, i) => {
    const x = margen + anchoCol * i
    pdf.setDrawColor(226, 232, 240)
    pdf.roundedRect(x, y, anchoCol - 10, 55, 4, 4, 'S')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.text(t.etiqueta, x + 10, y + 18)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(t.color[0], t.color[1], t.color[2])
    pdf.text(t.valor, x + 10, y + 40, { maxWidth: anchoCol - 20 })
  })

  y += 80
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(100, 116, 139)
  pdf.text(
    datos.movimientos === 1
      ? '1 movimiento registrado en el mes'
      : `${datos.movimientos} movimientos registrados en el mes`,
    margen,
    y,
  )
  y += 30

  // Las tres tablas comparten el mismo estilo. La alineación del encabezado se
  // pone en la propia celda y no solo en columnStyles: el estilo de la celda es
  // el que manda, y si se deja fuera, el título queda a la izquierda mientras
  // la cifra se alinea a la derecha, que es lo que se veía descuadrado.
  const derecha = (texto: string) => ({ content: texto, styles: { halign: 'right' as const } })

  const estiloBase = {
    margin: { left: margen, right: margen },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: {
      fillColor: [241, 245, 249] as [number, number, number],
      textColor: [30, 41, 59] as [number, number, number],
    },
  }

  const finDeTabla = () =>
    (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  /** Título de sección. Salta de página si ya no cabe la tabla debajo. */
  function titulo(texto: string): void {
    if (y > pdf.internal.pageSize.getHeight() - 140) {
      pdf.addPage()
      y = 56
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(30, 41, 59)
    pdf.text(texto, margen, y)
    y += 10
  }

  /** Para cuando una sección no tiene filas: mejor decirlo que dejar el hueco. */
  function vacio(texto: string): void {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(148, 163, 184)
    pdf.text(texto, margen, y + 12)
    y += 36
  }

  // gastos por categoria
  titulo('Gastos por categoría')
  if (datos.categorias.length > 0) {
    autoTable(pdf, {
      ...estiloBase,
      startY: y,
      head: [['Categoría', derecha('Gastado')]],
      body: datos.categorias.map((c) => [c.categoria, monto(Number(c.total), usuario.moneda)]),
      columnStyles: { 1: { halign: 'right' } },
    })
    y = finDeTabla() + 28
  } else {
    vacio('No se registraron gastos en el mes.')
  }

  // presupuestos del mes
  titulo('Presupuestos del mes')
  if (datos.presupuestos.length > 0) {
    autoTable(pdf, {
      ...estiloBase,
      startY: y,
      head: [['Presupuesto', derecha('Límite'), derecha('Gastado'), derecha('Avance')]],
      body: datos.presupuestos.map((p) => {
        const limite = Number(p.limite)
        const gastado = Number(p.gastado)
        const pct = limite > 0 ? Math.round((gastado / limite) * 100) : 0
        return [
          p.categoria,
          monto(limite, usuario.moneda),
          monto(gastado, usuario.moneda),
          `${pct}%${pct > 100 ? ' (excedido)' : ''}`,
        ]
      }),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })
    y = finDeTabla() + 28
  } else {
    vacio('No hay presupuestos configurados.')
  }

  // metas de ahorro
  titulo('Metas de ahorro')
  if (datos.metas.length > 0) {
    autoTable(pdf, {
      ...estiloBase,
      startY: y,
      head: [['Meta', derecha('Objetivo'), derecha('Ahorrado'), derecha('Avance')]],
      body: datos.metas.map((m) => {
        const objetivo = Number(m.objetivo)
        const actual = Number(m.actual)
        const pct = objetivo > 0 ? Math.round((actual / objetivo) * 100) : 0
        return [
          m.nombre,
          monto(objetivo, usuario.moneda),
          monto(actual, usuario.moneda),
          `${pct}%`,
        ]
      }),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })
    y = finDeTabla() + 28
  } else {
    vacio('No hay metas de ahorro activas.')
  }

  // pie
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(148, 163, 184)
  pdf.text(
    'Generado automáticamente por FinanSync. Puedes desactivar este envío en Configuración.',
    margen,
    pdf.internal.pageSize.getHeight() - 30,
  )

  return Buffer.from(pdf.output('arraybuffer'))
}
