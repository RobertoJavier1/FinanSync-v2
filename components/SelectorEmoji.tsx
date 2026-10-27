'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus, X } from 'lucide-react'

// el icono se guarda como texto libre en la base, asi que cualquier emoji sirve.
// las sugerencias son atajos; con "+" se abre el selector completo
interface Props {
  sugerencias: readonly string[]
  valor: string
  onChange: (emoji: string) => void
}

// el selector pesa bastante (libreria + lista de emojis), asi que se descarga
// aparte y solo cuando se abre por primera vez
const PanelEmoji = dynamic(() => import('./PanelEmoji'), {
  ssr: false,
  loading: () => (
    <div className="h-24 flex items-center justify-center text-xs text-slate-400">Cargando emojis...</div>
  ),
})

const claseBoton = (activo: boolean) =>
  `w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${activo ? 'bg-green-100 ring-2 ring-green-500' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`

export default function SelectorEmoji({ sugerencias, valor, onChange }: Props) {
  const [abierto, setAbierto] = useState(false)

  // un emoji propio elegido antes se muestra junto a las sugerencias
  const personalizado = valor && !sugerencias.includes(valor) ? valor : null

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {sugerencias.map((icono) => (
          <button key={icono} type="button" onClick={() => onChange(icono)} className={claseBoton(valor === icono)}>
            {icono}
          </button>
        ))}
        {personalizado && (
          <button type="button" className={claseBoton(true)} aria-label="Emoji personalizado">
            {personalizado}
          </button>
        )}
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-label={abierto ? 'Cerrar selector de emojis' : 'Usar otro emoji'}
          aria-expanded={abierto}
          title={abierto ? 'Cerrar' : 'Usar otro emoji'}
          className={`${claseBoton(abierto)} text-slate-500 dark:text-slate-300`}
        >
          {abierto ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {abierto && (
        <div className="mt-2">
          <PanelEmoji
            onSelect={(emoji) => {
              onChange(emoji)
              setAbierto(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
