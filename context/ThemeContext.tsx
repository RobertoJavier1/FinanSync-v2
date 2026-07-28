'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Tema = 'claro' | 'oscuro'

// valores que el contexto expone a toda la app
interface ThemeContextType {
  tema: Tema
  setTema: (t: Tema) => void  // cambia el tema y lo persiste en localStorage
}

// valor por defecto antes de que cargue el tema guardado
const ThemeContext = createContext<ThemeContextType>({ tema: 'claro', setTema: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTemaState] = useState<Tema>('claro')

  // al montar, restaura el tema que el usuario tenia guardado en localStorage
  useEffect(() => {
    const saved = localStorage.getItem('finansync-tema') as Tema | null
    if (saved) aplicarTema(saved)
  }, [])

  // aplica el tema al estado, al HTML (clase 'dark' de Tailwind) y lo guarda en localStorage
  function aplicarTema(t: Tema) {
    setTemaState(t)
    if (t === 'oscuro') {
      document.documentElement.classList.add('dark')    // activa las clases dark: de Tailwind
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('finansync-tema', t) // persiste la preferencia entre sesiones
  }

  return (
    <ThemeContext.Provider value={{ tema, setTema: aplicarTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

// hook personalizado para acceder al tema y cambiarlo desde cualquier componente
export function useTheme() {
  return useContext(ThemeContext)
}
