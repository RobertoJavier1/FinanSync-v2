'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase/client'

// preferencias de notificaciones del usuario
export interface NotifState {
  presupuesto: boolean // true = mostrar alertas cuando se acerca al limite de presupuesto
  metas: boolean       // true = mostrar recordatorios de metas proximas a vencer
  ia: boolean          // true = cargar analisis automatico en Perspectivas IA al entrar
}

// funciones y datos que el contexto expone a todas las paginas
interface NotifContextValue {
  notif: NotifState
  notifLoaded: boolean  // true cuando ya se cargaron las preferencias desde la base de datos
  guardar: (vals: NotifState) => Promise<void>
}

// valor por defecto: todas las notificaciones activas antes de cargar el perfil
const NotifContext = createContext<NotifContextValue>({
  notif: { presupuesto: true, metas: true, ia: true },
  notifLoaded: false,
  guardar: async () => {},
})

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notif, setNotif] = useState<NotifState>({ presupuesto: true, metas: true, ia: true })
  const [notifLoaded, setNotifLoaded] = useState(false)

  // carga las preferencias de notificaciones del usuario desde usuarios
  useEffect(() => {
    if (!user) return
    supabase
      .from('usuarios')
      .select('notif_presupuesto, notif_metas, notif_ia')
      .eq('id_usuario', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error(error)
        if (data) {
          setNotif({
            presupuesto: data.notif_presupuesto ?? true,
            metas: data.notif_metas ?? true,
            ia: data.notif_ia ?? true,
          })
        }
        setNotifLoaded(true)
      })
  }, [user])

  // guarda las preferencias en el estado local y en usuarios simultaneamente
  async function guardar(vals: NotifState) {
    if (!user) return
    setNotif(vals)
    // solo se actualizan estas tres columnas; las de finanzas no se tocan
    const { error } = await supabase
      .from('usuarios')
      .update({
        notif_presupuesto: vals.presupuesto,
        notif_metas: vals.metas,
        notif_ia: vals.ia,
      })
      .eq('id_usuario', user.id)

    if (error) throw error
  }

  return (
    <NotifContext.Provider value={{ notif, notifLoaded, guardar }}>
      {children}
    </NotifContext.Provider>
  )
}

// hook personalizado para acceder a las preferencias de notificaciones desde cualquier pagina
export const useNotif = () => useContext(NotifContext)
