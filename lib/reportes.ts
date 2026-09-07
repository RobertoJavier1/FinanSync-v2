// Acceso a las funciones SQL de reportes (definidas en
// supabase/migrations/0003_reportes.sql). No reciben id_usuario: las
// funciones usan auth.uid() del lado de la base, protegidas por RLS.
//
// Igual que transacciones y presupuestos, los montos vienen separados por
// moneda_origen; la conversión a la moneda activa del usuario se hace en la
// página con `convertir` de FinanzasContext.
import { supabase } from './supabase/client'

export interface FilaComparativaMensual {
  anio: number
  mes: number
  tipo: 'income' | 'expense'
  monedaOrigen: string
  total: number
}

export interface FilaPromedioCategoria {
  idCategoria: string
  categoria: string
  monedaOrigen: string
  totalGastado: number
  mesesConMovimiento: number
  promedioMensual: number
}

export async function getComparativaMensual(meses: number): Promise<FilaComparativaMensual[]> {
  const { data, error } = await supabase.rpc('reporte_comparativa_mensual', { p_meses: meses })
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    anio: row.anio,
    mes: row.mes,
    tipo: row.tipo,
    monedaOrigen: row.moneda_origen,
    total: Number(row.total),
  }))
}

export async function getPromedioCategoria(meses: number): Promise<FilaPromedioCategoria[]> {
  const { data, error } = await supabase.rpc('reporte_promedio_categoria', { p_meses: meses })
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    idCategoria: row.id_categoria,
    categoria: row.nombre_categoria,
    monedaOrigen: row.moneda_origen,
    totalGastado: Number(row.total_gastado),
    mesesConMovimiento: Number(row.meses_con_movimiento),
    promedioMensual: Number(row.promedio_mensual),
  }))
}
