import { requireAuth, apiSuccess, apiError, handleApiError } from '@/lib/api'
import { getReposByAccountId } from '@/lib/db/repoRepo'
import { getAggregatedMetrics, getRecentActivity } from '@/lib/db/metricRepo'
import { z } from 'zod'
import type { MetricType } from '@prisma/client'

const DashboardQuerySchema = z.object({
  from: z.string().datetime({ message: 'from must be an ISO datetime' }).optional(),
  to: z.string().datetime({ message: 'to must be an ISO datetime' }).optional(),
})

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth()
    const { activeAccountId } = session.user

    if (!activeAccountId) {
      return apiError('No active GitHub account set', 400)
    }

    const { searchParams } = new URL(request.url)
    const parsed = DashboardQuerySchema.safeParse({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
    })
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400)
    }

    const now = new Date()
    const to = parsed.data.to ? new Date(parsed.data.to) : now
    const from = parsed.data.from
      ? new Date(parsed.data.from)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [aggregated, recentActivity, repos] = await Promise.all([
      getAggregatedMetrics(activeAccountId, from, to),
      getRecentActivity(activeAccountId),
      getReposByAccountId(activeAccountId),
    ])

    const sum = (type: MetricType) =>
      aggregated.filter((m) => m.type === type).reduce((acc, m) => acc + m.total, 0)

    return apiSuccess({
      summary: {
        totalCommits: sum('COMMIT_COUNT'),
        totalPRsOpened: sum('PR_OPENED'),
        totalPRsMerged: sum('PR_MERGED'),
        totalReviews: sum('REVIEW_COUNT'),
      },
      commitTimeline: [],
      prTimeline: [],
      recentActivity: recentActivity.map((a) => ({
        repoFullName: a.repoFullName,
        type: a.type,
        value: a.value,
        recordedAt: a.recordedAt.toISOString(),
      })),
      repos: repos.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        isTracked: r.isTracked,
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
        webhookStatus: r.webhookId ? 'active' : r.isTracked ? 'missing' : 'unregistered',
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
