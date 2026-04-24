import { z } from 'zod'
import { requireAuth, apiSuccess, apiError, handleApiError } from '@/lib/api'
import {
  getAccountsByUserId,
  createAccount,
} from '@/lib/db/accountRepo'
import { updateActiveAccount } from '@/lib/db/userRepo'
import { encrypt } from '@/lib/crypto'
import logger from '@/lib/logger'
import type { GitHubAccountDTO } from '@/types'
import type { GitHubAccount } from '@prisma/client'

const ConnectAccountSchema = z.object({
  accessToken: z.string().min(1),
  githubLogin: z.string().min(1),
  avatarUrl: z.string().url().nullable().optional(),
  displayName: z.string().optional(),
})

function toDTO(account: GitHubAccount): GitHubAccountDTO {
  return {
    id: account.id,
    githubLogin: account.githubLogin,
    avatarUrl: account.avatarUrl ?? null,
    displayName: account.displayName ?? null,
    createdAt: account.createdAt.toISOString(),
  }
}

export async function GET(_request: Request): Promise<Response> {
  try {
    const session = await requireAuth()
    const accounts = await getAccountsByUserId(session.user.id)
    return apiSuccess(accounts.map(toDTO))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const parsed = ConnectAccountSchema.safeParse(body)

    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const { accessToken, githubLogin, avatarUrl, displayName } = parsed.data

    const existing = await getAccountsByUserId(session.user.id)
    const alreadyLinked = existing.find((a) => a.githubLogin === githubLogin)
    if (alreadyLinked) return apiError('GitHub account already connected', 409, 'ALREADY_CONNECTED')

    if (existing.length >= 10) {
      return apiError('Maximum of 10 GitHub accounts reached', 400, 'MAX_ACCOUNTS')
    }

    const encryptedToken = encrypt(accessToken)
    const account = await createAccount({
      userId: session.user.id,
      githubLogin,
      accessToken: encryptedToken,
      avatarUrl: avatarUrl ?? undefined,
      displayName,
    })

    if (existing.length === 0) {
      await updateActiveAccount(session.user.id, account.id)
      logger.info({ userId: session.user.id, accountId: account.id }, 'First GitHub account set as active')
    }

    logger.info({ userId: session.user.id, githubLogin }, 'GitHub account connected')
    return apiSuccess(toDTO(account), 201)
  } catch (error) {
    return handleApiError(error)
  }
}
