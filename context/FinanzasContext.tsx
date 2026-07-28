'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import { db } from '@/lib/firebase'

// categorias que se asignan por defecto si el usuario no ha personalizado las suyas
const CATEGORIAS_DEFAULT = ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Educación', 'Vivienda', 'Ropa']

// simbolo visual de cada moneda soportada
const SIMBOLOS: Record<string, string> = {
  MXN: '$', USD: '$', EUR: '€', GTQ: 'Q', COP: '$', ARS: '$',
}

// configuracion financiera del usuario guardada en Firestore
export interface FinanzasState {
  moneda: string       // moneda activa del usuario, ej. 'GTQ'
  categorias: string[] // categorias personalizadas para clasificar transacciones
}

// funciones y datos que el contexto expone a todas las paginas
interface FinanzasContextValue {
  finanzas: FinanzasState
  finanzasLoaded: boolean  // true cuando ya se cargo la configuracion desde Firestore
  guardar: (vals: FinanzasState) => Promise<void>
  // convierte un monto desde su moneda de origen a la moneda activa del usuario
  convertir: (monto: number, monedaOrigen: string) => number
  // convierte un monto entre dos monedas cualesquiera, independiente de la moneda activa
  convertirEntre: (monto: number, de: string, a: string) => number
  // convierte y formatea un monto con simbolo y codigo, ej. "Q1,500.00 GTQ"
  formatear: (monto: number, monedaOrigen?: string) => string
}

// valor por defecto del contexto antes de que carguen los datos reales
const FinanzasContext = createContext<FinanzasContextValue>({
  finanzas: { moneda: 'GTQ', categorias: CATEGORIAS_DEFAULT },
  finanzasLoaded: false,
  guardar: async () => {},
  convertir: (monto) => monto,
  convertirEntre: (monto) => monto,
  formatear: (monto) => `Q${monto.toFixed(2)} GTQ`,
})

export function FinanzasProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [finanzas, setFinanzas] = useState<FinanzasState>({
    moneda: 'GTQ',
    categorias: CATEGORIAS_DEFAULT,
  })
  const [finanzasLoaded, setFinanzasLoaded] = useState(false)
  // tasas de cambio relativas al USD, ej. { gtq: 7.75, mxn: 17.37, eur: 0.92 }
  const [tasas, setTasas] = useState<Record<string, number> | null>(null)

  // carga la moneda y categorias del usuario desde su documento en Firestore
  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setFinanzas({
            moneda: d.moneda ?? 'GTQ',
            categorias: d.categorias ?? CATEGORIAS_DEFAULT,
          })
        }
      })
      .finally(() => setFinanzasLoaded(true))
  }, [user])

  // obtiene las tasas de cambio actuales desde la API interna de Next.js
  // se llama una sola vez al montar el proveedor
  useEffect(() => {
    fetch('/api/tipo-cambio')
      .then((r) => r.json())
      .then(setTasas)
      .catch(console.error)
  }, [])

  // guarda la configuracion financiera en el estado local y en Firestore simultaneamente
  async function guardar(vals: FinanzasState) {
    if (!user) return
    setFinanzas(vals)
    await setDoc(
      doc(db, 'users', user.uid),
      { moneda: vals.moneda, categorias: vals.categorias },
      { merge: true }, // merge:true para no sobreescribir otros campos del documento
    )
  }

  // convierte entre dos monedas usando las tasas relativas al USD como intermediario
  // ej: GTQ -> USD -> MXN
  const convertirEntre = useCallback(
    (monto: number, de: string, a: string): number => {
      if (!tasas || de === a) return monto
      const from = de.toLowerCase()
      const to = a.toLowerCase()
      if (!tasas[from] || !tasas[to]) return monto
      return (monto / tasas[from]) * tasas[to]
    },
    [tasas],
  )

  // atajo de convertirEntre que siempre convierte a la moneda activa del usuario
  const convertir = useCallback(
    (monto: number, monedaOrigen: string): number =>
      convertirEntre(monto, monedaOrigen, finanzas.moneda),
    [convertirEntre, finanzas.moneda],
  )

  // convierte el monto y lo devuelve formateado con simbolo y codigo de moneda
  const formatear = useCallback(
    (monto: number, monedaOrigen?: string): string => {
      const valor = monedaOrigen ? convertir(monto, monedaOrigen) : monto
      const simbolo = SIMBOLOS[finanzas.moneda] || '$'
      return `${simbolo}${valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${finanzas.moneda}`
    },
    [convertir, finanzas.moneda],
  )

  return (
    <FinanzasContext.Provider value={{ finanzas, finanzasLoaded, guardar, convertir, convertirEntre, formatear }}>
      {children}
    </FinanzasContext.Provider>
  )
}

// hook personalizado para acceder a la configuracion financiera desde cualquier pagina
export const useFinanzas = () => useContext(FinanzasContext)
