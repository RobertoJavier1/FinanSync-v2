// Lectura de texto (OCR) de las imágenes de factura con Cloud Vision.
//
// Separa el OCR de la interpretación: Vision extrae el texto crudo, que es una
// operación barata y determinista, y solo ese texto se le manda al modelo para
// que lo estructure. Antes se mandaba la imagen completa, que consume muchos
// más tokens de la cuota de Gemini por cada factura.
//
// Usa la misma cuenta de servicio que Cloud Storage (variables GCS_*), así que
// no hay credenciales nuevas: solo hay que habilitar la API de Cloud Vision en
// el proyecto y que la cuenta de servicio pueda consumirla.
import { ImageAnnotatorClient } from '@google-cloud/vision'

// el cliente se crea una sola vez y se reutiliza entre peticiones; crearlo en
// cada llamada abriría una conexión nueva y volvería a firmar el token
let cliente: ImageAnnotatorClient | null = null

function getCliente(): ImageAnnotatorClient {
  if (!cliente) {
    cliente = new ImageAnnotatorClient({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        // el .env guarda los saltos de línea como "\n" literal; hay que
        // convertirlos a saltos de línea reales para que la clave sea válida
        private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    })
  }
  return cliente
}

/**
 * Devuelve el texto que Vision encuentra en la imagen, o cadena vacía si no
 * detecta ninguno (imagen borrosa, foto que no es un documento, etc.).
 *
 * Usa documentTextDetection y no textDetection porque está afinado para
 * documentos densos como los tickets de compra, donde importa el orden de las
 * líneas y no solo las palabras sueltas.
 *
 * Si la llamada falla (API deshabilitada, credenciales, red) lanza el error
 * para que el caller decida qué hacer.
 */
export async function leerTextoFactura(bytes: Buffer): Promise<string> {
  const [resultado] = await getCliente().documentTextDetection({
    image: { content: bytes },
  })
  return resultado.fullTextAnnotation?.text?.trim() ?? ''
}
