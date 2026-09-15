// Credenciales de la cuenta de servicio de runtime (finansync-runtime).
//
// El proyecto usa dos cuentas de servicio distintas a propósito, siguiendo el
// principio de menor privilegio de IAM:
//
//   finansync-storage  -> solo Cloud Storage, para subir y firmar las imágenes
//                         de facturas (lib/gcs.ts)
//   finansync-runtime  -> las APIs de IA: Cloud Vision y Vertex AI
//                         (lib/vision.ts y lib/vertex.ts)
//
// Así, si una credencial se filtra, no da acceso a todo. Este módulo existe
// para que las dos librerías de IA lean las mismas variables y no se repita
// el arreglo de los saltos de línea de la clave privada.
//
// Variables de entorno:
//   GCP_RUNTIME_PROJECT_ID    -> "project_id" del JSON de la cuenta
//   GCP_RUNTIME_CLIENT_EMAIL  -> "client_email" del JSON
//   GCP_RUNTIME_PRIVATE_KEY   -> "private_key" del JSON, entre comillas dobles
//                                y con los "\n" tal cual vienen

// se declara como "type" y no como "interface" a proposito: las librerias de
// Google (ClientOptions, GoogleAuthOptions) llevan una firma de indice, y
// TypeScript solo se la infiere a los type alias. Con interface, pasarle este
// objeto al cliente de Vision no compila.
export type CredencialesSA = {
  projectId: string | undefined
  credentials: {
    client_email: string | undefined
    private_key: string | undefined
  }
}

/**
 * Devuelve las credenciales de la cuenta de runtime en el formato que esperan
 * las librerías de Google (@google-cloud/vision, google-auth-library).
 *
 * Mientras no estén configuradas las variables de runtime cae a las de Storage
 * para que el entorno de desarrollo siga funcionando, pero avisa en consola:
 * en producción las dos cuentas deben estar separadas.
 */
export function credencialesRuntime(): CredencialesSA {
  const proyecto = process.env.GCP_RUNTIME_PROJECT_ID
  const email = process.env.GCP_RUNTIME_CLIENT_EMAIL
  const clave = process.env.GCP_RUNTIME_PRIVATE_KEY

  if (!email || !clave) {
    console.warn(
      'GCP_RUNTIME_* no está configurada; usando la cuenta de Storage como respaldo. ' +
      'Configura la cuenta finansync-runtime antes de desplegar.',
    )
    return {
      projectId: process.env.GCS_PROJECT_ID,
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        // el .env guarda los saltos de línea como "\n" literal; hay que
        // convertirlos a saltos de línea reales para que la clave sea válida
        private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    }
  }

  return {
    projectId: proyecto ?? process.env.GCS_PROJECT_ID,
    credentials: {
      client_email: email,
      private_key: clave.replace(/\\n/g, '\n'),
    },
  }
}

/** Id del proyecto de Google Cloud contra el que se hacen las llamadas. */
export function proyectoRuntime(): string | undefined {
  return process.env.GCP_RUNTIME_PROJECT_ID || process.env.GCS_PROJECT_ID
}
