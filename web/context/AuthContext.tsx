'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

// define los valores que el contexto comparte con toda la app
interface AuthContextType {
  user: User | null  // usuario actual de Firebase, null si no hay sesion activa
  loading: boolean   // true mientras Firebase verifica si existe una sesion guardada
}

// valor inicial del contexto antes de que Firebase responda
const AuthContext = createContext<AuthContextType>({ user: null, loading: true })

// proveedor que envuelve toda la app y escucha cambios de sesion en tiempo real
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChanged se dispara automaticamente cuando:
    // - la app carga y restaura una sesion guardada en el navegador
    // - el usuario inicia sesion
    // - el usuario cierra sesion
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false) // Firebase ya respondio, dejamos de mostrar pantalla de carga
    })

    // cancela la suscripcion cuando el componente se desmonta para evitar memory leaks
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// hook personalizado para acceder al usuario desde cualquier componente sin
// necesidad de importar useContext y AuthContext en cada archivo
export function useAuth() {
  return useContext(AuthContext)
}
