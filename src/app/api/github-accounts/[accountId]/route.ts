import { requireAuth, requireOwnership, apiSuccess, apiError, handleApiError } from '@/lib/api'
import { deleteAccount, getAccountsByUserId } from '@/lib/db/accountRepo'
import { getReposByAccountId } from '@/lib/db/repoRepo'
import { deleteWebhook } from '@/lib/github/webhooks'
import logger from '@/lib/logger'
import type { GitHubAccountDTO } from '@/types'
import type { GitHubAccount } from '@prisma/client'

type RouteContext = { params: Promise<{ accountId: string }> }

function toDTO(account: GitHubAccount): GitHubAccountDTO {
  return {
    id: account.id,
    githubLogin: account.githubLogin,
    avatarUrl: account.avatarUrl ?? null,
    displayName: account.displayName ?? null,
    createdAt: account.createdAt.toISOString(),
  }
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { accountId } = await params
    const session = await requireAuth()
    const account = await requireOwnership(accountId, session.user.id)
    return apiSuccess(toDTO(account))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { accountId } = await params
    const session = await requireAuth()
    const account = await requireOwnership(accountId, session.user.id)

    const allAccounts = await getAccountsByUserId(session.user.id)
    const isLastAndActive =
      allAccounts.length === 1 && session.user.activeAccountId === accountId

    if (isLastAndActive) {
      return apiError('Cannot disconnect the only active account', 409, 'LAST_ACTIVE_ACCOUNT')
    }

    const repos = await getReposByAccountId(accountId)
    for (const repo of repos) {
      if (repo.webhookId) {
        try {
          await deleteWebhook(accountId, repo.fullName, repo.webhookId)
        } catch {
          logger.warn({ repoId: repo.id }, 'Failed to delete webhook during account disconnect')
        }
      }
    }

    await deleteAccount(account.id)
    logger.info({ accountId, userId: session.user.id }, 'GitHub account disconnected')
    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
