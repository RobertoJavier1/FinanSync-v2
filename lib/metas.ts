// Acceso a la tabla `metas` en Supabase.
// Migrado desde la colección `metas` de Firestore (Firebase); la interfaz pública no cambia.
import { supabase } from './supabase/client'

export interface Meta {
  id: string
  uid: string
  nombre: string
  objetivo: number      // monto total a alcanzar
  actual: number        // monto ahorrado hasta ahora
  fechaLimite: string   // "YYYY-MM-DD" para input date
  colorHex: string
  icono: string
  // no es una columna: se calcula con actual >= objetivo al leer las metas
  completada: boolean
  monedaOrigen: string  // moneda activa del usuario al crear la meta
}

// colores e iconos predefinidos para las metas
export const COLORES_META = [
  '#22c55e', '#3b82f6', '#a855f7', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
]

export const ICONOS_META = ['🐷','🏠','✈️','🚗','🎓','💻','💍','🏖️','🎯','⭐']

export async function getMetas(uid: string): Promise<Meta[]> {
  const { data, error } = await supabase
    .from('metas')
    .select('*')
    .eq('id_usuario', uid)
    .order('creado_en', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => {
    const objetivo = Number(row.objetivo)
    const actual = Number(row.monto_actual)

    return {
      id: row.id_meta,
      uid: row.id_usuario,
      nombre: row.nombre,
      objetivo,
      actual,
      // la columna es nullable; la UI espera string vacío cuando no hay fecha
      fechaLimite: row.fecha_limite ?? '',
      colorHex: row.color,
      icono: row.icono,
      // derivado, no guardado: una meta sin objetivo no se considera cumplida
      completada: objetivo > 0 && actual >= objetivo,
      monedaOrigen: row.moneda_origen,
    }
  })
}

// `completada` no se recibe porque no es una columna: se deriva al leer.
export async function agregarMeta(
  uid: string,
  data: Omit<Meta, 'id' | 'uid' | 'completada'>,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('metas')
    .insert({
      id_usuario: uid,
      nombre: data.nombre,
      objetivo: data.objetivo,
      monto_actual: data.actual,
      // un string vacío no es una fecha válida en Postgres
      fecha_limite: data.fechaLimite || null,
      color: data.colorHex,
      icono: data.icono,
      moneda_origen: data.monedaOrigen,
    })
    .select('id_meta')
    .single()

  if (error) throw error
  return row.id_meta
}

// `completada` no se guarda: al volver a leer la meta se recalcula desde
// monto_actual, así que aquí basta con actualizar el monto.
export async function agregarContribucion(
  id: string,
  nuevoActual: number,
): Promise<void> {
  const { error } = await supabase
    .from('metas')
    .update({ monto_actual: nuevoActual })
    .eq('id_meta', id)

  if (error) throw error
}

export async function eliminarMeta(id: string): Promise<void> {
  const { error } = await supabase.from('metas').delete().eq('id_meta', id)
  if (error) throw error
}

// formatea "YYYY-MM-DD" → "30 dic 2026"
export function formatearFechaMeta(isoDate: string): string {
  if (!isoDate) return 'Sin fecha'
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} ${meses[m - 1]} ${y}`
}

// calcula dias restantes desde hoy hasta la fecha limite
export function diasRestantes(isoDate: string): number {
  if (!isoDate) return 0
  const diff = new Date(isoDate).getTime() - new Date().getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
