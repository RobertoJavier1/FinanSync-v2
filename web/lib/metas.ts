import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export interface Meta {
  id: string
  uid: string
  nombre: string
  objetivo: number      // monto total a alcanzar
  actual: number        // monto ahorrado hasta ahora
  fechaLimite: string   // "YYYY-MM-DD" para input date
  colorHex: string
  icono: string
  completada: boolean
  monedaOrigen: string  // moneda activa del usuario al crear la meta
}

// colores e iconos predefinidos para las metas
export const COLORES_META = [
  '#22c55e', '#3b82f6', '#a855f7', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
]

export const ICONOS_META = ['🐷','🏠','✈️','🚗','🎓','💻','💍','🏖️','🎯','⭐']

// convierte timestamp de Android (Long en ms) o Firestore Timestamp a "YYYY-MM-DD"
function parseFechaLimite(fechaLimite: unknown): string {
  try {
    if (fechaLimite instanceof Timestamp) return fechaLimite.toDate().toISOString().split('T')[0]
    if (typeof fechaLimite === 'number') return new Date(fechaLimite).toISOString().split('T')[0]
    if (typeof fechaLimite === 'string') return fechaLimite
  } catch { /* fallback abajo */ }
  return ''
}

export async function getMetas(uid: string): Promise<Meta[]> {
  // coleccion raiz con filtro por uid — misma estructura que Android
  const q = query(collection(db, 'metas'), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      uid: data.uid,
      nombre: data.nombre || '',
      objetivo: data.objetivo || 0,
      actual: data.actual || 0,
      fechaLimite: parseFechaLimite(data.fechaLimite),
      colorHex: data.colorHex || '#22c55e',
      icono: data.icono || '🎯',
      completada: data.completada || false,
      monedaOrigen: data.monedaOrigen ?? 'GTQ',
    }
  })
}

export async function agregarMeta(
  uid: string,
  data: Omit<Meta, 'id' | 'uid'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'metas'), {
    uid,
    nombre: data.nombre,
    objetivo: data.objetivo,
    actual: data.actual,
    // fecha como Timestamp para ser compatible con el Long de Android
    fechaLimite: data.fechaLimite ? Timestamp.fromDate(new Date(data.fechaLimite)) : null,
    colorHex: data.colorHex,
    icono: data.icono,
    completada: data.completada,
    monedaOrigen: data.monedaOrigen,
    creadoEn: Timestamp.now(),
  })
  return ref.id
}

export async function agregarContribucion(id: string, nuevoActual: number, objetivo: number): Promise<void> {
  await updateDoc(doc(db, 'metas', id), {
    actual: nuevoActual,
    completada: nuevoActual >= objetivo,
  })
}

export async function eliminarMeta(id: string): Promise<void> {
  await deleteDoc(doc(db, 'metas', id))
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
