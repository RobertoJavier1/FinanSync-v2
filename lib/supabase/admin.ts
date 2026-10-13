// Cliente de Supabase con la service_role key.
//
// Ignora las políticas RLS, así que NUNCA debe usarse en una ruta que atienda
// al usuario: es solo para el job del estado de cuenta mensual, que corre sin
// sesión de nadie y necesita leer los datos de cada usuario.
//
// La llave vive únicamente en el servidor (sin NEXT_PUBLIC_) y se configura
// como variable de entorno en Cloud Run.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cliente: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceRole) {
      throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    }

    cliente = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cliente
}
