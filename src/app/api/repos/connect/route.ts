import { requireAuth, apiSuccess, apiError, handleApiError, ApiException } from '@/lib/api'
import { createRepo, getReposByAccountId } from '@/lib/db/repoRepo'
import { getOctokitForAccount } from '@/lib/github/client'
import { registerWebhook } from '@/lib/github/webhooks'
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

    const octokit = await getOctokitForAccount(activeAccountId)
    const { data: ghRepo } = await octokit.repos.get({ owner, repo })

    const webhookId = await registerWebhook(activeAccountId, fullName)

    const newRepo = await createRepo({
      githubAccountId: activeAccountId,
      fullName: ghRepo.full_name,
      githubRepoId: ghRepo.id,
      webhookId,
    })

    logger.info({ repoId: newRepo.id, fullName }, 'Repository connected')

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
