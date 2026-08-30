// Acceso a Google Cloud Storage para guardar las imágenes de facturas.
//
// El bucket es privado (impide acceso público), así que la app nunca guarda
// una URL directa: guarda el "path" del objeto y, para mostrarlo, pide una
// URL firmada de corta duración a través de este módulo.
import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    // el .env guarda los saltos de línea como "\n" literal; hay que
    // convertirlos a saltos de línea reales para que la clave sea válida
    private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
})

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)

export async function subirFactura(path: string, bytes: Buffer, contentType: string): Promise<void> {
  await bucket.file(path).save(bytes, { contentType })
}

export async function urlFirmadaFactura(path: string): Promise<string> {
  const [url] = await bucket.file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutos
  })
  return url
}
