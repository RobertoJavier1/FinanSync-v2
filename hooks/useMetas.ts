'use client'

import { useQuery } from '@tanstack/react-query'
import { getMetas } from '@/lib/metas'

export function useMetas(userId: string | undefined) {
  return useQuery({
    queryKey: ['metas', userId],
    queryFn: () => getMetas(userId!),
    enabled: !!userId,
  })
}
