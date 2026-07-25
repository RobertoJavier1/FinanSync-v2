'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { agregarTransaccion } from '@/lib/transacciones'

const SIMBOLOS: Record<string, string> = { MXN: '$', USD: '$', EUR: '€', GTQ: 'Q', COP: '$', ARS: '$' }

export default function AgregarTransaccionPage() {
  const { user } = useAuth()
  const { finanzas } = useFinanzas()
  const router = useRouter()

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]) // YYYY-MM-DD
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!amount || !category || !date) {
      setError('Completa los campos obligatorios')
      return
    }

    setLoading(true)
    setError('')
    try {
      // si no hay descripcion se usa la categoria como nombre de la transaccion
      await agregarTransaccion(user.uid, {
        descripcion: description.trim() || category,
        categoria: category,
        fechaISO: date,
        monto: parseFloat(amount),
        tipo: type,
        monedaOrigen: finanzas.moneda,
      })
      router.push('/transacciones')
    } catch {
      setError('Error al guardar la transacción. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/transacciones">
          <button className="text-slate-600 hover:text-slate-800 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Agregar Transacción</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleGuardar} className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-8 space-y-6">
        {/* Type Toggle */}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de Transacción</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-3 rounded-lg font-semibold text-sm border-2 transition-colors ${
                type === 'expense'
                  ? 'border-red-400 bg-red-50 text-red-500'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-3 rounded-lg font-semibold text-sm border-2 transition-colors ${
                type === 'income'
                  ? 'border-green-400 bg-green-50 text-green-600'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              Ingreso
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Monto *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
              {SIMBOLOS[finanzas.moneda] || '$'}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full pl-8 pr-16 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold select-none">
              {finanzas.moneda}
            </span>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Categoría *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-200 outline-none focus:ring-2 focus:ring-green-500 cursor-pointer text-sm"
          >
            <option value="">Selecciona una categoría</option>
            {finanzas.categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Fecha *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Descripción (Opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Agrega una nota..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link href="/transacciones">
            <button
              type="button"
              className="w-full py-3 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
            >
              Cancelar
            </button>
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm"
          >
            <Check className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar Transacción'}
          </button>
        </div>
      </form>
    </div>
  )
}
