// Cliente de Supabase para el navegador (Client Components).
//
// createBrowserClient viene de @supabase/ssr y guarda la sesión en cookies en
// lugar de localStorage, para que el servidor de Next.js también pueda leerla.
// Reemplaza al `auth` y `db` que antes exportaba lib/firebase.ts.
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
