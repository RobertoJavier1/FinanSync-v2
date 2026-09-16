import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Genera .next/standalone: un server.js con solo el código y los paquetes
  // que la app realmente usa. Sin esto, la imagen de Docker para Cloud Run
  // tendría que copiar todo node_modules (mucho más pesada y lenta de subir).
  output: 'standalone',
}

export default nextConfig
