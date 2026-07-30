'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Trash2, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { getTransacciones, eliminarTransaccion, Transaccion } from '@/lib/transacciones'

export default function TransaccionesPage() {
  const { user } = useAuth()
  const { formatear, convertir, finanzas } = useFinanzas()
  const [transactions, setTransactions] = useState<Transaccion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // carga las transacciones del usuario desde Supabase al montar el componente
  useEffect(() => {
    if (!user) return
    setLoading(true)
    getTransacciones(user.id)
      .then(setTransactions)
      .finally(() => setLoading(false))
  }, [user])

  // actualiza el estado local inmediatamente para respuesta instantanea, luego elimina en la base de datos
  async function handleEliminar(id: string) {
    if (!user) return
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await eliminarTransaccion(user.id, id)
  }

  // aplica los tres filtros en simultaneo sobre la lista cargada desde Supabase
  const filtered = transactions.filter((t) => {
    const matchSearch = t.descripcion.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || t.tipo === typeFilter
    const matchCategory = categoryFilter === 'all' || t.categoria.toLowerCase() === categoryFilter.toLowerCase()
    return matchSearch && matchType && matchCategory
  })

  // categorias unicas presentes en las transacciones cargadas
  const categoriasUnicas = [...new Set(transactions.map((t) => t.categoria))].sort()

  // totales calculados sobre TODAS las transacciones, no solo las filtradas
  const totalIncome = transactions
    .filter((t) => t.tipo === 'income')
    .reduce((sum, t) => sum + convertir(t.monto, t.monedaOrigen), 0)

  const totalExpenses = transactions
    .filter((t) => t.tipo === 'expense')
    .reduce((sum, t) => sum + convertir(t.monto, t.monedaOrigen), 0)

  return (
    <div className="p-6 space-y-4 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Transacciones</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Visualiza y administra tus transacciones</p>
        </div>
        <Link href="/transacciones/agregar">
          <button className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm">
            <Plus className="w-4 h-4" />
            Agregar Transacción
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar transacciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-200 outline-none cursor-pointer"
        >
          <option value="all">Todos los Tipos</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-200 outline-none cursor-pointer"
        >
          <option value="all">Todas las Categorías</option>
          {categoriasUnicas.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Cargando transacciones...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          {transactions.length === 0 ? 'Aún no tienes transacciones. ¡Agrega la primera!' : 'No hay transacciones que coincidan con los filtros.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-xl px-5 py-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${t.tipo === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                {t.tipo === 'income'
                  ? <ArrowUpRight className="w-5 h-5 text-green-600" />
                  : <ArrowDownRight className="w-5 h-5 text-red-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{t.descripcion}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.categoria} • {t.fecha}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-semibold text-base ${t.tipo === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.tipo === 'income' ? '+' : '-'}{formatear(t.monto, t.monedaOrigen)}
                </span>
                <button
                  onClick={() => handleEliminar(t.id)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Footer */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 flex justify-between">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Total Ingresos</p>
          <p className="text-green-600 font-bold text-xl mt-0.5">{formatear(totalIncome)}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Total Gastos</p>
          <p className="text-red-500 font-bold text-xl mt-0.5">{formatear(totalExpenses)}</p>
        </div>
      </div>
    </div>
  )
}
