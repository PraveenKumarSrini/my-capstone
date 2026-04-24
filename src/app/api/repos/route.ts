import { requireAuth, apiSuccess, apiError, handleApiError } from '@/lib/api'
import { getReposByAccountId } from '@/lib/db/repoRepo'
import type { RepositoryDTO } from '@/types'
import type { Repository } from '@prisma/client'

function toDTO(repo: Repository): RepositoryDTO {
  return {
    id: repo.id,
    fullName: repo.fullName,
    isTracked: repo.isTracked,
    lastSyncedAt: repo.lastSyncedAt?.toISOString() ?? null,
    webhookStatus: repo.webhookId ? 'active' : repo.isTracked ? 'missing' : 'unregistered',
  }
}

export async function GET(_request: Request): Promise<Response> {
  try {
    const session = await requireAuth()
    const { activeAccountId } = session.user

    if (!activeAccountId) {
      return apiError('No active GitHub account set', 400)
    }

    const repos = await getReposByAccountId(activeAccountId)
    return apiSuccess(repos.map(toDTO))
  } catch (error) {
    return handleApiError(error)
  }
}
