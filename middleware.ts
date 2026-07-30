// Middleware de sesión de Supabase.
//
// El access token de Supabase caduca (1 hora por defecto). Este middleware
// corre antes de cada request, lo refresca si hace falta y reescribe las
// cookies, para que la sesión no se caiga sola mientras el usuario navega.
// También protege las rutas del área privada en el servidor: antes la única
// defensa era el redirect del cliente en app/(app)/layout.tsx.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// rutas accesibles sin sesión
const RUTAS_PUBLICAS = ['/', '/registrarse', '/auth/callback']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() valida el token contra el servidor de Supabase y lo refresca.
  // No usar getSession() aquí: lee la cookie sin verificarla.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const esPublica = RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith('/auth/'))

  // sin sesión en una ruta privada → al login
  if (!user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // con sesión en login o registro → al panel
  if (user && (pathname === '/' || pathname === '/registrarse')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // se excluyen archivos estáticos e imágenes para no gastar una llamada de
  // auth en cada asset
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
