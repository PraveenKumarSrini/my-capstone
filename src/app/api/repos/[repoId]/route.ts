import { requireAuth, apiSuccess, handleApiError, ApiException } from '@/lib/api'
import { getRepoById, updateRepo } from '@/lib/db/repoRepo'
import { deleteWebhook } from '@/lib/github/webhooks'
import { PatchRepoSchema } from '@/types'
import logger from '@/lib/logger'

type RouteContext = { params: Promise<{ repoId: string }> }

async function requireRepoOwnership(repoId: string, userId: string) {
  const repo = await getRepoById(repoId)
  if (!repo) throw new ApiException('Not found', 404)

  const { getAccountById } = await import('@/lib/db/accountRepo')
  const account = await getAccountById(repo.githubAccountId)
  if (!account || account.userId !== userId) throw new ApiException('Not found', 404)

  return { repo, account }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { repoId } = await params
    const session = await requireAuth()

    const body = await request.json()
    const parsed = PatchRepoSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { repo, account } = await requireRepoOwnership(repoId, session.user.id)
    const { isTracked } = parsed.data

    if (!isTracked && repo.webhookId) {
      await deleteWebhook(account.id, repo.fullName, repo.webhookId)
    }

    const updated = await updateRepo(repoId, {
      isTracked,
      webhookId: isTracked ? repo.webhookId : null,
    })

    logger.info({ repoId, isTracked }, 'Repository tracking updated')

    return apiSuccess({
      id: updated.id,
      fullName: updated.fullName,
      isTracked: updated.isTracked,
      lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
      webhookStatus: updated.webhookId ? 'active' : updated.isTracked ? 'missing' : 'unregistered',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
