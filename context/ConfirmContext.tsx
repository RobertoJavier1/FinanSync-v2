'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

// reemplaza a window.confirm con un modal con el estilo de la app. se usa igual:
// const ok = await confirmar({ ... }) devuelve true si el usuario acepta
export interface OpcionesConfirmar {
  titulo: string
  mensaje: string
  textoConfirmar?: string // texto del boton de aceptar, por defecto "Eliminar"
}

type Confirmar = (opciones: OpcionesConfirmar) => Promise<boolean>

// sin provider no hay modal que mostrar, asi que se cae al dialogo del navegador
const ConfirmContext = createContext<Confirmar>(async (o) => window.confirm(`${o.titulo}\n\n${o.mensaje}`))

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null)
  // la promesa que espera la pagina se resuelve cuando el usuario elige
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const botonCancelar = useRef<HTMLButtonElement>(null)

  const confirmar = useCallback<Confirmar>((o) => {
    setOpciones(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function cerrar(ok: boolean) {
    resolver.current?.(ok)
    resolver.current = null
    setOpciones(null)
  }

  // el foco arranca en "Cancelar" para que un Enter accidental no borre nada,
  // y Escape cierra como en el dialogo del navegador
  useEffect(() => {
    if (!opciones) return
    botonCancelar.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opciones])

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {opciones && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => cerrar(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmar-titulo"
            className="bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <h3 id="confirmar-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {opciones.titulo}
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line break-words">
                  {opciones.mensaje}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                ref={botonCancelar}
                onClick={() => cerrar(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => cerrar(true)}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-sm"
              >
                {opciones.textoConfirmar ?? 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirmar() {
  return useContext(ConfirmContext)
}
