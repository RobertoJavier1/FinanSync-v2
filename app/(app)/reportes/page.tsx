'use client'

import { useMemo, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { MESES } from '@/context/PeriodoContext'
import { useComparativaMensual, usePromedioCategoria } from '@/hooks/useReportes'
import type { FilaComparativaMensual, FilaPromedioCategoria } from '@/lib/reportes'

type Vista = 'mensual' | 'anual'

const OPCIONES_MESES = [3, 6, 12] as const

// agrupa la comparativa por mes o por año, convirtiendo cada fila a la
// moneda activa antes de sumar (las filas llegan separadas por moneda_origen)
function buildComparativa(
  filas: FilaComparativaMensual[],
  vista: Vista,
  convertir: (monto: number, monedaOrigen: string) => number,
) {
  const acc = new Map<string, { anio: number; mes: number; ingresos: number; gastos: number }>()

  for (const f of filas) {
    const key = vista === 'mensual' ? `${f.anio}-${f.mes}` : `${f.anio}`
    const entry = acc.get(key) ?? { anio: f.anio, mes: f.mes, ingresos: 0, gastos: 0 }
    const monto = convertir(f.total, f.monedaOrigen)
    if (f.tipo === 'income') entry.ingresos += monto
    else entry.gastos += monto
    acc.set(key, entry)
  }

  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      label: vista === 'mensual' ? `${MESES[v.mes - 1]} ${v.anio}` : `${v.anio}`,
      ingresos: Math.round(v.ingresos * 100) / 100,
      gastos: Math.round(v.gastos * 100) / 100,
    }))
}

// junta las filas de promedio por categoria entre monedas distintas
function buildPromedios(
  filas: FilaPromedioCategoria[],
  convertir: (monto: number, monedaOrigen: string) => number,
) {
  const acc = new Map<string, { promedio: number; total: number }>()

  for (const f of filas) {
    const entry = acc.get(f.categoria) ?? { promedio: 0, total: 0 }
    entry.promedio += convertir(f.promedioMensual, f.monedaOrigen)
    entry.total += convertir(f.totalGastado, f.monedaOrigen)
    acc.set(f.categoria, entry)
  }

  return Array.from(acc.entries())
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.promedio - a.promedio)
}

