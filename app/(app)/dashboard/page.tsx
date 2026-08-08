'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { useTransacciones } from '@/hooks/useTransacciones'
import type { Transaccion } from '@/lib/transacciones'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// colores asignados por categoria para las graficas
const PIE_COLORS: Record<string, string> = {
  Vivienda: '#3b82f6', Comida: '#22c55e', Transporte: '#94a3b8',
  Compras: '#ef4444', Entretenimiento: '#a855f7', Salario: '#f59e0b',
  Freelance: '#f97316', Salud: '#06b6d4', Educacion: '#8b5cf6', Otros: '#64748b',
}

// agrupa transacciones por mes para los ultimos 6 meses con conversion de moneda
function buildMonthlyData(transactions: Transaccion[], convertir: (monto: number, monedaOrigen: string) => number) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const inMonth = transactions.filter((t) => t.fechaISO?.startsWith(monthStr))
    return {
      mes: MESES[d.getMonth()],
      ingresos: inMonth.filter((t) => t.tipo === 'income').reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0),
      gastos: inMonth.filter((t) => t.tipo === 'expense').reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0),
    }
  })
}

// calcula el porcentaje de cada categoria sobre el total de gastos
function buildCategoryData(transactions: Transaccion[], tipo: 'income' | 'expense', convertir: (monto: number, monedaOrigen: string) => number) {
  const filtered = transactions.filter((t) => t.tipo === tipo)
  const total = filtered.reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0)
  if (total === 0) return []
  const grouped: Record<string, number> = {}
  filtered.forEach((t) => {
    grouped[t.categoria] = (grouped[t.categoria] || 0) + convertir(t.monto, t.monedaOrigen)
  })
  return Object.entries(grouped)
    .map(([name, value]) => ({
      name,
      value: Math.round((value / total) * 100),
      color: PIE_COLORS[name] || '#64748b',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
}

export default function DashboardPage() {
  const { user, nombre } = useAuth()
  const { convertir, formatear } = useFinanzas()
  const { data: transactions = [], isLoading: loading } = useTransacciones(user?.id)

  const now = new Date()
  // prefijo del mes actual para filtrar transacciones de este mes
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const ingresosMes = useMemo(() =>
    transactions
      .filter((t) => t.tipo === 'income' && t.fechaISO?.startsWith(mesActual))
      .reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0),
    [transactions, mesActual, convertir])

  const gastosMes = useMemo(() =>
    transactions
      .filter((t) => t.tipo === 'expense' && t.fechaISO?.startsWith(mesActual))
      .reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0),
    [transactions, mesActual, convertir])

  // saldo = suma de todos los ingresos menos todos los gastos historicos
  const saldoTotal = useMemo(() =>
    transactions.filter((t) => t.tipo === 'income').reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0) -
    transactions.filter((t) => t.tipo === 'expense').reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0),
    [transactions, convertir])

  const monthlyData   = useMemo(() => buildMonthlyData(transactions, convertir), [transactions, convertir])
  const gastoData     = useMemo(() => buildCategoryData(transactions, 'expense', convertir), [transactions, convertir])
  const ingresoData   = useMemo(() => buildCategoryData(transactions, 'income', convertir), [transactions, convertir])

  const mesNombre = MESES[now.getMonth()]
  // muestra el primer nombre si existe, si no un saludo generico
  const nombreUsuario = nombre.split(' ')[0] || 'de nuevo'

  return (
    <div className="p-6 space-y-5 dark:bg-slate-900 min-h-screen">
      {/* encabezado con nombre real del usuario y mes actual */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">¡Bienvenido, {nombreUsuario}! 👋</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Aquí está tu resumen financiero de {mesNombre} {now.getFullYear()}
          </p>
        </div>
        <Link href="/transacciones/agregar">
          <button className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm">
            <Plus className="w-4 h-4" />
            Agregar Transacción
          </button>
        </Link>
      </div>

      {/* tarjetas de resumen: muestra skeleton mientras carga */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-600 text-white rounded-xl p-5">
            <p className="text-green-100 text-xs mb-1">Saldo Total</p>
            <p className="text-3xl font-bold">
              {formatear(saldoTotal)}
            </p>
            <p className="text-green-200 text-xs mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Ingresos - Gastos acumulados
            </p>
            <div className="w-8 h-8 bg-green-500 rounded-lg mt-3 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs mb-1">Ingresos</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {formatear(ingresosMes)}
                </p>
                <p className="text-slate-400 text-xs mt-1">Este mes</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs mb-1">Gastos</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {formatear(gastosMes)}
                </p>
                <p className="text-slate-400 text-xs mt-1">Este mes</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 text-red-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* graficas: area (ultimos 6 meses) y pie (distribucion de gastos) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 text-sm">Ingresos vs Gastos</h2>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="ingresos" stroke="#22c55e" fill="url(#colorIngresos)" strokeWidth={2} name="Ingresos" />
              <Area type="monotone" dataKey="gastos" stroke="#ef4444" fill="url(#colorGastos)" strokeWidth={2} name="Gastos" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-4 h-0.5 bg-green-500 inline-block rounded" />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-4 h-0.5 bg-red-500 inline-block rounded" />
              Gastos
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 text-sm">Distribución por Categoría</h2>
          <div className="grid grid-cols-2 gap-2">
            {/* pie de gastos */}
            <div>
              <p className="text-xs font-medium text-red-500 mb-2 text-center">Gastos</p>
              {gastoData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-xs">Sin datos</div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={gastoData} cx="50%" cy="50%" innerRadius={32} outerRadius={55} dataKey="value" paddingAngle={2}>
                        {gastoData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-1">
                    {gastoData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 dark:text-slate-300 flex-1 truncate">{item.name}</span>
                        <span className="text-slate-400">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* pie de ingresos */}
            <div>
              <p className="text-xs font-medium text-green-600 mb-2 text-center">Ingresos</p>
              {ingresoData.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-xs">Sin datos</div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={ingresoData} cx="50%" cy="50%" innerRadius={32} outerRadius={55} dataKey="value" paddingAngle={2}>
                        {ingresoData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-1">
                    {ingresoData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 dark:text-slate-300 flex-1 truncate">{item.name}</span>
                        <span className="text-slate-400">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ultimas 4 transacciones como vista rapida antes de ir a la pagina completa */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Últimas Transacciones</h2>
          <Link href="/transacciones">
            <button className="text-xs text-blue-600 border border-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-medium">
              Ver Todo
            </button>
          </Link>
        </div>
        {loading ? (
          <div className="text-slate-400 text-sm text-center py-4">Cargando...</div>
        ) : transactions.length === 0 ? (
          <div className="text-slate-400 text-sm text-center py-4">No hay transacciones aún</div>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.tipo === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {t.tipo === 'income'
                    ? <ArrowUpRight className="w-4 h-4 text-green-600" />
                    : <TrendingDown className="w-4 h-4 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate">{t.descripcion}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t.categoria} • {t.fecha}</p>
                </div>
                <span className={`font-semibold text-sm ${t.tipo === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.tipo === 'income' ? '+' : '-'}{formatear(t.monto, t.monedaOrigen)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* banner de ia con enlace a la pagina de perspectivas */}
      <div className="bg-blue-600 rounded-xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
          🤖
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm">Perspectiva Financiera IA</h3>
          <p className="text-blue-100 text-xs mt-1 leading-relaxed">
            Ve a Perspectivas IA para obtener un análisis personalizado de tus finanzas con inteligencia artificial.
          </p>
          <Link href="/perspectivas-ia">
            <button className="mt-3 bg-white text-blue-600 text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              Ver Todas las Perspectivas
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
