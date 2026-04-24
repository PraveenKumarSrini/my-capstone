'use client'

import useSWR from 'swr'
import Header from '@/components/layout/Header'
import MetricsSummaryBar from '@/components/dashboard/MetricsSummaryBar'
import SyncStatusBar from '@/components/dashboard/SyncStatusBar'
import CommitChart from '@/components/charts/CommitChart'
import PRChart from '@/components/charts/PRChart'
import ActivityFeed from '@/components/repos/ActivityFeed'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useSSE } from '@/hooks/useSSE'
import type { DashboardData, ApiSuccess } from '@/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DashboardPage() {
  const { data, isLoading, error } = useSWR<ApiSuccess<DashboardData>>(
    '/api/dashboard',
    fetcher,
    { refreshInterval: 0 }
  )
  const { status: sseStatus } = useSSE()

  const dashboard = data?.data

  const lastSyncedAt =
    dashboard?.repos
      .filter((r) => r.lastSyncedAt)
      .sort((a, b) => new Date(b.lastSyncedAt!).getTime() - new Date(a.lastSyncedAt!).getTime())[0]
      ?.lastSyncedAt ?? null

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load dashboard data
          </div>
        )}

        <div className="space-y-6">
          <SyncStatusBar lastSyncedAt={lastSyncedAt} sseStatus={sseStatus} />

          <MetricsSummaryBar summary={dashboard?.summary} isLoading={isLoading} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ErrorBoundary>
              <div className="rounded-lg border border-gray-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Commit Activity</h3>
                <CommitChart data={dashboard?.commitTimeline ?? []} isLoading={isLoading} />
              </div>
            </ErrorBoundary>

            <ErrorBoundary>
              <div className="rounded-lg border border-gray-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Pull Request Activity</h3>
                <PRChart data={dashboard?.prTimeline ?? []} isLoading={isLoading} />
              </div>
            </ErrorBoundary>
          </div>

          <ErrorBoundary>
            <ActivityFeed events={dashboard?.recentActivity ?? []} isLoading={isLoading} />
          </ErrorBoundary>
        </div>
      </main>
    </>
  )
}
