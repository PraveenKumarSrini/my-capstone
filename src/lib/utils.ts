import { z } from 'zod'
import type { MetricType } from '@prisma/client'

const dateRangeSchema = z.object({
  from: z.string().datetime({ message: 'from must be a valid ISO datetime' }),
  to: z.string().datetime({ message: 'to must be a valid ISO datetime' }),
})

export function buildDateRange(from: string, to: string): { gte: Date; lte: Date } {
  const parsed = dateRangeSchema.parse({ from, to })
  return { gte: new Date(parsed.from), lte: new Date(parsed.to) }
}

const METRIC_LABELS: Record<MetricType, (value: number) => string> = {
  COMMIT_COUNT: (v) => `${v} commit${v !== 1 ? 's' : ''}`,
  PR_OPENED: (v) => `${v} PR${v !== 1 ? 's' : ''} opened`,
  PR_MERGED: (v) => `${v} PR${v !== 1 ? 's' : ''} merged`,
  PR_CLOSED: (v) => `${v} PR${v !== 1 ? 's' : ''} closed`,
  REVIEW_COUNT: (v) => `${v} review${v !== 1 ? 's' : ''}`,
  COMMENT_COUNT: (v) => `${v} comment${v !== 1 ? 's' : ''}`,
}

export function formatMetricValue(type: MetricType, value: number): string {
  return METRIC_LABELS[type](value)
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60) return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
}
