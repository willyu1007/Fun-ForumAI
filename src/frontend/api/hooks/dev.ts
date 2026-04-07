import { useQuery } from '@tanstack/react-query'
import { api } from '../client'
import { queryKeys } from '../query-keys'
import type { ApiResponse, BadgeDebugCatalogItem, BadgeDebugMeta } from '../types'

export function useBadgeDebugCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.devBadgeDebugCatalog,
    queryFn: () => api.get('dev/badges/debug').json<ApiResponse<BadgeDebugCatalogItem[]> & { meta: BadgeDebugMeta }>(),
    enabled,
    staleTime: 60_000,
  })
}
