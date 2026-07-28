import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export interface Presupuesto {
  id: string
  uid: string
  categoria: string
  limiteMonthly: number   // campo que usa Android para el limite mensual
  mes: number             // mes numerico (1-12)
  anio: number
  colorHex: string
  icono: string
  monedaOrigen: string    // moneda activa del usuario al crear el presupuesto
  spent?: number          // calculado en el cliente a partir de las transacciones
}

// colores predefinidos disponibles al crear un presupuesto
export const COLORES_PRESUPUESTO = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#ec4899',
]

// iconos predefinidos para cada presupuesto
export const ICONOS_PRESUPUESTO = ['🏠','🍽️','🚗','🛍️','🎬','💊','📚','💡','✈️','📋']

export async function getPresupuestos(uid: string, mes: number, anio: number): Promise<Presupuesto[]> {
  // filtra por uid, mes y anio para obtener solo los presupuestos del mes actual
  const q = query(
    collection(db, 'presupuestos'),
    where('uid', '==', uid),
    where('mes', '==', mes),
    where('anio', '==', anio)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return { id: d.id, ...data, monedaOrigen: data.monedaOrigen ?? 'GTQ' } as Presupuesto
  })
}

export async function agregarPresupuesto(
  uid: string,
  data: Omit<Presupuesto, 'id' | 'uid' | 'spent'>
): Promise<string> {
  // guarda en coleccion raiz con uid — misma estructura que Android
  const ref = await addDoc(collection(db, 'presupuestos'), {
    uid,
    ...data,
    creadoEn: Timestamp.now(),
  })
  return ref.id
}

export async function eliminarPresupuesto(id: string): Promise<void> {
  await deleteDoc(doc(db, 'presupuestos', id))
}
