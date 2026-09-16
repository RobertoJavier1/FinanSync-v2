// Acceso a Google Cloud Storage para guardar las imágenes de facturas.
//
// El bucket es privado (impide acceso público), así que la app nunca guarda
// una URL directa: guarda el "path" del objeto y, para mostrarlo, pide una
// URL firmada de corta duración a través de este módulo.
//
// Usa la cuenta de servicio finansync-storage vía las variables GCS_* solo si
// están configuradas (desarrollo local). Si no, cae a las Application Default
// Credentials del entorno: en Cloud Run, la identidad asignada al servicio
// (finansync-runtime, que ya tiene el rol Storage Object Admin).
import { Storage, Bucket } from '@google-cloud/storage'

// el cliente y el bucket se crean la primera vez que hace falta, no al cargar
// el módulo: Next.js importa este archivo durante "next build" para analizar
// las rutas API, y en ese momento GCS_BUCKET_NAME todavía no existe (esa
// variable solo se define en tiempo de ejecución, en Cloud Run)
let bucket: Bucket | null = null

function getBucket(): Bucket {
  if (!bucket) {
    const email = process.env.GCS_CLIENT_EMAIL
    const clave = process.env.GCS_PRIVATE_KEY

    const storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      ...(email && clave
        ? {
            credentials: {
              client_email: email,
              // el .env guarda los saltos de línea como "\n" literal; hay que
              // convertirlos a saltos de línea reales para que la clave sea válida
              private_key: clave.replace(/\\n/g, '\n'),
            },
          }
        : {}),
    })

    bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)
  }
  return bucket
}

export async function subirFactura(path: string, bytes: Buffer, contentType: string): Promise<void> {
  await getBucket().file(path).save(bytes, { contentType })
}

export async function urlFirmadaFactura(path: string): Promise<string> {
  const [url] = await getBucket().file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutos
  })
  return url
}
