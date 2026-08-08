'use client'

import { useQuery } from '@tanstack/react-query'
import { getPresupuestos } from '@/lib/presupuestos'

export function usePresupuestos(userId: string | undefined, mes: number, anio: number) {
  return useQuery({
    queryKey: ['presupuestos', userId, mes, anio],
    queryFn: () => getPresupuestos(userId!, mes, anio),
    enabled: !!userId,
  })
}
