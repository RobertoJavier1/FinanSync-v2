import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

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

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: imagen.type || 'image/jpeg', data: base64 } },
            ],
          },
        ],
      }),
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
