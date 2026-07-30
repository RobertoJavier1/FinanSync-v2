// Cliente de Supabase para código que corre en el servidor:
// Server Components, Route Handlers (app/api/...) y Server Actions.
//
// Lee la sesión desde las cookies del request, así que respeta las políticas
// RLS del usuario que hizo la petición. Firebase no tenía equivalente porque
// todo el acceso a datos se hacía desde el navegador.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // desde un Server Component no se pueden escribir cookies;
            // el middleware ya se encarga de refrescar el token, así que
            // aquí se puede ignorar sin consecuencias
          }
        },
      },
    },
  )
}
