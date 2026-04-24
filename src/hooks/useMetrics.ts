'use client'

import useSWR from 'swr'
import type { MetricDTO, ApiSuccess } from '@/types'
import type { MetricType } from '@prisma/client'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type UseMetricsParams = {
  repoId: string
  from: string
  to: string
  type: MetricType
}

export function useMetrics({ repoId, from, to, type }: UseMetricsParams) {
  const key = `/api/repos/${repoId}/metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=${type}`

  const { data, isLoading, error, mutate } = useSWR<ApiSuccess<MetricDTO[]>>(key, fetcher)

  return {
    metrics: data?.data ?? [],
    isLoading,
    error,
    mutate,
  }
}
