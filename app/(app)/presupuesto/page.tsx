'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2, X, TrendingDown, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNotif } from '@/context/NotifContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { usePeriodo } from '@/context/PeriodoContext'

const SIMBOLOS: Record<string, string> = {
  MXN: '$', USD: '$', EUR: '€', GTQ: 'Q', COP: '$', ARS: '$',
}
import { agregarPresupuesto, eliminarPresupuesto, COLORES_PRESUPUESTO, ICONOS_PRESUPUESTO } from '@/lib/presupuestos'
import { useTransaccionesPorMes } from '@/hooks/useTransacciones'
import { usePresupuestos } from '@/hooks/usePresupuestos'
import { useQueryClient } from '@tanstack/react-query'
import SelectorMes from '@/components/SelectorMes'

export default function PresupuestoPage() {
  const { user } = useAuth()
  const { notif } = useNotif()
  const { finanzas, formatear, convertir } = useFinanzas()
  const { mes, anio, mesNombre } = usePeriodo()

  const { data: presupuestos = [], isLoading: loading } = usePresupuestos(user?.id, mes, anio)
  // ya viene filtrado por el mismo mes/anio, no hace falta filtrar por fecha otra vez
  const { data: transacciones = [] } = useTransaccionesPorMes(user?.id, mes, anio)
  const queryClient = useQueryClient()
  const [bannerCerrado, setBannerCerrado] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // campos del formulario del modal
  const [newCategoria, setNewCategoria] = useState('')
  const [newLimite, setNewLimite] = useState('')
  const [newColor, setNewColor] = useState(COLORES_PRESUPUESTO[0])
  const [newIcono, setNewIcono] = useState(ICONOS_PRESUPUESTO[0])

  // calcula el gasto real de cada categoria convirtiendo cada transaccion a la moneda actual
  const presupuestosConGasto = useMemo(() => {
    return presupuestos.map((p) => {
      const spent = transacciones
        .filter((t) => t.tipo === 'expense' && t.categoria.toLowerCase() === p.categoria.toLowerCase())
        .reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0)
      return { ...p, spent }
    })
  }, [presupuestos, transacciones, convertir])

  // totales para la tarjeta de resumen superior
  const totalBudget = presupuestosConGasto.reduce((s, p) => s + convertir(p.limiteMonthly, p.monedaOrigen), 0)
  const totalSpent = presupuestosConGasto.reduce((s, p) => s + (p.spent ?? 0), 0)
  const totalRemaining = totalBudget - totalSpent
  const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  function resetModal() {
    setNewCategoria('')
    setNewLimite('')
    setNewColor(COLORES_PRESUPUESTO[0])
    setNewIcono(ICONOS_PRESUPUESTO[0])
    setError('')
  }

  async function handleCrear() {
    if (!user) return
    if (!newCategoria || !newLimite) {
      setError('Completa todos los campos')
      return
    }
    setSaving(true)
    setError('')
    try {
      await agregarPresupuesto(user.id, {
        categoria: newCategoria,
        limiteMonthly: parseFloat(newLimite),
        mes,
        anio,
        colorHex: newColor,
        icono: newIcono,
        monedaOrigen: finanzas.moneda,
      })
      queryClient.invalidateQueries({ queryKey: ['presupuestos', user.id, mes, anio] })
      setShowModal(false)
      resetModal()
    } catch {
      setError('Error al crear el presupuesto. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(id: string) {
    if (!user) return
    await eliminarPresupuesto(id)
    queryClient.invalidateQueries({ queryKey: ['presupuestos', user.id, mes, anio] })
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestión de Presupuestos</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Rastrea y administra tus presupuestos de {mesNombre}</p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-start shrink-0">
          <SelectorMes />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Crear Presupuesto
          </button>
        </div>
      </div>

      {/* Banner de alerta cuando hay presupuestos en riesgo (≥80%) */}
      {notif.presupuesto && !loading && !bannerCerrado && (() => {
        const enRiesgo = presupuestosConGasto.filter((p) => {
          const limConv = convertir(p.limiteMonthly, p.monedaOrigen)
          const pct = limConv > 0 ? ((p.spent ?? 0) / limConv) * 100 : 0
          return pct >= 80
        })
        if (enRiesgo.length === 0) return null
        const msg = enRiesgo.length === 1
          ? `Tu presupuesto de ${enRiesgo[0].categoria} está al ${(((enRiesgo[0].spent ?? 0) / convertir(enRiesgo[0].limiteMonthly, enRiesgo[0].monedaOrigen)) * 100).toFixed(0)}% del límite.`
          : `${enRiesgo.length} presupuestos están cerca o sobre el límite este mes.`
        return (
          <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{msg}</p>
            </div>
            <button onClick={() => setBannerCerrado(true)} className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 flex-shrink-0 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })()}

      {/* Summary Card con totales reales */}
      <div className="bg-green-600 text-white rounded-xl p-5 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-5">
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <p className="text-green-200 text-xs sm:mb-1">Presupuesto Total</p>
            <p className="text-lg sm:text-2xl font-bold whitespace-nowrap text-right sm:text-left">{formatear(totalBudget)}</p>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <p className="text-green-200 text-xs sm:mb-1">Total Gastado</p>
            <p className="text-lg sm:text-2xl font-bold whitespace-nowrap text-right sm:text-left">{formatear(totalSpent)}</p>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <p className="text-green-200 text-xs sm:mb-1">Restante</p>
            <p className="text-lg sm:text-2xl font-bold whitespace-nowrap text-right sm:text-left">{formatear(totalRemaining)}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-green-200 mb-1.5">
            <span>Progreso General</span>
            <span>{overallProgress.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-green-500 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Budget Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : presupuestosConGasto.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
          No tienes presupuestos para {mesNombre}. ¡Crea el primero!
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {presupuestosConGasto.map((budget) => {
            const spent = budget.spent ?? 0
            const limiteConvertido = convertir(budget.limiteMonthly, budget.monedaOrigen)
            const pct = limiteConvertido > 0 ? (spent / limiteConvertido) * 100 : 0
            const isOver = pct > 100
            const isWarning = pct >= 80 && !isOver
            const remaining = limiteConvertido - spent

            return (
              <div key={budget.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border-l-4" style={{ borderLeftColor: budget.colorHex }}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{budget.icono}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{budget.categoria}</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 ml-6">
                      {formatear(spent)} / {formatear(budget.limiteMonthly, budget.monedaOrigen)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEliminar(budget.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* barra de progreso: verde / amarilla / roja segun el estado */}
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: isOver ? '#ef4444' : isWarning ? '#f59e0b' : budget.colorHex,
                    }}
                  />
                </div>

                {/* badge de estado segun cuanto se ha gastado */}
                <div className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg mb-2 ${
                  isOver ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : isWarning ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'bg-green-50 dark:bg-green-900/30 text-green-600'
                }`}>
                  {isOver ? (
                    <><AlertTriangle className="w-3 h-3" />Sobre presupuesto por {formatear(Math.abs(remaining))}</>
                  ) : isWarning ? (
                    <><AlertTriangle className="w-3 h-3" />{((remaining / limiteConvertido) * 100).toFixed(0)}% restante ({formatear(remaining)})</>
                  ) : (
                    <><TrendingDown className="w-3 h-3" />En camino • {formatear(remaining)} restante</>
                  )}
                </div>

                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Progreso</span>
                  <span className={isOver ? 'text-red-500 font-semibold' : isWarning ? 'text-amber-500 font-semibold' : 'text-green-600 font-semibold'}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* modal para crear un nuevo presupuesto */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Crear Nuevo Presupuesto</h3>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Categoría</label>
                <select
                  value={newCategoria}
                  onChange={(e) => setNewCategoria(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-slate-600 outline-none focus:ring-2 focus:ring-green-500 text-sm cursor-pointer"
                >
                  <option value="">Selecciona una categoría</option>
                  {finanzas.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Límite Mensual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
                    {SIMBOLOS[finanzas.moneda] || '$'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newLimite}
                    onChange={(e) => setNewLimite(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-16 py-3 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold select-none">
                    {finanzas.moneda}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ícono</label>
                <div className="flex gap-2 flex-wrap">
                  {ICONOS_PRESUPUESTO.map((icono) => (
                    <button
                      key={icono}
                      type="button"
                      onClick={() => setNewIcono(icono)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${newIcono === icono ? 'bg-green-100 ring-2 ring-green-500' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      {icono}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES_PRESUPUESTO.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={`w-7 h-7 rounded-full transition-transform ${newColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowModal(false); resetModal() }}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCrear}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  {saving ? 'Creando...' : 'Crear Presupuesto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
