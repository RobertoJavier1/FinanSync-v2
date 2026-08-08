'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, RefreshCw, BellOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useNotif } from '@/context/NotifContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { useTransacciones } from '@/hooks/useTransacciones'
import type { Transaccion } from '@/lib/transacciones'
import { usePresupuestos } from '@/hooks/usePresupuestos'
import { useMetas } from '@/hooks/useMetas'
import { diasRestantes } from '@/lib/metas'

// abreviaturas de meses para los ejes de las graficas
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// mapea cada tipo de perspectiva a su icono, colores y texto del badge
const tipoConfig: Record<string, { icon: string; iconBg: string; iconBgDark: string; badgeColor: string; badgeLabel: string }> = {
  alerta:     { icon: '⚠️', iconBg: '#fef2f2', iconBgDark: '#450a0a40', badgeColor: 'bg-red-500 text-white',   badgeLabel: 'Alerta' },
  positivo:   { icon: '📈', iconBg: '#f0fdf4', iconBgDark: '#052e1640', badgeColor: 'bg-green-500 text-white', badgeLabel: 'Positivo' },
  sugerencia: { icon: '💡', iconBg: '#fefce8', iconBgDark: '#42240040', badgeColor: 'bg-blue-500 text-white',  badgeLabel: 'Sugerencia' },
}

interface Perspectiva {
  titulo: string
  descripcion: string
  tipo: 'alerta' | 'positivo' | 'sugerencia'
  ahorro?: number
}

// simbolo de cada moneda para mostrar el ahorro sugerido en las perspectivas
const SIMBOLOS: Record<string, string> = { MXN: '$', USD: '$', EUR: '€', GTQ: 'Q', COP: '$', ARS: '$' }

// arma los datos de los ultimos 6 meses para la grafica de tendencia de gastos
function buildTrendData(transactions: Transaccion[], convertir: (monto: number, monedaOrigen: string) => number) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const gastos = transactions
      .filter((t) => t.tipo === 'expense' && t.fechaISO?.startsWith(monthStr))
      .reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0)
    return { mes: MESES[d.getMonth()], gastos }
  })
}