export default function ReportesPage() {
  const { user } = useAuth()
  const { convertir, formatear } = useFinanzas()

  const [meses, setMeses] = useState<number>(6)
  const [vista, setVista] = useState<Vista>('mensual')
  const [exportando, setExportando] = useState(false)
  const contenidoRef = useRef<HTMLDivElement>(null)

  const { data: filasComparativa = [], isLoading: cargandoComparativa } = useComparativaMensual(user?.id, meses)
  const { data: filasPromedio = [], isLoading: cargandoPromedio } = usePromedioCategoria(user?.id, meses)

  const comparativa = useMemo(
    () => buildComparativa(filasComparativa, vista, convertir),
    [filasComparativa, vista, convertir],
  )

  const promedios = useMemo(
    () => buildPromedios(filasPromedio, convertir),
    [filasPromedio, convertir],
  )

  const totalIngresos = useMemo(() => comparativa.reduce((s, c) => s + c.ingresos, 0), [comparativa])
  const totalGastos = useMemo(() => comparativa.reduce((s, c) => s + c.gastos, 0), [comparativa])
  const categoriaTop = promedios[0]

  const cargando = cargandoComparativa || cargandoPromedio

  // arma el pdf dibujando texto/formas con los datos ya calculados (comparativa,
  // promedios), en vez de capturar el dom como imagen
  async function handleExportar() {
    setExportando(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const margin = 40
      const contentWidth = pageWidth - margin * 2
      let y = margin

      // encabezado
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.setTextColor(30, 41, 59)
      pdf.text('Reporte Financiero', margin, y)
      y += 20
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(100, 116, 139)
      const periodoTexto = vista === 'mensual' ? `Vista mensual · últimos ${meses} meses` : `Vista anual · últimos ${meses} meses`
      pdf.text(`${periodoTexto} · generado el ${new Date().toLocaleDateString('es-GT')}`, margin, y)
      y += 25

      // tarjetas resumen, como tres columnas de texto
      const colWidth = contentWidth / 3
      const tarjetas = [
        { label: 'Ingresos del periodo', valor: formatear(totalIngresos), color: [22, 163, 74] as const },
        { label: 'Gastos del periodo', valor: formatear(totalGastos), color: [220, 38, 38] as const },
        { label: 'Categoría con más gasto', valor: categoriaTop ? categoriaTop.categoria : 'Sin datos', color: [30, 41, 59] as const },
      ]
      tarjetas.forEach((t, i) => {
        const x = margin + colWidth * i
        pdf.setDrawColor(226, 232, 240)
        pdf.roundedRect(x, y, colWidth - 10, 55, 4, 4, 'S')
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(100, 116, 139)
        pdf.text(t.label, x + 10, y + 18, { maxWidth: colWidth - 20 })
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(13)
        pdf.setTextColor(t.color[0], t.color[1], t.color[2])
        pdf.text(t.valor, x + 10, y + 40, { maxWidth: colWidth - 20 })
      })
      y += 80

      // grafica de barras: ingresos vs gastos, dibujada con rectangulos escalados al maximo valor
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(30, 41, 59)
      pdf.text(`Ingresos vs Gastos ${vista === 'mensual' ? 'por mes' : 'por año'}`, margin, y)
      y += 22

      if (comparativa.length === 0) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(148, 163, 184)
        pdf.text('Sin datos en este periodo', margin, y + 20)
        y += 40
      } else {
        const chartHeight = 140
        const chartTop = y
        const maxValor = Math.max(...comparativa.flatMap((c) => [c.ingresos, c.gastos]), 1)
        // gutter a la izquierda reservado para las etiquetas del eje y, para que no se encimen con la primera barra
        const ejeGutter = 42
        const plotLeft = margin + ejeGutter
        const plotWidth = contentWidth - ejeGutter
        const grupoWidth = plotWidth / comparativa.length
        const barWidth = Math.min(18, grupoWidth / 3)

        // lineas guia horizontales con su valor en el eje, como el eje Y de la grafica en pantalla
        const pasos = 4
        pdf.setFontSize(6.5)
        pdf.setFont('helvetica', 'normal')
        for (let p = 0; p <= pasos; p++) {
          const valorPaso = (maxValor / pasos) * p
          const yLinea = chartTop + chartHeight - (valorPaso / maxValor) * chartHeight
          pdf.setDrawColor(241, 245, 249)
          pdf.line(plotLeft, yLinea, plotLeft + plotWidth, yLinea)
          pdf.setTextColor(148, 163, 184)
          pdf.text(formatear(valorPaso), plotLeft - 4, yLinea - 2, { align: 'right' })
        }

        comparativa.forEach((c, i) => {
          const xGrupo = plotLeft + grupoWidth * i + grupoWidth / 2
          const hIngresos = (c.ingresos / maxValor) * chartHeight
          const hGastos = (c.gastos / maxValor) * chartHeight
          const xIngresos = xGrupo - barWidth - 2
          const xGastos = xGrupo + 2

          pdf.setFillColor(34, 197, 94)
          pdf.rect(xIngresos, chartTop + chartHeight - hIngresos, barWidth, hIngresos, 'F')
          pdf.setFillColor(239, 68, 68)
          pdf.rect(xGastos, chartTop + chartHeight - hGastos, barWidth, hGastos, 'F')

          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7)
          pdf.setTextColor(100, 116, 139)
          pdf.text(c.label, xGrupo, chartTop + chartHeight + 12, { align: 'center', maxWidth: grupoWidth })
        })

        // eje base
        pdf.setDrawColor(203, 213, 225)
        pdf.line(plotLeft, chartTop + chartHeight, plotLeft + plotWidth, chartTop + chartHeight)

        // leyenda
        const leyendaY = chartTop + chartHeight + 25
        pdf.setFillColor(34, 197, 94)
        pdf.rect(margin, leyendaY, 8, 8, 'F')
        pdf.setTextColor(71, 85, 105)
        pdf.setFontSize(8)
        pdf.text('Ingresos', margin + 12, leyendaY + 7)
        pdf.setFillColor(239, 68, 68)
        pdf.rect(margin + 70, leyendaY, 8, 8, 'F')
        pdf.text('Gastos', margin + 82, leyendaY + 7)

        y = leyendaY + 25
      }

      // tabla de promedio de gasto por categoria
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(30, 41, 59)
      pdf.text(`Promedio de gasto por categoría (últimos ${meses} meses)`, margin, y)
      y += 10

      if (promedios.length === 0) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(148, 163, 184)
        pdf.text('No hay gastos en este periodo', margin, y + 20)
      } else {
        autoTable(pdf, {
          startY: y + 5,
          margin: { left: margin, right: margin },
          head: [['Categoría', 'Promedio mensual', 'Total gastado']],
          body: promedios.map((p) => [p.categoria, formatear(p.promedio), formatear(p.total)]),
          styles: { fontSize: 9, textColor: [51, 65, 85] },
          headStyles: { fillColor: [30, 41, 59], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        })
      }

      pdf.save(`reportes-finansync-${vista}-${meses}m.pdf`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 dark:bg-slate-900 min-h-screen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reportes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Comparativas y promedios calculados directamente en la base de datos
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* selector de periodo */}
          <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 gap-1">
            {OPCIONES_MESES.map((m) => (
              <button
                key={m}
                onClick={() => setMeses(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  meses === m
                    ? 'bg-green-500 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {m} meses
              </button>
            ))}
          </div>

          {/* toggle mensual / anual */}
          <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 gap-1">
            {(['mensual', 'anual'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  vista === v
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportar}
            disabled={exportando || cargando}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {exportando ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* tarjetas resumen + graficas: todo dentro de este div se captura al exportar a PDF */}
      <div ref={contenidoRef} className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs mb-1">Ingresos del periodo</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{formatear(totalIngresos)}</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-xs mb-1">Gastos del periodo</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{formatear(totalGastos)}</p>
            </div>
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 col-span-2 md:col-span-1">
          <p className="text-slate-500 text-xs mb-1">Categoría con más gasto promedio</p>
          {categoriaTop ? (
            <>
              <p className="text-xl font-bold text-slate-800 dark:text-white truncate">{categoriaTop.categoria}</p>
              <p className="text-slate-400 text-xs mt-1">{formatear(categoriaTop.promedio)} / mes</p>
            </>
          ) : (
            <p className="text-slate-400 text-sm mt-2">Sin datos</p>
          )}
        </div>
      </div>

      {/* comparativa ingresos vs gastos */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 text-sm">
          Ingresos vs Gastos {vista === 'mensual' ? 'por mes' : 'por año'}
        </h2>
        {cargando ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Cargando...</div>
        ) : comparativa.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sin datos en este periodo</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparativa} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" fill="#22c55e" name="Ingresos" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" fill="#ef4444" name="Gastos" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* promedio de gasto por categoria */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 text-sm">
          Promedio de gasto por categoría (últimos {meses} meses)
        </h2>
        {cargando ? (
          <div className="text-slate-400 text-sm text-center py-4">Cargando...</div>
        ) : promedios.length === 0 ? (
          <div className="text-slate-400 text-sm text-center py-4">No hay gastos en este periodo</div>
        ) : (
          <div className="space-y-3">
            {promedios.map((p) => {
              const porcentaje = categoriaTop ? Math.round((p.promedio / categoriaTop.promedio) * 100) : 0
              return (
                <div key={p.categoria}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.categoria}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{formatear(p.promedio)} / mes</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${porcentaje}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
