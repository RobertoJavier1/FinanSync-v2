// Acceso a los modelos de Gemini a través de Vertex AI.
//
// El modelo es el mismo; lo que cambia es cómo se autentica. La API key de AI
// Studio es una llave suelta que no distingue quién la usa: cualquiera que la
// tenga puede gastar la cuota. Vertex en cambio usa la cuenta de servicio del
// proyecto finansync-runtime (la misma de Vision) y pide un token OAuth de corta
// duración, así que el acceso se controla con IAM y se puede revocar.
//
// Requisitos en Google Cloud:
//   - habilitar la API "Vertex AI" en el proyecto
//   - dar a la cuenta de servicio el rol roles/aiplatform.user
//
// Variables de entorno (cuenta finansync-runtime, ver lib/google-auth.ts):
//   GCP_RUNTIME_PROJECT_ID, GCP_RUNTIME_CLIENT_EMAIL, GCP_RUNTIME_PRIVATE_KEY
//   VERTEX_LOCATION -> region del endpoint, por defecto global
import { GoogleAuth } from 'google-auth-library'
import { credencialesRuntime, proyectoRuntime } from '@/lib/google-auth'

// por defecto se usa el endpoint global porque los modelos nuevos (gemini-3.8-flash)
// no estan publicados en las regiones: en us-central1 devuelven 404
const LOCATION = process.env.VERTEX_LOCATION || 'global'

// modelos que usan las rutas de IA, en orden de preferencia. el segundo es el
// respaldo: Vertex reparte la capacidad por modelo entre todos sus clientes, y
// un modelo recien salido como 3.8-flash puede responder 429 aunque el
// proyecto casi no lo use. 3.5-flash tiene su propia capacidad y soporte hasta
// mayo de 2027 o despues
export const MODELOS_GEMINI = ['gemini-3.8-flash', 'gemini-3.5-flash'] as const

// tiempo maximo por intento. sin esto una peticion saturada llego a tardar 69 s
// en devolver el 429; es mejor cortar y pasar al siguiente modelo
const TIEMPO_LIMITE_MS = 25_000

// el cliente de auth guarda el token en memoria y solo lo renueva cuando
// expira, así que conviene crearlo una vez y reutilizarlo entre peticiones
let auth: GoogleAuth | null = null

function getAuth(): GoogleAuth {
  if (!auth) {
    auth = new GoogleAuth({
      ...credencialesRuntime(),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
  }
  return auth
}

function urlVertex(modelo: string, proyecto: string): string {
  // el endpoint global no lleva la region como prefijo del host
  const host = LOCATION === 'global'
    ? 'aiplatform.googleapis.com'
    : `${LOCATION}-aiplatform.googleapis.com`
  return `https://${host}/v1/projects/${proyecto}` +
    `/locations/${LOCATION}/publishers/google/models/${modelo}:generateContent`
}

/**
 * Llama a un modelo de Gemini en Vertex AI.
 *
 * Recibe y devuelve lo mismo que la llamada actual a generativelanguage: el
 * body con "contents" y la Response cruda. Así los endpoints que migren solo
 * cambian a quién le hablan, no cómo arman la petición ni cómo leen la
 * respuesta.
 */
export async function llamarVertex(modelo: string, body: object, signal?: AbortSignal): Promise<Response> {
  const proyecto = proyectoRuntime()
  if (!proyecto) {
    throw new Error('Falta GCP_RUNTIME_PROJECT_ID para llamar a Vertex AI')
  }

  const token = await getAuth().getAccessToken()
  if (!token) {
    throw new Error('No se pudo obtener el token de la cuenta de servicio')
  }

  return fetch(urlVertex(modelo, proyecto), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
}

/**
 * Llama a Vertex AI probando cada modelo de la lista en orden.
 *
 * Dentro de un mismo modelo reintenta solo errores de servidor (5xx, ej. 503
 * "high demand"), con una espera corta entre intentos. Un 4xx no se arregla
 * reintentando el mismo modelo (404 = ese modelo no existe en la region, 429 =
 * capacidad agotada), y si se pasa el tiempo limite tampoco tiene caso esperar
 * otra vez, asi que en esos casos pasa directo al siguiente modelo.
 */
export async function llamarVertexConRespaldo(
  body: object,
  modelos: readonly string[] = MODELOS_GEMINI,
): Promise<Response> {
  let ultimaRespuesta: Response | null = null

  for (const modelo of modelos) {
    for (let intento = 1; intento <= 2; intento++) {
      let respuesta: Response
      try {
        respuesta = await llamarVertex(modelo, body, AbortSignal.timeout(TIEMPO_LIMITE_MS))
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          console.error(`Vertex AI (${modelo}) no respondio en ${TIEMPO_LIMITE_MS / 1000} s, pasando al siguiente modelo`)
          ultimaRespuesta = Response.json({ error: 'Tiempo de espera agotado' }, { status: 504 })
          break
        }
        throw error
      }

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

  // todos los modelos fallaron; se devuelve la ultima respuesta para que el
  // caller pueda leer su status/mensaje
  return ultimaRespuesta!
}
