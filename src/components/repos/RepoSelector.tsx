'use client'

import { useState } from 'react'
import RepoCard from './RepoCard'
import { useRepos } from '@/hooks/useRepos'

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="h-3 w-32 rounded bg-gray-200" />
      </div>
      <div className="h-8 w-20 rounded bg-gray-200" />
    </div>
  )
}

export default function RepoSelector() {
  const { repos, isLoading, error, mutate } = useRepos()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleToggle = async (repoId: string, isTracked: boolean) => {
    setUpdatingId(repoId)
    try {
      await fetch(`/api/repos/${repoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTracked }),
      })
      await mutate()
    } finally {
      setUpdatingId(null)
    }
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to load repositories
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
      ) : repos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center">
          <p className="text-sm text-gray-400">No repositories connected yet</p>
        </div>
      ) : (
        repos.map((repo) => (
          <RepoCard
            key={repo.id}
            repo={repo}
            onToggleTrack={handleToggle}
            isUpdating={updatingId === repo.id}
          />
        ))
      )}
    </div>
  )
}
