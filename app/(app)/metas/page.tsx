'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Calendar, X, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNotif } from '@/context/NotifContext'
import { useFinanzas } from '@/context/FinanzasContext'

const SIMBOLOS: Record<string, string> = {
  MXN: '$', USD: '$', EUR: '€', GTQ: 'Q', COP: '$', ARS: '$',
}
import {
  getMetas, agregarMeta, eliminarMeta, agregarContribucion,
  Meta, COLORES_META, ICONOS_META, formatearFechaMeta, diasRestantes,
} from '@/lib/metas'
import { agregarTransaccion } from '@/lib/transacciones'
import { useTransacciones } from '@/hooks/useTransacciones'
import { useQueryClient } from '@tanstack/react-query'

export default function MetasPage() {
  const { user } = useAuth()
  const { notif } = useNotif()
  const { finanzas, formatear, convertir, convertirEntre } = useFinanzas()
  const [metas, setMetas] = useState<Meta[]>([])
  const { data: transactions = [] } = useTransacciones(user?.id)
  const queryClient = useQueryClient()
  const [bannersCerrados, setBannersCerrados] = useState<Set<string>>(new Set())

  function cerrarBanner(key: string) {
    setBannersCerrados((prev) => new Set(prev).add(key))
  }
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // campos del formulario para crear meta
  const [newNombre, setNewNombre] = useState('')
  const [newObjetivo, setNewObjetivo] = useState('')
  const [newFecha, setNewFecha] = useState('')
  const [newColor, setNewColor] = useState(COLORES_META[0])
  const [newIcono, setNewIcono] = useState(ICONOS_META[0])

  // estado del modal de contribucion: que meta se esta editando y cuanto se va a agregar
  const [contribucionMeta, setContribucionMeta] = useState<Meta | null>(null)
  const [contribucionMonto, setContribucionMonto] = useState('')
  const [errorContribucion, setErrorContribucion] = useState('')

  // carga las metas del usuario desde Supabase al montar el componente; las
  // transacciones vienen de la cache compartida via useTransacciones
  useEffect(() => {
    if (!user) return
    getMetas(user.id)
      .then(setMetas)
      .finally(() => setLoading(false))
  }, [user])

  const mesActual = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

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

  const saldoDisponible = Math.max(0, ingresosMes - gastosMes)

  // totales para la tarjeta de resumen superior
  const totalObjetivo = metas.reduce((s, m) => s + convertir(m.objetivo, m.monedaOrigen), 0)
  const totalAhorrado = metas.reduce((s, m) => s + convertir(m.actual, m.monedaOrigen), 0)
  const totalRestante = totalObjetivo - totalAhorrado
  const overallProgress = totalObjetivo > 0 ? (totalAhorrado / totalObjetivo) * 100 : 0

  function resetModal() {
    setNewNombre('')
    setNewObjetivo('')
    setNewFecha('')
    setNewColor(COLORES_META[0])
    setNewIcono(ICONOS_META[0])
    setError('')
  }

  async function handleCrear() {
    if (!user) return
    if (!newNombre || !newObjetivo) {
      setError('Completa los campos obligatorios')
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = await agregarMeta(user.id, {
        nombre: newNombre,
        objetivo: parseFloat(newObjetivo),
        actual: 0,
        fechaLimite: newFecha,
        colorHex: newColor,
        icono: newIcono,
        monedaOrigen: finanzas.moneda,
      })
      setMetas((prev) => [...prev, {
        id, uid: user.id,
        nombre: newNombre,
        objetivo: parseFloat(newObjetivo),
        actual: 0,
        fechaLimite: newFecha,
        colorHex: newColor,
        icono: newIcono,
        completada: false,
        monedaOrigen: finanzas.moneda,
      }])
      setShowModal(false)
      resetModal()
    } catch {
      setError('Error al crear la meta. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(id: string) {
    // actualiza estado local inmediatamente antes de eliminar en la base de datos
    setMetas((prev) => prev.filter((m) => m.id !== id))
    await eliminarMeta(id)
  }

  async function handleContribucion() {
    if (!contribucionMeta || !contribucionMonto) return
    const monto = parseFloat(contribucionMonto)
    if (isNaN(monto) || monto <= 0) {
      setErrorContribucion('Ingresa un monto válido')
      return
    }
    const restante = Math.max(0,
      convertir(contribucionMeta.objetivo, contribucionMeta.monedaOrigen) -
      convertir(contribucionMeta.actual, contribucionMeta.monedaOrigen)
    )
    if (ingresosMes <= 0) {
      setErrorContribucion('No tienes ingresos este mes. Registra un ingreso antes de aportar.')
      return
    }
    if (saldoDisponible <= 0) {
      setErrorContribucion('Tus gastos ya superan tus ingresos este mes. No hay saldo disponible.')
      return
    }
    if (Math.round(monto * 100) > Math.round(restante * 100)) {
      setErrorContribucion(`Solo faltan ${formatear(restante)} para completar la meta`)
      return
    }
    if (Math.round(monto * 100) > Math.round(saldoDisponible * 100)) {
      setErrorContribucion(`El aporte excede tu saldo disponible este mes (${formatear(saldoDisponible)})`)
      return
    }
    // el usuario ingresa en su moneda actual; se convierte a la moneda origen de la meta
    // para que el valor guardado en la base de datos siempre esté en la misma unidad que el objetivo
    const montoEnMonedaOrigen = convertirEntre(monto, finanzas.moneda, contribucionMeta.monedaOrigen)
    const nuevoActual = contribucionMeta.actual + montoEnMonedaOrigen
    setMetas((prev) => prev.map((m) =>
      m.id === contribucionMeta.id
        ? { ...m, actual: nuevoActual, completada: m.objetivo > 0 && nuevoActual >= m.objetivo }
        : m
    ))
    await agregarContribucion(contribucionMeta.id, nuevoActual)

    // registrar el aporte como gasto en transacciones (igual que Android)
    // para que el saldo disponible se descuente y aparezca en el historial
    const fechaISO = new Date().toISOString().split('T')[0]
    await agregarTransaccion(user!.id, {
      descripcion: `Aporte a la meta ${contribucionMeta.nombre}`,
      categoria: 'Ahorro',
      fechaISO,
      monto,
      tipo: 'expense',
      monedaOrigen: finanzas.moneda,
    })
    queryClient.invalidateQueries({ queryKey: ['transacciones', user!.id] })

    setContribucionMeta(null)
    setContribucionMonto('')
    setErrorContribucion('')
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Metas de Ahorro</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Rastrea tu progreso hacia tus metas financieras</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Crear Meta
        </button>
      </div>

      {/* Banners de progreso de metas: 100%, 75% y 50% */}
      {notif.metas && !loading && (() => {
        const completadas = metas.filter((m) => m.completada)
        const al75 = metas.filter((m) => {
          if (m.completada) return false
          const pct = m.objetivo > 0 ? (m.actual / m.objetivo) * 100 : 0
          return pct >= 75
        })
        const al50 = metas.filter((m) => {
          if (m.completada) return false
          const pct = m.objetivo > 0 ? (m.actual / m.objetivo) * 100 : 0
          return pct >= 50 && pct < 75
        })
        if (completadas.length === 0 && al75.length === 0 && al50.length === 0) return null
        return (
          <div className="space-y-2">
            {completadas.length > 0 && !bannersCerrados.has('completadas') && (
              <div className="flex items-center justify-between gap-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg leading-none">🎉</span>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    {completadas.length === 1
                      ? `¡Completaste tu meta "${completadas[0].nombre}"!`
                      : `¡Completaste ${completadas.length} metas de ahorro!`}
                  </p>
                </div>
                <button onClick={() => cerrarBanner('completadas')} className="text-green-400 hover:text-green-600 dark:hover:text-green-300 flex-shrink-0 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {al75.length > 0 && !bannersCerrados.has('al75') && (
              <div className="flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg leading-none">📈</span>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    {al75.length === 1
                      ? `"${al75[0].nombre}" está al ${Math.floor((al75[0].actual / al75[0].objetivo) * 100)}% — ¡casi lista!`
                      : `${al75.length} metas superaron el 75% de su objetivo.`}
                  </p>
                </div>
                <button onClick={() => cerrarBanner('al75')} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex-shrink-0 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {al50.length > 0 && !bannersCerrados.has('al50') && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg leading-none">💪</span>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {al50.length === 1
                      ? `"${al50[0].nombre}" está a la mitad del camino (${Math.floor((al50[0].actual / al50[0].objetivo) * 100)}%).`
                      : `${al50.length} metas superaron el 50% de su objetivo.`}
                  </p>
                </div>
                <button onClick={() => cerrarBanner('al50')} className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 flex-shrink-0 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Summary Card con totales reales */}
      <div className="bg-green-600 text-white rounded-xl p-6">
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-green-200 text-xs mb-1">Monto Total de Metas</p>
            <p className="text-2xl font-bold">{formatear(totalObjetivo)}</p>
          </div>
          <div>
            <p className="text-green-200 text-xs mb-1">Total Ahorrado</p>
            <p className="text-2xl font-bold">{formatear(totalAhorrado)}</p>
          </div>
          <div>
            <p className="text-green-200 text-xs mb-1">Restante</p>
            <p className="text-2xl font-bold">{formatear(totalRestante)}</p>
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

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 animate-pulse h-52" />
          ))}
        </div>
      ) : metas.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
          No tienes metas de ahorro. ¡Crea la primera!
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {metas.map((meta) => {
            const objetivoConv = convertir(meta.objetivo, meta.monedaOrigen)
            const actualConv = convertir(meta.actual, meta.monedaOrigen)
            const pct = objetivoConv > 0 ? (actualConv / objetivoConv) * 100 : 0
            const remaining = objetivoConv - actualConv
            const dias = diasRestantes(meta.fechaLimite)
            const monthlyNeeded = dias > 0 ? Math.ceil(remaining / Math.ceil(dias / 30)) : 0

            return (
              <div key={meta.id} className="bg-white dark:bg-slate-800 rounded-xl p-5">
                {/* encabezado con icono, nombre y fecha limite */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: `${meta.colorHex}20` }}
                    >
                      {meta.icono}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{meta.nombre}</h3>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatearFechaMeta(meta.fechaLimite)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEliminar(meta.id)}
                    className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* barra de progreso con el color de la meta */}
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Progreso</span>
                  <span>{Math.min(pct, 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: meta.colorHex }}
                  />
                </div>

                {/* montos actual y objetivo */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-slate-400 dark:text-slate-500 text-xs">Actual</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatear(meta.actual, meta.monedaOrigen)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 dark:text-slate-500 text-xs">Meta</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatear(meta.objetivo, meta.monedaOrigen)}</p>
                  </div>
                </div>

                {/* detalles: restante, dias y promedio mensual necesario */}
                <div className="space-y-1.5 text-xs border-t border-slate-100 dark:border-slate-700 pt-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Restante</span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{formatear(Math.max(0, remaining))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Días hasta la fecha límite</span>
                    <span className="font-medium" style={{ color: meta.colorHex }}>{dias} días</span>
                  </div>
                  {monthlyNeeded > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Promedio mensual necesario</span>
                      <span className="text-slate-700 dark:text-slate-200 font-medium">{formatear(monthlyNeeded)}</span>
                    </div>
                  )}
                </div>

                {/* boton para agregar contribucion o badge de completada */}
                {meta.completada ? (
                  <div className="w-full py-2.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg font-medium text-sm text-center">
                    ¡Meta completada! 🎉
                  </div>
                ) : (
                  <button
                    onClick={() => { setContribucionMeta(meta); setContribucionMonto('') }}
                    className="w-full py-2.5 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: meta.colorHex }}
                  >
                    Agregar Contribución
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* modal para crear una nueva meta */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Crear Meta de Ahorro</h3>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nombre de la Meta *</label>
                <input
                  type="text"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="ej., Vacaciones, Auto Nuevo"
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Monto Objetivo *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
                    {SIMBOLOS[finanzas.moneda] || '$'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newObjetivo}
                    onChange={(e) => setNewObjetivo(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-16 py-3 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold select-none">
                    {finanzas.moneda}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Fecha Límite</label>
                <input
                  type="date"
                  value={newFecha}
                  onChange={(e) => setNewFecha(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ícono</label>
                <div className="flex gap-2 flex-wrap">
                  {ICONOS_META.map((icono) => (
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
                  {COLORES_META.map((color) => (
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
                  {saving ? 'Creando...' : 'Crear Meta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* modal para agregar una contribucion a una meta existente */}
      {contribucionMeta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Agregar Contribución</h3>
              <button onClick={() => { setContribucionMeta(null); setErrorContribucion('') }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">
              Meta: <span className="font-semibold text-slate-700 dark:text-slate-200">{contribucionMeta.nombre}</span>
              <br />
              Ahorrado: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatear(contribucionMeta.actual, contribucionMeta.monedaOrigen)}</span> / {formatear(contribucionMeta.objetivo, contribucionMeta.monedaOrigen)}
            </p>
            <p className={`text-xs font-semibold mb-4 ${ingresosMes > 0 && saldoDisponible > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {ingresosMes <= 0
                ? '⚠️ Sin ingresos este mes. Registra un ingreso para poder aportar.'
                : `💰 Disponible este mes: ${formatear(saldoDisponible)}`}
            </p>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto a aportar</span>
              {ingresosMes > 0 && saldoDisponible > 0 && (() => {
                const restante = Math.max(0,
                  convertir(contribucionMeta.objetivo, contribucionMeta.monedaOrigen) -
                  convertir(contribucionMeta.actual, contribucionMeta.monedaOrigen)
                )
                if (restante <= 0) return null
                const autoMonto = Math.min(restante, saldoDisponible)
                return (
                  <button
                    type="button"
                    onClick={() => { setContribucionMonto(parseFloat(autoMonto.toFixed(2)).toString()); setErrorContribucion('') }}
                    className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline"
                  >
                    Completar {formatear(autoMonto)}
                  </button>
                )
              })()}
            </div>
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
                {SIMBOLOS[finanzas.moneda] || '$'}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={contribucionMonto}
                onChange={(e) => { setContribucionMonto(e.target.value); setErrorContribucion('') }}
                placeholder="0.00"
                disabled={ingresosMes <= 0}
                className="w-full pl-8 pr-16 py-3 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-green-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold select-none">
                {finanzas.moneda}
              </span>
            </div>
            {errorContribucion && (
              <p className="text-red-500 text-xs font-semibold mb-3">⚠️ {errorContribucion}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setContribucionMeta(null); setErrorContribucion('') }}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleContribucion}
                disabled={ingresosMes <= 0 || saldoDisponible <= 0}
                className="flex-1 py-2.5 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: contribucionMeta.colorHex }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
