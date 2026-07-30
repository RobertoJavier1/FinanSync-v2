// Acceso a la tabla `presupuestos` en Supabase.
//
// La interfaz pública no cambia: las páginas siguen viendo `categoria` como
// texto y `limiteMonthly`, aunque en la base sean id_categoria y limite_mensual.
import { supabase } from './supabase/client'
import { getCategorias, asegurarCategoria } from './categorias'

export interface Presupuesto {
  id: string
  uid: string
  categoria: string
  limiteMonthly: number   // limite mensual de gasto
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

export async function getPresupuestos(
  uid: string,
  mes: number,
  anio: number,
): Promise<Presupuesto[]> {
  // filtra por usuario, mes y anio para traer solo el periodo que se muestra
  const [respuesta, categorias] = await Promise.all([
    supabase
      .from('presupuestos')
      .select('*')
      .eq('id_usuario', uid)
      .eq('mes', mes)
      .eq('anio', anio),
    getCategorias(uid),
  ])

  if (respuesta.error) throw respuesta.error

  const nombrePorId = new Map(categorias.map((c) => [c.id, c.nombre]))

  return (respuesta.data ?? []).map((row) => ({
    id: row.id_presupuesto,
    uid: row.id_usuario,
    // id_categoria es NOT NULL y borrar la categoría se lleva el presupuesto
    // (ON DELETE CASCADE), así que aquí el nombre siempre debería existir
    categoria: nombrePorId.get(row.id_categoria) ?? '',
    limiteMonthly: Number(row.limite_mensual),
    mes: row.mes,
    anio: row.anio,
    colorHex: row.color,
    icono: row.icono,
    monedaOrigen: row.moneda_origen,
  }))
}

export async function agregarPresupuesto(
  uid: string,
  data: Omit<Presupuesto, 'id' | 'uid' | 'spent'>,
): Promise<string> {
  const idCategoria = await asegurarCategoria(uid, data.categoria)

  const { data: row, error } = await supabase
    .from('presupuestos')
    .insert({
      id_usuario: uid,
      id_categoria: idCategoria,
      limite_mensual: data.limiteMonthly,
      mes: data.mes,
      anio: data.anio,
      color: data.colorHex,
      icono: data.icono,
      moneda_origen: data.monedaOrigen,
    })
    .select('id_presupuesto')
    .single()

  // 23505 = unique_violation: ya hay un presupuesto de esa categoría ese mes
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya tienes un presupuesto de "${data.categoria}" para ese mes.`)
    }
    throw error
  }

  return row.id_presupuesto
}

export async function eliminarPresupuesto(id: string): Promise<void> {
  // RLS ya impide borrar filas de otro usuario, así que no hace falta pasar el uid
  const { error } = await supabase
    .from('presupuestos')
    .delete()
    .eq('id_presupuesto', id)

  if (error) throw error
}
