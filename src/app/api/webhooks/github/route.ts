import { createHmac, timingSafeEqual } from 'crypto'
import { getWebhookSecretForAccount } from '@/lib/github/client'
import { enqueue, isDuplicate } from '@/lib/db/webhookEventRepo'
import { processWebhookEvent } from '@/lib/github/processWebhookEvent'
import logger from '@/lib/logger'
import prisma from '@/lib/db'

function verifySignature(secret: string, rawBody: string, sigHeader: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader))
  } catch {
    return false
  }
}

export async function POST(request: Request): Promise<Response> {
  const deliveryId = request.headers.get('X-GitHub-Delivery')
  const eventType = request.headers.get('X-GitHub-Event')
  const sigHeader = request.headers.get('X-Hub-Signature-256')

  if (!deliveryId || !eventType || !sigHeader) {
    return Response.json({ success: false, error: 'Missing required headers' }, { status: 400 })
  }

  const rawBody = await request.text()
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const repoData = payload.repository as { full_name?: string; id?: number } | undefined
  if (!repoData?.full_name || repoData.id === undefined) {
    return Response.json({ success: false, error: 'Missing repository in payload' }, { status: 400 })
  }

  const repo = await prisma.repository.findFirst({
    where: { fullName: repoData.full_name, githubRepoId: repoData.id },
  })

  if (!repo) {
    return Response.json({ success: false, error: 'Repository not found' }, { status: 404 })
  }

  const rawSecret = await getWebhookSecretForAccount(repo.githubAccountId)

  if (!rawSecret || !verifySignature(rawSecret, rawBody, sigHeader)) {
    return Response.json({ success: false, error: 'Invalid signature' }, { status: 401 })
  }

  if (await isDuplicate(deliveryId)) {
    return Response.json({ success: false, error: 'Duplicate delivery', code: 'DUPLICATE' }, { status: 409 })
  }

  const event = await enqueue({
    repoId: repo.id,
    deliveryId,
    eventType,
    payload,
  })

  logger.info({ deliveryId, eventType, repoId: repo.id }, 'WebhookEvent enqueued')

  setImmediate(() => {
    void Promise.resolve(processWebhookEvent(event.id)).catch((err: unknown) => {
      logger.error({ eventId: event.id, err }, 'Async processWebhookEvent failed')
    })
  })

  return Response.json({ success: true }, { status: 200 })
}
