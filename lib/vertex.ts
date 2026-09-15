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
//   VERTEX_LOCATION -> region del endpoint, por defecto us-central1
import { GoogleAuth } from 'google-auth-library'
import { credencialesRuntime, proyectoRuntime } from '@/lib/google-auth'

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'

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
  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${proyecto}` +
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
export async function llamarVertex(modelo: string, body: object): Promise<Response> {
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
  })
}
