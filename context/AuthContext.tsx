'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

// define los valores que el contexto comparte con toda la app
interface AuthContextType {
  user: User | null   // usuario actual de Supabase, null si no hay sesion activa
  loading: boolean    // true mientras Supabase verifica si existe una sesion guardada
  nombre: string      // nombre visible del usuario (antes user.displayName)
  esGoogle: boolean   // true si inicio sesion con Google (no tiene contrasena propia)
}

// valor inicial del contexto antes de que Supabase responda
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  nombre: '',
  esGoogle: false,
})

// Supabase guarda los datos extra del usuario en user_metadata. Al registrarse
// se manda `nombre`; con Google llegan `full_name` / `name`.
function nombreDe(user: User | null): string {
  if (!user) return ''
  const meta = user.user_metadata ?? {}
  return (
    (meta.nombre as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    user.email?.split('@')[0] ||
    ''
  )
}

// proveedor que envuelve toda la app y escucha cambios de sesion en tiempo real
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // getUser() valida el token contra el servidor de Supabase, a diferencia de
    // getSession() que solo lee la cookie local
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
    })

    // onAuthStateChange reemplaza a onAuthStateChanged de Firebase: se dispara
    // al iniciar sesion, al cerrarla y cada vez que se refresca el token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // cancela la suscripcion al desmontar para evitar memory leaks
    return () => subscription.unsubscribe()
  }, [])

  // el proveedor queda en app_metadata; identities cubre cuentas enlazadas
  const esGoogle =
    user?.app_metadata?.provider === 'google' ||
    (user?.identities?.some((i) => i.provider === 'google') ?? false)

  return (
    <AuthContext.Provider value={{ user, loading, nombre: nombreDe(user), esGoogle }}>
      {children}
    </AuthContext.Provider>
  )
}

// hook personalizado para acceder al usuario desde cualquier componente sin
// necesidad de importar useContext y AuthContext en cada archivo
export function useAuth() {
  return useContext(AuthContext)
}
