'use client'

import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import type { GitHubAccountDTO, ApiSuccess } from '@/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useActiveAccount() {
  const { data: session } = useSession()
  const { data, isLoading, error, mutate } = useSWR<ApiSuccess<GitHubAccountDTO[]>>(
    session ? '/api/github-accounts' : null,
    fetcher
  )

  return {
    accounts: data?.data ?? [],
    activeAccountId: session?.user?.activeAccountId ?? null,
    isLoading,
    error,
    mutate,
  }
}
