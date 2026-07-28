'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import { db } from '@/lib/firebase'

// preferencias de notificaciones del usuario
export interface NotifState {
  presupuesto: boolean // true = mostrar alertas cuando se acerca al limite de presupuesto
  metas: boolean       // true = mostrar recordatorios de metas proximas a vencer
  ia: boolean          // true = cargar analisis automatico en Perspectivas IA al entrar
}

// funciones y datos que el contexto expone a todas las paginas
interface NotifContextValue {
  notif: NotifState
  notifLoaded: boolean  // true cuando ya se cargaron las preferencias desde Firestore
  guardar: (vals: NotifState) => Promise<void>
}

// valor por defecto: todas las notificaciones activas antes de cargar Firestore
const NotifContext = createContext<NotifContextValue>({
  notif: { presupuesto: true, metas: true, ia: true },
  notifLoaded: false,
  guardar: async () => {},
})

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notif, setNotif] = useState<NotifState>({ presupuesto: true, metas: true, ia: true })
  const [notifLoaded, setNotifLoaded] = useState(false)

  // carga las preferencias de notificaciones del usuario desde Firestore
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setNotif({
            presupuesto: d.notifPresupuesto ?? true,
            metas: d.notifMetas ?? true,
            ia: d.notifIA ?? true,
          })
        }
      })
      .finally(() => setNotifLoaded(true))
  }, [user])

  // guarda las preferencias en el estado local y en Firestore simultaneamente
  async function guardar(vals: NotifState) {
    if (!user) return
    setNotif(vals)
    await setDoc(
      doc(db, 'users', user.uid),
      { notifPresupuesto: vals.presupuesto, notifMetas: vals.metas, notifIA: vals.ia },
      { merge: true }, // merge:true para no sobreescribir otros campos del documento
    )
  }

  return (
    <NotifContext.Provider value={{ notif, notifLoaded, guardar }}>
      {children}
    </NotifContext.Provider>
  )
}

// hook personalizado para acceder a las preferencias de notificaciones desde cualquier pagina
export const useNotif = () => useContext(NotifContext)
