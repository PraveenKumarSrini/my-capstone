'use client'

import Header from '@/components/layout/Header'
import ConnectRepoForm from '@/components/repos/ConnectRepoForm'
import RepoSelector from '@/components/repos/RepoSelector'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useRepos } from '@/hooks/useRepos'

export default function ReposPage() {
  const { mutate } = useRepos()

  return (
    <>
      <Header title="Repositories" breadcrumb="Dashboard" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-5">
          <ConnectRepoForm onConnect={() => mutate()} />
          <ErrorBoundary>
            <RepoSelector />
          </ErrorBoundary>
        </div>
      </main>
    </>
  )
}
