import Badge from '@/components/ui/Badge'
import { timeAgo, formatMetricValue } from '@/lib/utils'
import type { DashboardData } from '@/types'
import type { MetricType } from '@prisma/client'

type ActivityFeedProps = {
  events: DashboardData['recentActivity']
  isLoading?: boolean
}

const metricBadgeVariant: Record<MetricType, 'success' | 'warning' | 'error' | 'neutral'> = {
  COMMIT_COUNT: 'neutral',
  PR_OPENED: 'neutral',
  PR_MERGED: 'success',
  PR_CLOSED: 'error',
  REVIEW_COUNT: 'warning',
  COMMENT_COUNT: 'neutral',
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 animate-pulse py-3">
      <div className="h-4 w-32 rounded bg-gray-200" />
      <div className="h-5 w-20 rounded-full bg-gray-200" />
      <div className="ml-auto h-4 w-16 rounded bg-gray-200" />
    </div>
  )
}

export default function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
      </div>

      {isLoading ? (
        <div className="divide-y divide-gray-100 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No recent activity</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {events.map((event, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 truncate text-sm font-medium text-gray-900">
                {event.repoFullName}
              </span>
              <Badge variant={metricBadgeVariant[event.type]}>
                {formatMetricValue(event.type, event.value)}
              </Badge>
              <span className="shrink-0 text-xs text-gray-400">
                {timeAgo(new Date(event.recordedAt))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
