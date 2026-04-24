'use client'

import { useState } from 'react'
import { use } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import DateRangePicker from '@/components/repos/DateRangePicker'
import MetricTypeSelector from '@/components/repos/MetricTypeSelector'
import MetricsChart from '@/components/charts/MetricsChart'
import RepoSyncStatus from '@/components/repos/RepoSyncStatus'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useMetrics } from '@/hooks/useMetrics'
import type { RepositoryDTO, ApiSuccess } from '@/types'
import type { MetricType } from '@prisma/client'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

type PageProps = {
  params: Promise<{ repoId: string }>
}

export default function RepoDetailPage({ params }: PageProps) {
  const { repoId } = use(params)
  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [metricType, setMetricType] = useState<MetricType>('COMMIT_COUNT')

  const { data: repoData } = useSWR<ApiSuccess<RepositoryDTO>>(
    `/api/repos/${repoId}`,
    fetcher
  )
  const repo = repoData?.data

  const { metrics, isLoading, error } = useMetrics({
    repoId,
    from: `${dateRange.from}T00:00:00Z`,
    to: `${dateRange.to}T23:59:59Z`,
    type: metricType,
  })

  return (
    <>
      <Header title={repo?.fullName ?? 'Repository'} breadcrumb="Repositories" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-5">
          {repo && <RepoSyncStatus repo={repo} />}

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="mb-5 flex flex-wrap items-end gap-4">
              <DateRangePicker
                from={dateRange.from}
                to={dateRange.to}
                onChange={(from, to) => setDateRange({ from, to })}
              />
              <MetricTypeSelector selected={metricType} onChange={setMetricType} />
            </div>

            {error ? (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                Failed to load metrics
              </div>
            ) : (
              <ErrorBoundary>
                <MetricsChart data={metrics} type={metricType} isLoading={isLoading} />
              </ErrorBoundary>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
