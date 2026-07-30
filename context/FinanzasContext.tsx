'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase/client'
import { getCategorias, agregarCategoria, eliminarCategoria } from '@/lib/categorias'

// lista que se muestra mientras cargan las categorias reales del usuario. El
// trigger de la base crea estas mismas al registrarse (más 'Ahorro').
const CATEGORIAS_DEFAULT = ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Educación', 'Vivienda', 'Ropa']

// simbolo visual de cada moneda soportada
const SIMBOLOS: Record<string, string> = {
  MXN: '$', USD: '$', EUR: '€', GTQ: 'Q', COP: '$', ARS: '$',
}

// configuracion financiera del usuario: la moneda vive en `usuarios` y las
// categorias son filas de la tabla `categorias`
export interface FinanzasState {
  moneda: string       // moneda activa del usuario, ej. 'GTQ'
  categorias: string[] // categorias personalizadas para clasificar transacciones
}

// funciones y datos que el contexto expone a todas las paginas
interface FinanzasContextValue {
  finanzas: FinanzasState
  finanzasLoaded: boolean  // true cuando ya se cargo la configuracion desde la base de datos
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
  // las paginas trabajan con nombres de categoria, pero para borrarlas hace
  // falta su id_categoria: este mapa guarda la correspondencia
  const [idsPorNombre, setIdsPorNombre] = useState<Map<string, string>>(new Map())
  // tasas de cambio relativas al USD, ej. { gtq: 7.75, mxn: 17.37, eur: 0.92 }
  const [tasas, setTasas] = useState<Record<string, number> | null>(null)

  // carga la moneda desde `usuarios` y las categorias desde `categorias`
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase
        .from('usuarios')
        .select('moneda')
        // maybeSingle no lanza error si la fila todavía no existe
        .eq('id_usuario', user.id)
        .maybeSingle(),
      getCategorias(user.id),
    ])
      .then(([perfil, categorias]) => {
        if (perfil.error) console.error(perfil.error)
        setFinanzas({
          moneda: perfil.data?.moneda ?? 'GTQ',
          // una lista vacía es una elección válida del usuario, no se rellena
          categorias: categorias.map((c) => c.nombre),
        })
        setIdsPorNombre(new Map(categorias.map((c) => [c.nombre, c.id])))
        setFinanzasLoaded(true)
      })
      .catch((e) => {
        console.error(e)
        setFinanzasLoaded(true)
      })
  }, [user])

  // obtiene las tasas de cambio actuales desde la API interna de Next.js
  // se llama una sola vez al montar el proveedor
  useEffect(() => {
    fetch('/api/tipo-cambio')
      .then((r) => r.json())
      .then(setTasas)
      .catch(console.error)
  }, [])

  // guarda la configuracion. La moneda es un update simple; las categorias hay
  // que traducirlas de lista a filas, insertando las nuevas y borrando las que
  // el usuario quitó.
  async function guardar(vals: FinanzasState) {
    if (!user) return

    const { error } = await supabase
      .from('usuarios')
      .update({ moneda: vals.moneda })
      .eq('id_usuario', user.id)

    if (error) throw error

    const antes = finanzas.categorias
    const agregadas = vals.categorias.filter((c) => !antes.includes(c))
    const quitadas = antes.filter((c) => !vals.categorias.includes(c))

    for (const nombre of agregadas) {
      await agregarCategoria(user.id, nombre)
    }

    for (const nombre of quitadas) {
      const id = idsPorNombre.get(nombre)
      // borrar una categoria deja sus transacciones sin clasificar y se lleva
      // los presupuestos de esa categoria (definido en el schema)
      if (id) await eliminarCategoria(user.id, id)
    }

    // se relee para quedarse con los ids de las categorias recién creadas
    const actuales = await getCategorias(user.id)
    setIdsPorNombre(new Map(actuales.map((c) => [c.nombre, c.id])))
    setFinanzas({ moneda: vals.moneda, categorias: actuales.map((c) => c.nombre) })
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
