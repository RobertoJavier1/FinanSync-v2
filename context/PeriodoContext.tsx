'use client'

import { createContext, useContext, useState } from 'react'

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface Periodo {
  mes: number   // 1-12
  anio: number
}

interface PeriodoContextType extends Periodo {
  mesNombre: string
  esMesActual: boolean
  mesAnterior: () => void
  mesSiguiente: () => void
  irAMes: (mes: number, anio: number) => void
}

function periodoActual(): Periodo {
  const hoy = new Date()
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() }
}

const PeriodoContext = createContext<PeriodoContextType>({
  ...periodoActual(),
  mesNombre: MESES[new Date().getMonth()],
  esMesActual: true,
  mesAnterior: () => {},
  mesSiguiente: () => {},
  irAMes: () => {},
})

// mes/anio que se esta viendo en dashboard, transacciones y presupuesto: un
// solo selector compartido para que navegar entre paginas no lo reinicie
export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  // vive solo en memoria: un refresh de la pagina lo reinicia al mes actual
  const [periodo, setPeriodo] = useState<Periodo>(periodoActual)

  const hoy = periodoActual()
  const esMesActual = periodo.mes === hoy.mes && periodo.anio === hoy.anio

  function mesAnterior() {
    setPeriodo(({ mes, anio }) => (mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio }))
  }

  function mesSiguiente() {
    setPeriodo((actual) => {
      // no tiene sentido navegar a un mes que todavia no ha empezado
      if (actual.mes === hoy.mes && actual.anio === hoy.anio) return actual
      return actual.mes === 12 ? { mes: 1, anio: actual.anio + 1 } : { mes: actual.mes + 1, anio: actual.anio }
    })
  }

  // salto directo a un mes/anio elegido en el selector; para navegar lejos sin dar clic muchas veces
  function irAMes(mes: number, anio: number) {
    const enElFuturo = anio > hoy.anio || (anio === hoy.anio && mes > hoy.mes)
    setPeriodo(enElFuturo ? hoy : { mes, anio })
  }

  return (
    <PeriodoContext.Provider
      value={{ ...periodo, mesNombre: MESES[periodo.mes - 1], esMesActual, mesAnterior, mesSiguiente, irAMes }}
    >
      {children}
    </PeriodoContext.Provider>
  )
}

export const usePeriodo = () => useContext(PeriodoContext)
