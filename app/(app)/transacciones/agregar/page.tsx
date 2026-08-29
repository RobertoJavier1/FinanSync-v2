'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Check, Camera, Upload, X, FileText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { agregarTransaccion } from '@/lib/transacciones'

const SIMBOLOS: Record<string, string> = { MXN: '$', USD: '$', EUR: '€', GTQ: 'Q', COP: '$', ARS: '$' }

function hoyISO() {
  return new Date().toISOString().split('T')[0]
}

interface FacturaExtraida {
  monto: number | null
  fecha: string | null
  comercio: string | null
  categoria: string | null
  descripcion: string | null
}

export default function AgregarTransaccionPage() {
  const { user } = useAuth()
  const { finanzas } = useFinanzas()
  const router = useRouter()

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(hoyISO) // YYYY-MM-DD
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [facturaImagen, setFacturaImagen] = useState<File | null>(null)
  const [facturaPreviewUrl, setFacturaPreviewUrl] = useState<string | null>(null)
  const [analizandoFactura, setAnalizandoFactura] = useState(false)
  const [errorFactura, setErrorFactura] = useState('')
  const inputCamaraRef = useRef<HTMLInputElement>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  // libera el object URL anterior para no filtrar memoria al cambiar/quitar la imagen
  useEffect(() => {
    return () => {
      if (facturaPreviewUrl) URL.revokeObjectURL(facturaPreviewUrl)
    }
  }, [facturaPreviewUrl])

  function handleSeleccionarFactura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo despues de quitarlo
    if (!file) return
    if (facturaPreviewUrl) URL.revokeObjectURL(facturaPreviewUrl)
    setFacturaImagen(file)
    setFacturaPreviewUrl(URL.createObjectURL(file))
    analizarFactura(file) // analisis automatico en cuanto se elige/toma la foto
  }

  function handleQuitarFactura() {
    if (facturaPreviewUrl) URL.revokeObjectURL(facturaPreviewUrl)
    setFacturaImagen(null)
    setFacturaPreviewUrl(null)
    setErrorFactura('')
  }

  // manda la imagen a /api/facturas (Gemini vision) y autocompleta el formulario.
  // usa updates funcionales (prev => ...) porque esto es async: para cuando la
  // respuesta llega, el usuario ya pudo haber escrito algo mas en el formulario.
  async function analizarFactura(file: File) {
    setAnalizandoFactura(true)
    setErrorFactura('')
    try {
      const formData = new FormData()
      formData.append('imagen', file)
      formData.append('categorias', JSON.stringify(finanzas.categorias))

      const res = await fetch('/api/facturas', { method: 'POST', body: formData })
      const data: FacturaExtraida & { error?: string } = await res.json()

      if (!res.ok) {
        setErrorFactura(data.error || 'No se pudo analizar la factura')
        return
      }

      // solo rellena lo que el usuario dejo vacio, para no pisar lo que ya escribio
      if (data.monto != null) setAmount((prev) => prev || String(data.monto))
      if (data.descripcion) setDescription((prev) => prev || data.descripcion!)
      // la fecha ya trae un valor por defecto (hoy), asi que la tratamos como
      // "vacia" solo si el usuario no la ha cambiado todavia
      if (data.fecha) setDate((prev) => (prev === hoyISO() ? data.fecha! : prev))
      // solo aceptamos la categoria si es una que realmente existe en el select,
      // por si Gemini inventa un nombre que no esta en la lista que le mandamos
      if (data.categoria && finanzas.categorias.includes(data.categoria)) {
        setCategory((prev) => prev || data.categoria!)
      }
    } catch {
      setErrorFactura('No se pudo analizar la factura')
    } finally {
      setAnalizandoFactura(false)
    }
  }

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
      await agregarTransaccion(user.id, {
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
    <div className="p-4 md:p-6 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Link href="/transacciones">
          <button className="text-slate-600 hover:text-slate-800 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Agregar Transacción</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleGuardar} className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-8 space-y-6">
        {/* Escanear o subir factura */}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Factura (Opcional)
          </p>

          {!facturaPreviewUrl ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => inputCamaraRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-5 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-green-400 hover:text-green-500 transition-colors text-sm font-medium"
              >
                <Camera className="w-5 h-5" />
                Tomar foto
              </button>
              <button
                type="button"
                onClick={() => inputArchivoRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-5 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-green-400 hover:text-green-500 transition-colors text-sm font-medium"
              >
                <Upload className="w-5 h-5" />
                Subir imagen
              </button>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={facturaPreviewUrl}
                alt="Vista previa de la factura"
                className="w-full max-h-64 object-contain bg-slate-100 dark:bg-slate-900"
              />
              {/* overlay mientras Gemini analiza la imagen, tapa la foto para que quede claro que esta ocupado */}
              {analizandoFactura && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/60 text-white text-sm">
                  <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Analizando factura...
                </div>
              )}
              <button
                type="button"
                onClick={handleQuitarFactura}
                aria-label="Quitar factura"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/70 text-white hover:bg-slate-900/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-300">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{facturaImagen?.name}</span>
              </div>
            </div>
          )}

          {errorFactura ? (
            <p className="text-xs text-amber-500 mt-2">
              {errorFactura} — puedes llenar el formulario manualmente o{' '}
              <button
                type="button"
                onClick={() => facturaImagen && analizarFactura(facturaImagen)}
                className="underline font-medium hover:text-amber-600"
              >
                reintentar
              </button>
              .
            </p>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Al elegir la foto se intenta llenar el formulario automáticamente.
            </p>
          )}

          {/* inputs ocultos: capture=environment abre la camara directo en movil */}
          <input
            ref={inputCamaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleSeleccionarFactura}
            className="hidden"
          />
          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/*"
            onChange={handleSeleccionarFactura}
            className="hidden"
          />
        </div>

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
