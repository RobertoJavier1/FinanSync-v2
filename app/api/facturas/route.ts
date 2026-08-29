import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

// el chat (app/api/chat/route.ts) usa gemini-2.5-flash. la cuota gratis es de 20
// peticiones/dia POR MODELO (no compartida entre modelos), asi que facturas usa
// otros modelos primero para no competir por la misma cuota que el chat, y deja
// 2.5-flash como ultimo recurso. lista confirmada contra /v1beta/models (algunos
// nombres como gemini-1.5-flash, gemini-2.0-flash y gemini-2.5-flash-lite ya no
// estan disponibles para esta cuenta)
const GEMINI_MODELOS = ['gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash'] as const

function urlGemini(modelo: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`
}

interface FacturaExtraida {
  es_factura: boolean
  monto: number | null
  fecha: string | null
  comercio: string | null
  categoria: string | null
  descripcion: string | null
}

// gemini a veces envuelve el JSON en ```json ... ``` aunque se le pida que no lo haga
function limpiarJSON(texto: string): string {
  return texto.replace(/```json\s*|```\s*/g, '').trim()
}

// prueba cada modelo en orden. dentro de un mismo modelo reintenta solo errores
// de servidor (5xx, ej. 503 "high demand"), con una espera corta entre intentos.
// un 429 (cuota de ESE modelo agotada) o cualquier otro 4xx no se arregla
// reintentando el mismo modelo, asi que pasa directo al siguiente
async function llamarGemini(body: object): Promise<Response> {
  let ultimaRespuesta: Response | null = null

  for (const modelo of GEMINI_MODELOS) {
    for (let intento = 1; intento <= 2; intento++) {
      const respuesta = await fetch(urlGemini(modelo), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (respuesta.ok) {
        console.log(`Gemini (${modelo}): OK`)
        return respuesta
      }
      ultimaRespuesta = respuesta

      if (respuesta.status < 500) {
        console.error(`Gemini (${modelo}) status ${respuesta.status}, pasando al siguiente modelo:`, await respuesta.clone().text())
        break // 429/4xx: no reintentar, pasar al siguiente modelo
      }

      console.error(`Gemini (${modelo}) error, intento ${intento}/2:`, await respuesta.clone().text())
      if (intento < 2) await new Promise((r) => setTimeout(r, 1000))
    }
  }

  // todos los modelos fallaron; devolvemos la ultima respuesta para que el caller
  // pueda leer su status/mensaje
  return ultimaRespuesta!
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const imagen = formData.get('imagen') as File | null
    const categoriasRaw = formData.get('categorias') as string | null

    if (!imagen) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 })
    }

    const categorias: string[] = categoriasRaw ? JSON.parse(categoriasRaw) : []
    const bytes = Buffer.from(await imagen.arrayBuffer())
    const base64 = bytes.toString('base64')

    const instruccionCategoria = categorias.length
      ? `Elige la categoría más adecuada de esta lista exacta (usa el texto tal cual aparece): ${categorias.join(', ')}. Si ninguna encaja bien, usa null.`
      : 'No hay categorías disponibles, deja "categoria" en null.'

    const prompt = `Analiza esta imagen de una factura o recibo de compra y extrae los datos.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{
  "es_factura": true o false (false si la imagen no parece un recibo/factura o está demasiado borrosa/ilegible),
  "monto": número (el total pagado, sin símbolo de moneda) o null,
  "fecha": "YYYY-MM-DD" o null si no se distingue,
  "comercio": "nombre del comercio/tienda" o null,
  "categoria": string o null,
  "descripcion": "breve descripción, ej. nombre del comercio o tipo de compra" o null
}

${instruccionCategoria}
Si la imagen está borrosa, incompleta o no es una factura, responde con "es_factura": false y el resto de campos en null.`

    const res = await llamarGemini({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: imagen.type || 'image/jpeg', data: base64 } },
          ],
        },
      ],
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error al analizar la factura' }, { status: 500 })
    }

    const data = await res.json()
    const textoRespuesta: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    let resultado: FacturaExtraida
    try {
      resultado = JSON.parse(limpiarJSON(textoRespuesta))
    } catch {
      console.error('No se pudo parsear la respuesta de Gemini:', textoRespuesta)
      return NextResponse.json({ error: 'No se pudo leer la factura, intenta con otra imagen' }, { status: 422 })
    }

    if (!resultado.es_factura) {
      return NextResponse.json({ error: 'La imagen no parece ser una factura legible' }, { status: 422 })
    }

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Factura OCR error:', error)
    return NextResponse.json({ error: 'Error al procesar la imagen' }, { status: 500 })
  }
}
