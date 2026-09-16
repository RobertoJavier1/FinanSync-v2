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
// Variables de entorno (solo hacen falta en desarrollo local; en Cloud Run no
// se configuran, ver más abajo):
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
  credentials?: {
    client_email: string
    private_key: string
  }
}

/**
 * Devuelve las credenciales de la cuenta de runtime en el formato que esperan
 * las librerías de Google (@google-cloud/vision, google-auth-library).
 *
 * Si no están configuradas las variables GCP_RUNTIME_*, no arma ningún objeto
 * de credenciales: las librerías de Google caen solas a las Application
 * Default Credentials (ADC) del entorno. En Cloud Run, esas ADC son la
 * identidad de la cuenta de servicio asignada al servicio (ver el deploy),
 * así que no hace falta ninguna llave privada en las variables de entorno de
 * producción. En local, ADC solo funciona si corriste
 * `gcloud auth application-default login`; si no, hay que poner las tres
 * variables GCP_RUNTIME_* en .env.local.
 */
export function credencialesRuntime(): CredencialesSA {
  const proyecto = process.env.GCP_RUNTIME_PROJECT_ID ?? process.env.GCS_PROJECT_ID
  const email = process.env.GCP_RUNTIME_CLIENT_EMAIL
  const clave = process.env.GCP_RUNTIME_PRIVATE_KEY

  if (!email || !clave) {
    return { projectId: proyecto }
  }

  return {
    projectId: proyecto,
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
