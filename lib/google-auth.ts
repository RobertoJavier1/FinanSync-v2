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
// Hay dos formas de autenticarse, y el módulo elige sola la que corresponde:
//
//   En Cloud Run no hay ninguna llave guardada. El servicio se ejecuta como la
//   cuenta finansync-runtime y las credenciales le llegan del entorno (lo que
//   Google llama Application Default Credentials). Es lo más seguro: no hay
//   archivo que filtrar ni llave que rotar.
//
//   En desarrollo local no existe esa identidad, así que se usa una llave JSON
//   puesta en variables de entorno.
//
// Variables de entorno (solo para desarrollo local):
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
  // ausente cuando se usa la identidad del propio servicio
  credentials?: {
    client_email: string | undefined
    private_key: string | undefined
  }
}

/**
 * Devuelve las opciones de autenticación en el formato que esperan las
 * librerías de Google (@google-cloud/vision, google-auth-library).
 *
 * Si hay llave en las variables de entorno la usa; si no, devuelve solo el
 * proyecto y deja que la librería tome la identidad del entorno. En Cloud Run
 * esa identidad es la cuenta de servicio del servicio, que es justo lo que se
 * quiere; en local sin llave fallará, y el mensaje de error lo dirá.
 */
export function credencialesRuntime(): CredencialesSA {
  const proyecto = proyectoRuntime()
  const email = process.env.GCP_RUNTIME_CLIENT_EMAIL
  const clave = process.env.GCP_RUNTIME_PRIVATE_KEY

  if (!email || !clave) {
    // sin llave: Application Default Credentials
    return { projectId: proyecto }
  }

  return {
    projectId: proyecto,
    credentials: {
      client_email: email,
      // el .env guarda los saltos de línea como "\n" literal; hay que
      // convertirlos a saltos de línea reales para que la clave sea válida
      private_key: clave.replace(/\\n/g, '\n'),
    },
  }
}

/**
 * Id del proyecto de Google Cloud contra el que se hacen las llamadas.
 * GOOGLE_CLOUD_PROJECT la define Cloud Run sola; las otras dos son para local.
 */
export function proyectoRuntime(): string | undefined {
  return process.env.GCP_RUNTIME_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCS_PROJECT_ID
}
