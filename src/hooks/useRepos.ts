'use client'

import useSWR from 'swr'
import type { RepositoryDTO, ApiSuccess } from '@/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useRepos() {
  const { data, isLoading, error, mutate } = useSWR<ApiSuccess<RepositoryDTO[]>>(
    '/api/repos',
    fetcher
  )

  return {
    repos: data?.data ?? [],
    isLoading,
    error,
    mutate,
  }
}
