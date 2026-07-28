import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// credenciales del proyecto firebase, se leen desde variables de entorno
// para no exponer las claves directamente en el codigo
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// se evita inicializar firebase mas de una vez en hot-reload de next.js
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// servicio de autenticacion (login, registro, google, etc.)
export const auth = getAuth(app)

// base de datos firestore para guardar datos del usuario
export const db = getFirestore(app)
