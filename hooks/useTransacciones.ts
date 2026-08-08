'use client'
//hook personalizado para obtener las transacciones de un usuario
import { useQuery } from '@tanstack/react-query'
import { getTransacciones } from '@/lib/transacciones'

export function useTransacciones(userId: string | undefined) {
  return useQuery({
    queryKey: ['transacciones', userId],
    queryFn: () => getTransacciones(userId!),
    enabled: !!userId, // no ejecuta la consulta hasta que haya un usuario logueado
  })
}