// agrupa los gastos del mes actual por categoria y devuelve las 5 mas altas para la grafica de barras
function buildComparisonData(transactions: Transaccion[], mesActual: string, convertir: (monto: number, monedaOrigen: string) => number) {
  const expenses = transactions.filter((t) => t.tipo === 'expense' && t.fechaISO?.startsWith(mesActual))
  const grouped: Record<string, number> = {}
  expenses.forEach((t) => { grouped[t.categoria] = (grouped[t.categoria] || 0) + convertir(t.monto, t.monedaOrigen) })
  return Object.entries(grouped)
    .map(([categoria, actual]) => ({ categoria, actual }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 5)
}

// puntaje entre 40 y 100 basado en la tasa de ahorro del mes
function calcularHealthScore(ingresos: number, gastos: number): number {
  if (ingresos === 0) return 50
  const tasaAhorro = (ingresos - gastos) / ingresos
  return Math.min(100, Math.max(40, Math.round(40 + tasaAhorro * 100)))
}

export default function PerspectivasIAPage() {
  const { user } = useAuth()
  const { tema } = useTheme()
  const { notif, notifLoaded } = useNotif()
  const { finanzas, convertir, formatear } = useFinanzas()
  const isDark = tema === 'oscuro'

  const now = new Date()
  const mes = now.getMonth() + 1
  const anio = now.getFullYear()
  const mesActual = `${anio}-${String(mes).padStart(2, '0')}`

  const { data: transactions = [], isLoading: loadingTransacciones } = useTransacciones(user?.id)
  const { data: presupuestos = [], isLoading: loadingPresupuestos } = usePresupuestos(user?.id, mes, anio)
  const { data: metas = [], isLoading: loadingMetas } = useMetas(user?.id)
  // combina la carga de las tres fuentes, cada una con su propia cache
  const cargando = loadingTransacciones || loadingPresupuestos || loadingMetas
  const [perspectivas, setPerspectivas] = useState<Perspectiva[]>([])
  const [loadingIA, setLoadingIA] = useState(false)
  const [errorIA, setErrorIA] = useState('')

  // totales del mes actual convertidos a la moneda preferida del usuario
  const ingresosMes = useMemo(() =>
    transactions.filter((t) => t.tipo === 'income' && t.fechaISO?.startsWith(mesActual))
      .reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0),
    [transactions, mesActual, convertir])

  const gastosMes = useMemo(() =>
    transactions.filter((t) => t.tipo === 'expense' && t.fechaISO?.startsWith(mesActual))
      .reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0),
    [transactions, mesActual, convertir])

  // lista unica de categorias con gastos en el mes, se envia a la IA como contexto
  const categoriasMes = useMemo(() => {
    const cats = new Set(
      transactions
        .filter((t) => t.tipo === 'expense' && t.fechaISO?.startsWith(mesActual))
        .map((t) => t.categoria)
    )
    return Array.from(cats)
  }, [transactions, mesActual])

  // calcula el gasto real de cada presupuesto a partir de las transacciones del mes
  const presupuestosConGasto = useMemo(() =>
    presupuestos.map((p) => {
      const gastado = transactions
        .filter((t) => t.tipo === 'expense' && t.categoria.toLowerCase() === p.categoria.toLowerCase() && t.fechaISO?.startsWith(mesActual))
        .reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0)
      const limiteConv = convertir(p.limiteMonthly, p.monedaOrigen)
      const porcentaje = limiteConv > 0 ? Math.round((gastado / limiteConv) * 100) : 0
      return { categoria: p.categoria, limite: limiteConv, gastado, porcentaje }
    }),
    [presupuestos, transactions, mesActual, convertir])

  // resumen de cada meta con porcentaje y dias restantes, se envia a la IA
  const metasResumen = useMemo(() =>
    metas.map((m) => {
      const objConv = convertir(m.objetivo, m.monedaOrigen)
      const actConv = convertir(m.actual, m.monedaOrigen)
      return {
        nombre: m.nombre,
        objetivo: objConv,
        actual: actConv,
        porcentaje: objConv > 0 ? Math.round((actConv / objConv) * 100) : 0,
        diasRestantes: diasRestantes(m.fechaLimite),
        completada: m.completada,
      }
    }),
    [metas, convertir])

  const trendData = useMemo(() => buildTrendData(transactions, convertir), [transactions, convertir])
  const comparisonData = useMemo(() => buildComparisonData(transactions, mesActual, convertir), [transactions, mesActual, convertir])
  const healthScore = useMemo(() => calcularHealthScore(ingresosMes, gastosMes), [ingresosMes, gastosMes])
  const healthLabel = healthScore >= 80 ? 'Excelente' : healthScore >= 65 ? 'Bueno' : healthScore >= 50 ? 'Regular' : 'Atención'

  // colores de las graficas segun el tema activo
  const chartGridColor = isDark ? '#334155' : '#f1f5f9'
  const chartAxisColor = isDark ? '#64748b' : '#94a3b8'

  // no hay nada registrado cuando las tres fuentes estan vacias
  const sinDatos = !cargando && transactions.length === 0 && presupuestos.length === 0 && metas.length === 0

  // llama a la API route que consulta gemini y devuelve las perspectivas generadas
  async function cargarPerspectivas() {
    setLoadingIA(true)
    setErrorIA('')
    try {
      const res = await fetch('/api/perspectivas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingresos: ingresosMes,
          gastos: gastosMes,
          categorias: categoriasMes,
          presupuestos: presupuestosConGasto,
          metas: metasResumen,
          moneda: finanzas.moneda,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPerspectivas(data.perspectivas)
    } catch {
      setErrorIA('No se pudieron cargar las perspectivas. Intenta de nuevo.')
    } finally {
      setLoadingIA(false)
    }
  }

  // dispara la carga automatica solo cuando hay datos y el usuario tiene las recomendaciones IA activadas
  useEffect(() => {
    if (!cargando && !sinDatos && notifLoaded && notif.ia) {
      cargarPerspectivas()
    }
  }, [cargando, notifLoaded, sinDatos, notif.ia])

  // porcentaje de variacion entre el primer y ultimo mes del grafico de tendencia
  const variacionGastos = useMemo(() => {
    const primero = trendData[0]?.gastos
    const ultimo = trendData[trendData.length - 1]?.gastos
    if (!primero || primero === 0) return null
    return Math.round(((ultimo - primero) / primero) * 100)
  }, [trendData])

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          ✨ Perspectivas Financieras IA
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Recomendaciones personalizadas impulsadas por análisis de IA</p>
      </div>

      {/* Health Score */}
      <div className="bg-green-600 text-white rounded-xl p-6">
        <p className="text-green-200 text-xs mb-2">Puntuación de Salud Financiera</p>
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold">{healthScore}</span>
              <span className="text-green-200 text-lg">/100</span>
            </div>
            <p className="text-green-100 text-sm mt-1">{healthLabel} • Basado en tu actividad del mes</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-200 text-sm justify-end">
              <TrendingUp className="w-4 h-4" />
              {ingresosMes > 0 ? `${Math.round(((ingresosMes - gastosMes) / ingresosMes) * 100)}% tasa de ahorro` : 'Sin ingresos este mes'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-green-500">
          <div className="text-center">
            <p className="text-green-200 text-xs mb-0.5">Ingresos</p>
            <p className="font-bold text-lg">{formatear(ingresosMes)}</p>
          </div>
          <div className="text-center">
            <p className="text-green-200 text-xs mb-0.5">Gastos</p>
            <p className="font-bold text-lg">{formatear(gastosMes)}</p>
          </div>
          <div className="text-center">
            <p className="text-green-200 text-xs mb-0.5">Balance</p>
            <p className="font-bold text-lg">{formatear(ingresosMes - gastosMes)}</p>
          </div>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4">Tendencia de Gastos de 6 Meses</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: chartAxisColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartAxisColor }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: 8, color: isDark ? '#e2e8f0' : '#1e293b' }} />
              <Line type="monotone" dataKey="gastos" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} name="Gastos" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {variacionGastos === null
              ? 'Agrega transacciones para ver tu tendencia.'
              : variacionGastos > 0
                ? `Tus gastos han aumentado un ${variacionGastos}% en los últimos 6 meses.`
                : variacionGastos < 0
                  ? `Tus gastos han bajado un ${Math.abs(variacionGastos)}% en los últimos 6 meses. ¡Bien hecho!`
                  : 'Tus gastos se han mantenido estables en los últimos 6 meses.'
            }
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4">Gastos por Categoría Este Mes</h2>
          {comparisonData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
              Sin gastos registrados este mes
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={comparisonData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis dataKey="categoria" tick={{ fontSize: 9, fill: chartAxisColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: chartAxisColor }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: 8, color: isDark ? '#e2e8f0' : '#1e293b' }} />
                <Bar dataKey="actual" fill={isDark ? '#475569' : '#64748b'} radius={[4, 4, 0, 0]} name="Gasto" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {comparisonData.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              Tu mayor gasto este mes es <span className="text-blue-600 dark:text-blue-400">{comparisonData[0]?.categoria}</span> con {formatear(comparisonData[0]?.actual ?? 0)}.
            </p>
          )}
        </div>
      </div>

      {/* Estado vacío */}
      {sinDatos && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-2xl">
            ✨
          </div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">Aún no hay datos para analizar</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
            Agrega transacciones, presupuestos o metas para que la IA pueda generar perspectivas personalizadas basadas en tu situación real.
          </p>
        </div>
      )}

      {/* Perspectivas unificadas */}
      {!sinDatos && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Perspectivas Personalizadas</h2>
            {notif.ia && (
              <button
                onClick={cargarPerspectivas}
                disabled={loadingIA || cargando}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingIA ? 'animate-spin' : ''}`} />
                {loadingIA ? 'Analizando...' : 'Regenerar'}
              </button>
            )}
          </div>

          {!notif.ia && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-10 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <BellOff className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="font-medium text-slate-600 dark:text-slate-300">Recomendaciones IA desactivadas</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                Actívalas en{' '}
                <a href="/configuracion" className="text-blue-500 dark:text-blue-400 underline">
                  Configuración → Notificaciones
                </a>{' '}
                para ver análisis personalizados de tu situación financiera.
              </p>
            </div>
          )}

          {notif.ia && (
            <>
              {/* skeleton mientras gemini responde */}
              {loadingIA && (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
                      <div className="flex gap-3 mb-2">
                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex-shrink-0" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4 mt-1" />
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-full ml-11 mb-1" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-5/6 ml-11" />
                    </div>
                  ))}
                </div>
              )}

              {errorIA && !loadingIA && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-sm rounded-xl p-4 text-center">
                  {errorIA}
                </div>
              )}
            </>
          )}

          {notif.ia && !loadingIA && perspectivas.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {perspectivas.map((p, i) => {
                const config = tipoConfig[p.tipo] ?? tipoConfig.sugerencia
                const tieneAhorro = !!p.ahorro && p.ahorro > 0
                return (
                  <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ backgroundColor: isDark ? config.iconBgDark : config.iconBg }}
                        >
                          {config.icon}
                        </div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs leading-tight pt-1">{p.titulo}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${config.badgeColor}`}>
                        {config.badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed ml-11">{p.descripcion}</p>
                    {tieneAhorro && (
                      <div className="ml-11 mt-2">
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                          Ahorra ~{SIMBOLOS[finanzas.moneda] || '$'}{p.ahorro}/mes
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
