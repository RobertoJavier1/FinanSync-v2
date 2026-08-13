'use client'
//hook personalizado para obtener las transacciones de un usuario
import { useQuery } from '@tanstack/react-query'
import { getTransacciones, getTransaccionesPorMes } from '@/lib/transacciones'

export function useTransacciones(userId: string | undefined) {
  return useQuery({
    queryKey: ['transacciones', userId],
    queryFn: () => getTransacciones(userId!),
    enabled: !!userId, // no ejecuta la consulta hasta que haya un usuario logueado
  })
}

// trae solo las transacciones del mes/anio indicado, en vez del historial completo
export function useTransaccionesPorMes(userId: string | undefined, mes: number, anio: number) {
  return useQuery({
    queryKey: ['transacciones', userId, mes, anio],
    queryFn: () => getTransaccionesPorMes(userId!, mes, anio),
    enabled: !!userId,
  })
}