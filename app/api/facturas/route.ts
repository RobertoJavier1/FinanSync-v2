import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leerTextoFactura } from '@/lib/vision'
import { llamarVertex } from '@/lib/vertex'

// umbral para confiar en el OCR. por debajo de esto lo que saco Vision no da
// para interpretar una factura, asi que se prefiere mandarle la imagen al
// modelo en vez de trabajar con texto incompleto
const MINIMO_CARACTERES_OCR = 25

// la lista de respaldo se acorto al pasar a Vertex AI. con la API key de AI
// Studio cada modelo tenia su propia cuota diaria gratuita y agotarla era lo
// normal, asi que se probaban tres modelos distintos. en Vertex el consumo se
// cobra por token contra el proyecto y no hay cuota diaria que agotar, de modo
// que el unico caso que queda por cubrir es que el modelo este saturado (503).
// se deja un segundo modelo por si eso pasa
const MODELOS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const

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
// un 4xx no se arregla reintentando el mismo modelo (404 = ese modelo no existe
// en la region, 429 = limite de peticiones), asi que pasa directo al siguiente
async function llamarModelo(body: object): Promise<Response> {
  let ultimaRespuesta: Response | null = null

  for (const modelo of MODELOS) {
    for (let intento = 1; intento <= 2; intento++) {
      const respuesta = await llamarVertex(modelo, body)

      if (respuesta.ok) {
        console.log(`Vertex AI (${modelo}): OK`)
        return respuesta
      }
      ultimaRespuesta = respuesta

      if (respuesta.status < 500) {
        console.error(`Vertex AI (${modelo}) status ${respuesta.status}, pasando al siguiente modelo:`, await respuesta.clone().text())
        break
      }

      console.error(`Vertex AI (${modelo}) error, intento ${intento}/2:`, await respuesta.clone().text())
      if (intento < 2) await new Promise((r) => setTimeout(r, 1000))
    }
  }

  // todos los modelos fallaron; devolvemos la ultima respuesta para que el caller
  // pueda leer su status/mensaje
  return ultimaRespuesta!
}

export async function POST(req: Request) {
  try {
    // el middleware ya exige sesion, pero se valida tambien aqui para que la
    // ruta no dependa de una sola barrera (cada llamada a Vision y a Vertex se cobra)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const formData = await req.formData()
    const imagen = formData.get('imagen') as File | null
    const categoriasRaw = formData.get('categorias') as string | null

    if (!imagen) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 })
    }

    const categorias: string[] = categoriasRaw ? JSON.parse(categoriasRaw) : []
    const bytes = Buffer.from(await imagen.arrayBuffer())

    // paso 1: OCR con Cloud Vision.
    //
    // Vision no siempre saca texto util: una factura arrugada, con poca luz o
    // impresa en termico descolorido puede darle muy poco. Eso NO significa que
    // la imagen no sirva, porque el modelo multimodal muchas veces si la lee.
    // Por eso el OCR es solo un atajo barato: si devuelve texto suficiente se
    // usa, y si no (texto corto, vacio, o Vision caido) se manda la imagen
    // completa al modelo como antes. Nunca se rechaza una imagen aqui: quien
    // decide si es factura o no es el modelo, mas abajo.
    let textoFactura: string | null = null
    try {
      const texto = await leerTextoFactura(bytes)
      console.log(`Vision: ${texto.length} caracteres extraidos`)

      if (texto.length >= MINIMO_CARACTERES_OCR) {
        textoFactura = texto
      } else {
        console.log('Vision saco poco texto, se manda la imagen completa al modelo')
      }
    } catch (error) {
      console.error('Vision fallo, se manda la imagen completa al modelo:', error)
    }

    const instruccionCategoria = categorias.length
      ? `Elige la categoría más adecuada de esta lista exacta (usa el texto tal cual aparece): ${categorias.join(', ')}. Si ninguna encaja bien, usa null.`
      : 'No hay categorías disponibles, deja "categoria" en null.'

    const formatoRespuesta = `Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{
  "es_factura": true o false (false si no parece un recibo/factura o está demasiado incompleto/ilegible),
  "monto": número (el total pagado, sin símbolo de moneda) o null,
  "fecha": "YYYY-MM-DD" o null si no se distingue,
  "comercio": "nombre del comercio/tienda" o null,
  "categoria": string o null,
  "descripcion": "breve descripción, ej. nombre del comercio o tipo de compra" o null
}

${instruccionCategoria}`

    // paso 2: interpretacion. con texto se manda solo texto (mucho mas barato
    // en tokens); sin texto se manda la imagen igual que antes
    const partes = textoFactura
      ? [{
          text: `Analiza el siguiente texto, extraído por OCR de una factura o recibo de compra, y extrae los datos.

--- TEXTO DE LA FACTURA ---
${textoFactura}
--- FIN DEL TEXTO ---

${formatoRespuesta}
Si el texto no corresponde a una factura o está demasiado incompleto, responde con "es_factura": false y el resto de campos en null.`,
        }]
      : [
          {
            text: `Analiza esta imagen de una factura o recibo de compra y extrae los datos.

${formatoRespuesta}
Si la imagen está borrosa, incompleta o no es una factura, responde con "es_factura": false y el resto de campos en null.`,
          },
          { inline_data: { mime_type: imagen.type || 'image/jpeg', data: bytes.toString('base64') } },
        ]

    const res = await llamarModelo({
      contents: [{ role: 'user', parts: partes }],
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Error de Vertex AI:', err)
      return NextResponse.json({ error: 'Error al analizar la factura' }, { status: 500 })
    }

    const data = await res.json()
    const textoRespuesta: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    let resultado: FacturaExtraida
    try {
      resultado = JSON.parse(limpiarJSON(textoRespuesta))
    } catch {
      console.error('No se pudo parsear la respuesta del modelo:', textoRespuesta)
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
