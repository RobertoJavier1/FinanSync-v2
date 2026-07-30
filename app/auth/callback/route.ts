// Callback de OAuth (Google).
//
// Firebase usaba signInWithPopup, que resolvía todo en el navegador. Supabase
// usa el flujo estándar de OAuth: Google redirige aquí con un `code`, y este
// handler lo intercambia por una sesión y escribe las cookies.
//
// Esta URL debe estar registrada en Supabase → Authentication → URL
// Configuration → Redirect URLs, por ejemplo:
//   http://localhost:3000/auth/callback
//   https://finan-sync-dun.vercel.app/auth/callback
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // permite volver a la página desde la que se inició el login
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // si algo falla se vuelve al login con un mensaje visible para el usuario
  return NextResponse.redirect(`${origin}/?error=oauth`)
}
