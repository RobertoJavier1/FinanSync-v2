import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

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

// construye el system prompt con instrucciones base y los datos financieros del usuario
// si no hay contexto solo se usan las instrucciones generales
function buildSystemPrompt(ctx: ContextoFinanciero | null): string {
  const base = `Eres FinanSync AI, el asesor financiero personal integrado en la app FinanSync.
Responde siempre en español, de forma clara, concisa y amigable.
Da consejos prácticos y específicos con números cuando sea útil.
Si te preguntan algo no relacionado con finanzas, redirige amablemente la conversación.`

  if (!ctx) return base

  const m = ctx.moneda || 'GTQ'
  const categoriasStr = ctx.categorias.length
    ? ctx.categorias.map((c) => `  - ${c.nombre}: ${c.monto.toFixed(2)} ${m}`).join('\n')
    : '  - Sin gastos registrados'

  const presupuestosStr = ctx.presupuestos.length
    ? ctx.presupuestos
        .map((p) => `  - ${p.categoria}: gastado ${p.gastado.toFixed(2)} ${m} de ${p.limite.toFixed(2)} ${m} (${p.porcentaje}%)${p.porcentaje >= 100 ? ' ⚠️ EXCEDIDO' : p.porcentaje >= 80 ? ' ⚠️ cerca del límite' : ''}`)
        .join('\n')
    : '  - Sin presupuestos configurados'

  const metasStr = ctx.metas.length
    ? ctx.metas
        .map((mt) => `  - ${mt.nombre}: ${mt.actual.toFixed(2)} ${m} de ${mt.objetivo.toFixed(2)} ${m} (${mt.porcentaje}%) — ${mt.diasRestantes} días restantes`)
        .join('\n')
    : '  - Sin metas configuradas'

  return `${base}

DATOS FINANCIEROS REALES DEL USUARIO (${ctx.mes}):
Nombre: ${ctx.nombre}
Moneda: ${m}
Ingresos del mes: ${ctx.ingresosMes.toFixed(2)} ${m}
Gastos del mes: ${ctx.gastosMes.toFixed(2)} ${m}
Balance del mes: ${ctx.balanceMes.toFixed(2)} ${m}
Tasa de ahorro: ${ctx.ingresosMes > 0 ? ((ctx.balanceMes / ctx.ingresosMes) * 100).toFixed(1) : 0}%

Gastos por categoría este mes:
${categoriasStr}

Estado de presupuestos:
${presupuestosStr}

Metas de ahorro:
${metasStr}

Usa estos datos reales para dar respuestas personalizadas y específicas al usuario. Cuando el usuario pregunte sobre su situación financiera, refiérete a estos números concretos.`
}

export async function POST(req: Request) {
  try {
    const { messages, contexto }: { messages: Message[]; contexto: ContextoFinanciero | null } =
      await req.json()

    // gemini usa 'model' en lugar de 'assistant' para identificar sus propios mensajes
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))

    // system_instruction es el campo de gemini para el prompt del sistema, va separado del historial
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: buildSystemPrompt(contexto) }] },
        contents,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error al procesar tu mensaje' }, { status: 500 })
    }

    // la respuesta de gemini viene en candidates[0].content.parts[0].text
    const data = await res.json()
    const reply: string = data.candidates[0].content.parts[0].text
    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Error al procesar tu mensaje' }, { status: 500 })
  }
}
