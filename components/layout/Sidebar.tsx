'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Target,
  Sparkles,
  MessageSquare,
  Settings,
  LogOut,
  DollarSign,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

// lista de rutas principales que aparecen en el menu de navegacion
const navItems = [
  { href: '/dashboard',       label: 'Panel',          icon: LayoutDashboard },
  { href: '/transacciones',   label: 'Transacciones',  icon: Receipt },
  { href: '/presupuesto',     label: 'Presupuesto',    icon: Wallet },
  { href: '/metas',           label: 'Metas',          icon: Target },
  { href: '/perspectivas-ia', label: 'Perspectivas IA',icon: Sparkles },
  { href: '/chat-ia',         label: 'Chat IA',        icon: MessageSquare },
]

export default function Sidebar() {
  // usePathname devuelve la ruta actual para saber que item del menu esta activo
  const pathname = usePathname()
  const router = useRouter()

  // cierra la sesion en Supabase y borra la cookie; refresh() avisa al
  // middleware del cambio y push() lleva al login
  async function handleLogout() {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/')
  }

  return (
    <aside className="w-56 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0">

      {/* logo y nombre de la app, lleva al dashboard al hacer clic */}
      <Link href="/dashboard" className="flex items-center gap-3 px-4 py-5 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
          <DollarSign className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-slate-800 dark:text-white text-lg">FinanSync</span>
      </Link>

      {/* menu principal: recorre navItems y resalta el item cuya ruta coincide con la actual */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => {
          // isActive es true si la ruta actual es exactamente el href o una subruta de el
          // ej. /transacciones/agregar tambien resalta el item de Transacciones
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-500 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* seccion inferior: configuracion y boton de cerrar sesion */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-700 space-y-0.5">
        <Link
          href="/configuracion"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/configuracion'
              ? 'bg-green-500 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Configuración
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950 w-full transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
