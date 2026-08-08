import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import {Providers} from './providers'

// fuente inter cargada desde google fonts, solo el subconjunto latin para reducir peso
const inter = Inter({ subsets: ['latin'] })

// metadatos de la app, next.js los usa para el <title> y <meta description> del html
export const metadata: Metadata = {
  title: 'FinanSync',
  description: 'Sincroniza tus finanzas, sincroniza tu vida',
}

// layout raiz que envuelve toda la aplicacion
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* AuthProvider envuelve todo para que cualquier pagina pueda acceder al estado de sesion */}
        <Providers>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
