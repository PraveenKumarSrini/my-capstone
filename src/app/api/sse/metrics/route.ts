import { requireAuth, apiError } from '@/lib/api'
import { subscribe, unsubscribe } from '@/lib/sse'
import { ApiException } from '@/lib/api'
import logger from '@/lib/logger'

const encoder = new TextEncoder()

function sseMessage(eventType: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function GET(_request: Request): Promise<Response> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch (error) {
    if (error instanceof ApiException) {
      return apiError(error.message, error.status)
    }
    return apiError('Internal server error', 500)
  }

  const { activeAccountId } = session.user
  if (!activeAccountId) {
    return apiError('No active GitHub account set', 400)
  }

  let controller: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl

      ctrl.enqueue(sseMessage('connected', { accountId: activeAccountId }))

      subscribe(activeAccountId, ctrl)

      logger.info({ accountId: activeAccountId }, 'SSE client connected')
    },
    cancel() {
      unsubscribe(activeAccountId, controller)
      logger.info({ accountId: activeAccountId }, 'SSE client disconnected')
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
