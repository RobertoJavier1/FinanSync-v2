// Lectura de texto (OCR) de las imágenes de factura con Cloud Vision.
//
// Separa el OCR de la interpretación: Vision extrae el texto crudo, que es una
// operación barata y determinista, y solo ese texto se le manda al modelo para
// que lo estructure. Antes se mandaba la imagen completa, que consume muchos
// más tokens de la cuota por cada factura.
//
// Usa la cuenta de servicio de runtime (finansync-runtime), la misma de Vertex
// AI, separada de la de Storage. Ver lib/google-auth.ts.
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { credencialesRuntime } from '@/lib/google-auth'

// el cliente se crea una sola vez y se reutiliza entre peticiones; crearlo en
// cada llamada abriría una conexión nueva y volvería a firmar el token
let cliente: ImageAnnotatorClient | null = null

function getCliente(): ImageAnnotatorClient {
  if (!cliente) {
    cliente = new ImageAnnotatorClient(credencialesRuntime())
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
