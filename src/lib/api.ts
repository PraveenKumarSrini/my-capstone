import { auth } from '@/lib/auth'
import { getAccountById } from '@/lib/db/accountRepo'
import type { GitHubAccount } from '@prisma/client'
import type { Session } from 'next-auth'
import type { ApiSuccess, ApiError } from '@/types'
import logger from '@/lib/logger'

export class ApiException extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'ApiException'
  }
}

export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } satisfies ApiSuccess<T>, { status })
}

export function apiError(message: string, status: number, code?: string): Response {
  const body: ApiError = { success: false, error: message, ...(code && { code }) }
  return Response.json(body, { status })
}

export async function requireAuth(): Promise<Session> {
  const session = await auth()
  if (!session?.user?.id) throw new ApiException('Unauthorized', 401)
  return session
}

export async function requireOwnership(
  accountId: string,
  userId: string
): Promise<GitHubAccount> {
  const account = await getAccountById(accountId)
  if (!account || account.userId !== userId) throw new ApiException('Not found', 404)
  return account
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiException) {
    return apiError(error.message, error.status, error.code)
  }
  logger.error({ error }, 'Unhandled API error')
  return apiError('Internal server error', 500)
}
