'use client'
// hooks para las funciones SQL de reportes
import { useQuery } from '@tanstack/react-query'
import { getComparativaMensual, getPromedioCategoria } from '@/lib/reportes'

export function useComparativaMensual(userId: string | undefined, meses: number) {
  return useQuery({
    queryKey: ['reportes', 'comparativa-mensual', userId, meses],
    queryFn: () => getComparativaMensual(meses),
    enabled: !!userId,
  })
}

export function usePromedioCategoria(userId: string | undefined, meses: number) {
  return useQuery({
    queryKey: ['reportes', 'promedio-categoria', userId, meses],
    queryFn: () => getPromedioCategoria(meses),
    enabled: !!userId,
  })
}
