import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

export async function POST(req: Request) {
  try {
    // recibe los datos financieros del mes enviados desde perspectivas-ia/page.tsx
    const { ingresos, gastos, categorias, presupuestos, metas, moneda = 'GTQ' } = await req.json()

    // construye la seccion de presupuestos solo si hay datos, para no confundir a gemini con texto vacio
    const seccionPresupuestos = presupuestos?.length > 0
      ? `\nPresupuestos del mes:\n${presupuestos.map((p: { categoria: string; limite: number; gastado: number; porcentaje: number }) =>
          `- ${p.categoria}: ${p.gastado} ${moneda} gastado de ${p.limite} ${moneda} (${p.porcentaje}%)`
        ).join('\n')}`
      : ''

    // construye la seccion de metas solo si hay datos, igual que presupuestos
    const seccionMetas = metas?.length > 0
      ? `\nMetas de ahorro:\n${metas.map((m: { nombre: string; objetivo: number; actual: number; porcentaje: number; diasRestantes: number; completada: boolean }) =>
          m.completada
            ? `- ${m.nombre}: ¡Completada! (${m.actual} ${moneda} de ${m.objetivo} ${moneda})`
            : `- ${m.nombre}: ${m.actual} ${moneda} de ${m.objetivo} ${moneda} (${m.porcentaje}%) — ${m.diasRestantes} días restantes`
        ).join('\n')}`
      : ''

    // prompt de una sola vuelta, no hay historial — gemini responde con exactamente 5 perspectivas en JSON
    const prompt = `
Eres un asesor financiero personal. Analiza los siguientes datos del usuario y genera exactamente 5 perspectivas útiles y específicas basadas en su situación real.

Datos del mes actual (moneda: ${moneda}):
- Ingresos: ${ingresos} ${moneda}
- Gastos: ${gastos} ${moneda}
- Categorías de gasto: ${categorias.length > 0 ? categorias.join(', ') : 'ninguna'}
${seccionPresupuestos}
${seccionMetas}

Instrucciones:
- Mezcla observaciones, alertas y recomendaciones accionables en una sola lista.
- Si hay presupuestos cerca del límite o superados, menciónalos específicamente.
- Si hay metas con poco progreso o poco tiempo restante, menciónalas específicamente.
- El campo "ahorro" es opcional: inclúyelo solo cuando la perspectiva sea una recomendación que permita estimar un ahorro mensual concreto en ${moneda}. Si no aplica, omite el campo o ponlo en 0.

Responde ÚNICAMENTE con este JSON, sin texto adicional:
{
  "perspectivas": [
    { "titulo": "...", "descripcion": "...", "tipo": "alerta" | "positivo" | "sugerencia", "ahorro": 0 },
    { "titulo": "...", "descripcion": "...", "tipo": "alerta" | "positivo" | "sugerencia", "ahorro": 0 },
    { "titulo": "...", "descripcion": "...", "tipo": "alerta" | "positivo" | "sugerencia", "ahorro": 0 },
    { "titulo": "...", "descripcion": "...", "tipo": "alerta" | "positivo" | "sugerencia", "ahorro": 0 },
    { "titulo": "...", "descripcion": "...", "tipo": "alerta" | "positivo" | "sugerencia", "ahorro": 0 }
  ]
}
`

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Error de Gemini:', err)
      return NextResponse.json({ error: 'Error al generar perspectivas' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.candidates[0].content.parts[0].text
    // gemini a veces envuelve el JSON en bloques ```json ... ```, se limpian antes de parsear
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json({ perspectivas: parsed.perspectivas })
  } catch (error) {
    console.error('Error llamando a Gemini:', error)
    return NextResponse.json({ error: 'Error al generar perspectivas' }, { status: 500 })
  }
}
