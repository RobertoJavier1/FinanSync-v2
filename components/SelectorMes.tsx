'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriodo, MESES } from '@/context/PeriodoContext'

// ultimos 10 anios + el actual: suficiente para el historial normal de un usuario
const ANIOS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i)

// flechas + etiqueta de mes/anio, comparte el mismo periodo entre paginas via PeriodoContext.
// la etiqueta abre un popover con selects para saltar directo a un mes lejano
export default function SelectorMes() {
  const { mes, anio, mesNombre, esMesActual, mesAnterior, mesSiguiente, irAMes } = usePeriodo()
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="relative flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-1.5 py-1.5">
      <button
        onClick={mesAnterior}
        aria-label="Mes anterior"
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        onClick={() => setAbierto((v) => !v)}
        className="text-sm font-medium text-slate-700 dark:text-slate-200 w-28 text-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 py-0.5"
      >
        {mesNombre} {anio}
      </button>

      <button
        onClick={mesSiguiente}
        disabled={esMesActual}
        aria-label="Mes siguiente"
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {abierto && (
        <>
          {/* capa invisible para cerrar el popover al hacer clic fuera */}
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute top-full left-0 mt-2 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 flex gap-2">
            <select
              value={mes}
              onChange={(e) => { irAMes(Number(e.target.value), anio); setAbierto(false) }}
              className="px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded text-sm text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i + 1}>{nombre}</option>
              ))}
            </select>
            <select
              value={anio}
              onChange={(e) => { irAMes(mes, Number(e.target.value)); setAbierto(false) }}
              className="px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded text-sm text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}
