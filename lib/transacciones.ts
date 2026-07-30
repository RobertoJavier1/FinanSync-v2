// Acceso a la tabla `transacciones` en Supabase.
//
// La interfaz Transaccion sigue exponiendo `categoria` como texto para que las
// páginas no cambien, pero en la base es una llave foránea a `categorias`. La
// traducción entre nombre e id se hace aquí.
import { supabase } from './supabase/client'
import { getCategorias, asegurarCategoria } from './categorias'

// una transacción cuya categoría fue borrada conserva su historial pero se
// queda sin clasificar (ON DELETE SET NULL en el schema)
export const SIN_CATEGORIA = 'Sin categoría'

export interface Transaccion {
  id: string
  uid: string
  descripcion: string   // nombre de la transaccion
  categoria: string
  fecha: string         // "DD MMM YYYY" para mostrar en UI
  fechaISO: string      // "YYYY-MM-DD" para calculos y filtros por mes
  monto: number
  tipo: 'income' | 'expense'
  monedaOrigen: string  // moneda activa del usuario al crear la transaccion
}

export async function getTransacciones(uid: string): Promise<Transaccion[]> {
  // dos consultas en paralelo en lugar de un join: la lista de categorías es
  // corta y así el tipado se mantiene simple
  const [respuesta, categorias] = await Promise.all([
    supabase
      .from('transacciones')
      .select('*')
      // el filtro es redundante con RLS, pero deja que la consulta use el
      // índice (id_usuario, fecha desc)
      .eq('id_usuario', uid)
      .order('fecha', { ascending: false }),
    getCategorias(uid),
  ])

  if (respuesta.error) throw respuesta.error

  const nombrePorId = new Map(categorias.map((c) => [c.id, c.nombre]))

  return (respuesta.data ?? []).map((row) => ({
    id: row.id_transaccion,
    uid: row.id_usuario,
    descripcion: row.descripcion,
    categoria: (row.id_categoria && nombrePorId.get(row.id_categoria)) || SIN_CATEGORIA,
    fecha: formatearFecha(row.fecha),
    fechaISO: row.fecha,
    // numeric de Postgres puede llegar como string por precisión; Number lo normaliza
    monto: Number(row.monto),
    tipo: row.tipo,
    monedaOrigen: row.moneda_origen,
  }))
}

export async function agregarTransaccion(
  uid: string,
  data: Omit<Transaccion, 'id' | 'uid' | 'fecha'>,
): Promise<string> {
  // la página manda el nombre de la categoría; la base necesita su id
  const idCategoria = await asegurarCategoria(uid, data.categoria)

  const { data: row, error } = await supabase
    .from('transacciones')
    .insert({
      id_usuario: uid,
      id_categoria: idCategoria,
      descripcion: data.descripcion,
      fecha: data.fechaISO,
      monto: data.monto,
      tipo: data.tipo,
      moneda_origen: data.monedaOrigen,
    })
    .select('id_transaccion')
    .single()

  if (error) throw error
  return row.id_transaccion
}

export async function eliminarTransaccion(uid: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('transacciones')
    .delete()
    .eq('id_transaccion', id)
    .eq('id_usuario', uid)

  if (error) throw error
}

// formatea "YYYY-MM-DD" → "14 feb 2026"
export function formatearFecha(isoDate: string): string {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} ${meses[m - 1]} ${y}`
}
