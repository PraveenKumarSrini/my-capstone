import { requireAuth, apiSuccess, apiError, handleApiError, ApiException } from '@/lib/api'
import { createRepo, getReposByAccountId, updateRepo } from '@/lib/db/repoRepo'
import { getOctokitForAccount } from '@/lib/github/client'
import { registerWebhook } from '@/lib/github/webhooks'
import { fetchMetricsForRepo } from '@/lib/github/metrics'
import { insertMetric } from '@/lib/db/metricRepo'
import { ConnectRepoSchema } from '@/types'
import logger from '@/lib/logger'

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAuth()
    const { activeAccountId } = session.user

    if (!activeAccountId) {
      return apiError('No active GitHub account set', 400)
    }

    const body = await request.json()
    const parsed = ConnectRepoSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400)
    }

    const { fullName } = parsed.data
    const [owner, repo] = fullName.split('/')

    const existing = await getReposByAccountId(activeAccountId)
    if (existing.some((r) => r.fullName === fullName)) {
      throw new ApiException('Repository is already tracked', 409, 'ALREADY_TRACKED')
    }
    if (existing.length >= 30) {
      return apiError('Maximum of 30 repositories per account reached', 400, 'MAX_REPOS')
    }

    const octokit = await getOctokitForAccount(activeAccountId)
    const { data: ghRepo } = await octokit.repos.get({ owner, repo })

    let webhookId: number | null = null
    try {
      webhookId = await registerWebhook(activeAccountId, fullName)
    } catch (webhookError: unknown) {
      const status = (webhookError as { status?: number }).status
      if (status === 422) {
        logger.warn({ fullName }, 'Webhook registration skipped — WEBHOOK_BASE_URL is not publicly reachable')
      } else {
        throw webhookError
      }
    }

    const newRepo = await createRepo({
      githubAccountId: activeAccountId,
      fullName: ghRepo.full_name,
      githubRepoId: ghRepo.id,
      webhookId: webhookId ?? undefined,
    })

    logger.info({ repoId: newRepo.id, fullName }, 'Repository connected')

    setImmediate(async () => {
      try {
        const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const metrics = await fetchMetricsForRepo(octokit, newRepo.id, newRepo.fullName, from, new Date())
        for (const metric of metrics) {
          await insertMetric(metric)
        }
        await updateRepo(newRepo.id, { lastSyncedAt: new Date() })
        logger.info({ repoId: newRepo.id, count: metrics.length }, 'Initial backfill complete')
      } catch (err) {
        logger.error({ err, repoId: newRepo.id }, 'Initial backfill failed')
      }
    })

    return apiSuccess(
      {
        id: newRepo.id,
        fullName: newRepo.fullName,
        isTracked: newRepo.isTracked,
        lastSyncedAt: newRepo.lastSyncedAt?.toISOString() ?? null,
        webhookStatus: newRepo.webhookId ? 'active' : 'missing',
      },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
