'use client'

import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import es from '@emoji-mart/data/i18n/es.json'
import { useTheme } from '@/context/ThemeContext'

// selector completo de emojis (emoji-mart). este archivo trae la libreria y la
// lista de emojis, que pesan bastante, asi que SelectorEmoji lo importa con
// next/dynamic: solo se descarga la primera vez que alguien toca "+"
interface Props {
  onSelect: (emoji: string) => void
}

// lo que emoji-mart entrega al elegir; solo se usa el caracter nativo
interface EmojiElegido {
  native: string
}

export default function PanelEmoji({ onSelect }: Props) {
  // el tema de la app es manual (ThemeContext), no el del sistema operativo
  const { tema } = useTheme()

  return (
    <Picker
      data={data}
      i18n={es}
      locale="es"
      theme={tema === 'oscuro' ? 'dark' : 'light'}
      onEmojiSelect={(e: EmojiElegido) => onSelect(e.native)}
      previewPosition="none"
      skinTonePosition="search"
      dynamicWidth
      autoFocus
    />
  )
}
