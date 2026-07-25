import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export interface Transaccion {
  id: string
  uid: string
  descripcion: string   // nombre de la transaccion (campo que usa Android)
  categoria: string
  fecha: string         // "DD MMM YYYY" para mostrar en UI
  fechaISO: string      // "YYYY-MM-DD" para calculos y filtros por mes
  monto: number
  tipo: 'income' | 'expense'  // se convierte desde INGRESO/GASTO de Android al leer
  monedaOrigen: string  // moneda activa del usuario al crear la transaccion
}

// convierte el tipo de Android (INGRESO/GASTO) al formato interno de la web
function parseTipo(tipo: string): 'income' | 'expense' {
  if (tipo === 'INGRESO') return 'income'
  if (tipo === 'GASTO') return 'expense'
  // por compatibilidad con documentos ya existentes en formato web
  return tipo === 'income' ? 'income' : 'expense'
}

// convierte el tipo web (income/expense) al formato de Android (INGRESO/GASTO)
function serializeTipo(tipo: 'income' | 'expense'): string {
  return tipo === 'income' ? 'INGRESO' : 'GASTO'
}

// convierte fecha de Firestore (Timestamp o Long) a string ISO "YYYY-MM-DD"
function parseTimestamp(fecha: unknown): string {
  try {
    if (fecha instanceof Timestamp) {
      return fecha.toDate().toISOString().split('T')[0]
    }
    if (typeof fecha === 'number') {
      return new Date(fecha).toISOString().split('T')[0]
    }
    if (typeof fecha === 'string') return fecha
  } catch {
    // si falla la conversion se usa la fecha actual como fallback
  }
  return new Date().toISOString().split('T')[0]
}

export async function getTransacciones(uid: string): Promise<Transaccion[]> {
  // coleccion raiz con filtro por uid — misma estructura que Android
  const q = query(
    collection(db, 'transacciones'),
    where('uid', '==', uid),
    orderBy('fecha', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    const fechaISO = parseTimestamp(data.fecha)
    return {
      id: d.id,
      uid: data.uid,
      descripcion: data.descripcion || data.nombre || '',
      categoria: data.categoria || '',
      fecha: formatearFecha(fechaISO),
      fechaISO,
      monto: data.monto || 0,
      tipo: parseTipo(data.tipo),
      monedaOrigen: data.monedaOrigen || 'GTQ',
    }
  })
}

export async function agregarTransaccion(
  uid: string,
  data: Omit<Transaccion, 'id' | 'uid' | 'fecha'>
): Promise<string> {
  // guarda en la coleccion raiz con uid como campo para ser compatible con Android
  const ref = await addDoc(collection(db, 'transacciones'), {
    uid,
    descripcion: data.descripcion,
    categoria: data.categoria,
    // fecha como Timestamp de Firestore — compatible con el Long que usa Android
    fecha: Timestamp.fromDate(new Date(data.fechaISO)),
    fechaISO: data.fechaISO,
    monto: data.monto,
    tipo: serializeTipo(data.tipo),
    monedaOrigen: data.monedaOrigen,
  })
  return ref.id
}

export async function eliminarTransaccion(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'transacciones', id))
}

// formatea "YYYY-MM-DD" → "14 feb 2026"
export function formatearFecha(isoDate: string): string {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} ${meses[m - 1]} ${y}`
}
