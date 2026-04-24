import { requireAuth, requireOwnership, apiSuccess, handleApiError } from '@/lib/api'
import { updateActiveAccount } from '@/lib/db/userRepo'
import logger from '@/lib/logger'

type RouteContext = { params: Promise<{ accountId: string }> }

export async function POST(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { accountId } = await params
    const session = await requireAuth()
    await requireOwnership(accountId, session.user.id)

    await updateActiveAccount(session.user.id, accountId)

    logger.info({ userId: session.user.id, accountId }, 'Active account switched')
    return apiSuccess({ activeAccountId: accountId })
  } catch (error) {
    return handleApiError(error)
  }
}
