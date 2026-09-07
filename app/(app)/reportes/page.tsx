'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
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
        </div>
      </div>

      {/* tarjetas resumen */}
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
  )
}
