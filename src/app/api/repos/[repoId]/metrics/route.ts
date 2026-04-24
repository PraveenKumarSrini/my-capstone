import { requireAuth, apiSuccess, apiError, handleApiError, ApiException } from '@/lib/api'
import { getRepoById } from '@/lib/db/repoRepo'
import { getMetrics } from '@/lib/db/metricRepo'
import { MetricsQuerySchema } from '@/types'
import type { MetricType } from '@prisma/client'

type RouteContext = { params: Promise<{ repoId: string }> }

export async function GET(
  request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { repoId } = await params
    const session = await requireAuth()

    const repo = await getRepoById(repoId)
    if (!repo) throw new ApiException('Not found', 404)

    const { getAccountById } = await import('@/lib/db/accountRepo')
    const account = await getAccountById(repo.githubAccountId)
    if (!account || account.userId !== session.user.id) throw new ApiException('Not found', 404)

    const { searchParams } = new URL(request.url)
    const query = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      type: searchParams.get('type') ?? undefined,
    }

    const parsed = MetricsQuerySchema.safeParse(query)
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400)
    }

    const metrics = await getMetrics({
      repoId,
      type: parsed.data.type as MetricType,
      from: new Date(parsed.data.from),
      to: new Date(parsed.data.to),
    })

    return apiSuccess(
      metrics.map((m) => ({
        id: m.id,
        type: m.type,
        value: m.value,
        recordedAt: m.recordedAt.toISOString(),
        metadata: m.metadata as Record<string, unknown> | null,
      }))
    )
  } catch (error) {
    return handleApiError(error)
  }
}
