'use client'

import { useState } from 'react'
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
  Menu,
  X,
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
  // configuracion va dentro del menu principal: al fondo del drawer quedaba
  // debajo de la barra del navegador en el telefono y no se podia tocar
  { href: '/configuracion',   label: 'Configuración',  icon: Settings },
]

export default function Sidebar() {
  // usePathname devuelve la ruta actual para saber que item del menu esta activo
  const pathname = usePathname()
  const router = useRouter()
  // controla si el drawer del menu esta abierto en pantallas moviles
  const [open, setOpen] = useState(false)

  // cierra la sesion en Supabase y borra la cookie; refresh() avisa al
  // middleware del cambio y push() lleva al login
  async function handleLogout() {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/')
  }

  return (
    <>
      {/* barra superior visible solo en movil, con boton para abrir el menu */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
            <DollarSign className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-800 dark:text-white">FinanSync</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="p-2 text-slate-600 dark:text-slate-300"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* overlay que oscurece el fondo mientras el drawer esta abierto en movil */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 md:w-56 h-screen h-[100dvh] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* logo y nombre de la app, lleva al dashboard al hacer clic */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-100 dark:border-slate-700">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={() => setOpen(false)}>
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 dark:text-white text-lg">FinanSync</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* menu principal: recorre navItems y resalta el item cuya ruta coincide con la actual */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            // isActive es true si la ruta actual es exactamente el href o una subruta de el
            // ej. /transacciones/agregar tambien resalta el item de Transacciones
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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

        {/* seccion inferior: solo cerrar sesion. el padding extra deja el boton
            por encima de la barra inferior de safari en iphone */}
        <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-slate-700 space-y-0.5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950 w-full transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  )
}
