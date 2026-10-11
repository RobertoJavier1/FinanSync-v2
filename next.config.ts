import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Genera .next/standalone: un server.js con solo el código y los paquetes
  // que la app realmente usa. Sin esto, la imagen de Docker para Cloud Run
  // tendría que copiar todo node_modules (mucho más pesada y lenta de subir).
  output: 'standalone',

  // cabeceras de seguridad para todas las rutas. No se define Content-Security-
  // Policy: Next.js inyecta scripts en linea y una CSP mal calibrada rompe la app
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // nadie puede incrustar la app en un iframe (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // el navegador respeta el Content-Type declarado y no lo adivina
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // al salir a otro sitio solo se envia el origen, no la URL completa
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // obliga a usar HTTPS con el dominio durante 1 año
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig
