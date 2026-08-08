'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, RotateCcw, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '@/context/AuthContext'
import { useFinanzas } from '@/context/FinanzasContext'
import { useQueryClient } from '@tanstack/react-query'
import { getTransacciones } from '@/lib/transacciones'
import { getPresupuestos } from '@/lib/presupuestos'
import { getMetas, diasRestantes } from '@/lib/metas'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ContextoFinanciero {
  nombre: string
  mes: string
  moneda: string
  ingresosMes: number
  gastosMes: number
  balanceMes: number
  categorias: { nombre: string; monto: number }[]
  presupuestos: { categoria: string; limite: number; gastado: number; porcentaje: number }[]
  metas: { nombre: string; objetivo: number; actual: number; porcentaje: number; diasRestantes: number }[]
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const SUGERENCIAS = [
  '¿Cómo va mi situación financiera este mes?',
  '¿En qué categoría gasto más?',
  '¿Voy a cumplir mis metas de ahorro?',
  '¿Estoy cerca del límite de algún presupuesto?',
]

export default function ChatIAPage() {
  const { user, nombre: nombreUsuario } = useAuth()
  const { finanzas, convertir } = useFinanzas()
  const queryClient = useQueryClient()
  const [contexto, setContexto] = useState<ContextoFinanciero | null>(null)
  const [cargandoContexto, setCargandoContexto] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // carga los datos reales del usuario desde Supabase al montar
  useEffect(() => {
    if (!user) return

    async function cargarContexto() {
      try {
        const ahora = new Date()
        const mes = ahora.getMonth() + 1
        const anio = ahora.getFullYear()
        const mesStr = `${MESES[mes - 1]} ${anio}`

        const [transacciones, presupuestos, metas] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['transacciones', user!.id],
            queryFn: () => getTransacciones(user!.id),
          }),
          queryClient.fetchQuery({
            queryKey: ['presupuestos', user!.id, mes, anio],
            queryFn: () => getPresupuestos(user!.id, mes, anio),
          }),
          queryClient.fetchQuery({
            queryKey: ['metas', user!.id],
            queryFn: () => getMetas(user!.id),
          }),
        ])

        // filtra solo transacciones del mes actual
        const prefijo = `${anio}-${String(mes).padStart(2, '0')}`
        const delMes = transacciones.filter((t) => t.fechaISO.startsWith(prefijo))

        const ingresosMes = delMes.filter((t) => t.tipo === 'income').reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0)
        const gastosMes   = delMes.filter((t) => t.tipo === 'expense').reduce((s, t) => s + convertir(t.monto, t.monedaOrigen), 0)

        // agrupa gastos por categoría con conversión
        const porCategoria: Record<string, number> = {}
        delMes.filter((t) => t.tipo === 'expense').forEach((t) => {
          porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + convertir(t.monto, t.monedaOrigen)
        })
        const categorias = Object.entries(porCategoria)
          .sort((a, b) => b[1] - a[1])
          .map(([nombre, monto]) => ({ nombre, monto }))

        // calcula gasto real por categoría con límite convertido
        const presupuestosConGasto = presupuestos.map((p) => {
          const gastado = porCategoria[p.categoria] || 0
          const limiteConv = convertir(p.limiteMonthly, p.monedaOrigen)
          const porcentaje = limiteConv > 0 ? Math.round((gastado / limiteConv) * 100) : 0
          return { categoria: p.categoria, limite: limiteConv, gastado, porcentaje }
        })

        // estado de metas con montos convertidos
        const metasResumen = metas.map((m) => {
          const objConv = convertir(m.objetivo, m.monedaOrigen)
          const actConv = convertir(m.actual, m.monedaOrigen)
          return {
            nombre: m.nombre,
            objetivo: objConv,
            actual: actConv,
            porcentaje: objConv > 0 ? Math.round((actConv / objConv) * 100) : 0,
            diasRestantes: diasRestantes(m.fechaLimite),
          }
        })

        const ctx: ContextoFinanciero = {
          nombre: nombreUsuario || 'Usuario',
          mes: mesStr,
          moneda: finanzas.moneda,
          ingresosMes,
          gastosMes,
          balanceMes: ingresosMes - gastosMes,
          categorias,
          presupuestos: presupuestosConGasto,
          metas: metasResumen,
        }

        setContexto(ctx)

        // mensaje de bienvenida personalizado
        const tieneGastos = gastosMes > 0
        const bienvenida = tieneGastos
          ? `¡Hola ${ctx.nombre}! Soy FinanSync AI. 💰\n\nYa cargué tu información financiera de ${mesStr} (${finanzas.moneda}):\n• Ingresos: ${ingresosMes.toFixed(2)} ${finanzas.moneda}\n• Gastos: ${gastosMes.toFixed(2)} ${finanzas.moneda}\n• Balance: ${(ingresosMes - gastosMes).toFixed(2)} ${finanzas.moneda}\n\nPuedes preguntarme sobre tus gastos, presupuestos, metas o pedirme consejos personalizados. ¿En qué te ayudo?`
          : `¡Hola ${ctx.nombre}! Soy FinanSync AI. 💰\n\nTodavía no tienes transacciones registradas este mes, pero puedo ayudarte con consejos financieros generales o explicarte cómo usar FinanSync al máximo. ¿Qué quieres saber?`

        setMessages([{ role: 'assistant', content: bienvenida }])
      } catch (err) {
        console.error('Error cargando contexto:', err)
        setMessages([{
          role: 'assistant',
          content: '¡Hola! Soy FinanSync AI. No pude cargar tus datos en este momento, pero puedo ayudarte con consejos financieros generales. ¿En qué te ayudo?',
        }])
      } finally {
        setCargandoContexto(false)
      }
    }

    cargarContexto()
  }, [user, convertir, finanzas.moneda])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, contexto }),
      })
      const data = await res.json()
      const reply = data.reply ?? 'Lo siento, ocurrió un error. Intenta de nuevo.'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'No pude conectarme. Verifica tu conexión e intenta de nuevo.' },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function resetChat() {
    if (!contexto) return
    const bienvenida = messages[0]
    setMessages(bienvenida ? [bienvenida] : [])
    setInput('')
    inputRef.current?.focus()
  }


  // pantalla de carga mientras obtiene datos de Supabase
  if (cargandoContexto) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 gap-4">
        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Cargando tu información financiera...</p>
          <p className="text-sm text-slate-400 mt-1">Conectando con Supabase</p>
        </div>
        <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 dark:text-white text-lg leading-tight">FinanSync AI</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Asesor financiero personal · Gemini 2.5 Flash</p>
          </div>
          <span className="ml-2 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-600 font-medium">
              {contexto ? 'Datos cargados' : 'En línea'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* resumen rápido del contexto */}
          {contexto && (
            <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
              <span>Ingresos <span className="font-semibold text-green-600">{contexto.ingresosMes.toFixed(0)} {contexto.moneda}</span></span>
              <span>Gastos <span className="font-semibold text-red-500">{contexto.gastosMes.toFixed(0)} {contexto.moneda}</span></span>
              <span>Balance <span className={`font-semibold ${contexto.balanceMes >= 0 ? 'text-green-600' : 'text-red-500'}`}>{contexto.balanceMes.toFixed(0)} {contexto.moneda}</span></span>
            </div>
          )}
          <button
            onClick={resetChat}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Nueva conversación
          </button>
        </div>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-green-500 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-sm shadow-sm border border-slate-100 dark:border-slate-700'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-1">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    h1: ({ children }) => <h1 className="font-bold text-base mt-2 mb-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="font-bold text-sm mt-2 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="font-semibold mt-1 mb-0.5">{children}</h3>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {/* Indicador escribiendo */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sugerencias rápidas — solo al inicio */}
      {messages.length === 1 && (
        <div className="px-6 pb-3 flex gap-2 flex-wrap justify-center">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full hover:border-green-400 hover:text-green-600 dark:hover:border-green-500 dark:hover:text-green-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregúntame sobre tus finanzas... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none border border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent max-h-32 overflow-y-auto"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-green-500 hover:bg-green-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Shift+Enter para nueva línea · Enter para enviar
        </p>
      </div>
    </div>
  )
}
