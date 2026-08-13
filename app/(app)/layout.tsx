'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { NotifProvider } from '@/context/NotifContext'
import { FinanzasProvider } from '@/context/FinanzasContext'
import { PeriodoProvider } from '@/context/PeriodoContext'
import Sidebar from '@/components/layout/Sidebar'

// layout protegido: todas las rutas dentro de (app) requieren sesion activa
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // segunda línea de defensa: el middleware ya bloquea estas rutas en el
    // servidor, pero esto cubre el caso de que la sesión expire con la app abierta
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  // muestra pantalla de carga mientras Supabase verifica la sesion
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Cargando...</div>
      </div>
    )
  }

  // evita un flash del contenido protegido justo antes de la redireccion
  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <FinanzasProvider>
          <PeriodoProvider>
            <NotifProvider>
              {children}
            </NotifProvider>
          </PeriodoProvider>
        </FinanzasProvider>
      </main>
    </div>
  )
}
