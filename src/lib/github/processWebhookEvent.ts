import prisma from '@/lib/db'
import { markProcessing, markProcessed, markFailed } from '@/lib/db/webhookEventRepo'
import { broadcast } from '@/lib/sse'
import logger from '@/lib/logger'
import type { MetricType } from '@prisma/client'

type PushPayload = {
  commits?: unknown[]
  head_commit?: { timestamp?: string }
}

type PRPayload = {
  action?: string
  pull_request?: { merged?: boolean; created_at?: string }
}

type ReviewPayload = {
  action?: string
  review?: { submitted_at?: string }
}

export async function processWebhookEvent(eventId: string): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    include: { repo: true },
  })

  if (!event) {
    logger.warn({ eventId }, 'WebhookEvent not found')
    return
  }

  await markProcessing(eventId)

  try {
    const payload = event.payload as Record<string, unknown>
    let type: MetricType | null = null
    let value = 1
    let recordedAt = new Date()

    if (event.eventType === 'push') {
      const p = payload as PushPayload
      type = 'COMMIT_COUNT'
      value = Array.isArray(p.commits) ? p.commits.length : 0
      if (p.head_commit?.timestamp) recordedAt = new Date(p.head_commit.timestamp)
    } else if (event.eventType === 'pull_request') {
      const p = payload as PRPayload
      if (p.action === 'opened') {
        type = 'PR_OPENED'
        if (p.pull_request?.created_at) recordedAt = new Date(p.pull_request.created_at)
      } else if (p.action === 'closed') {
        type = p.pull_request?.merged ? 'PR_MERGED' : 'PR_CLOSED'
      }
    } else if (event.eventType === 'pull_request_review') {
      const p = payload as ReviewPayload
      if (p.action === 'submitted') {
        type = 'REVIEW_COUNT'
        if (p.review?.submitted_at) recordedAt = new Date(p.review.submitted_at)
      }
    }

    if (type === null) {
      logger.warn({ eventId, eventType: event.eventType }, 'Unhandled event type')
      await markFailed(eventId, `Unhandled event type: ${event.eventType}`)
      return
    }

    await prisma.$transaction([
      prisma.metric.create({ data: { repoId: event.repoId, type, value, recordedAt } }),
      prisma.repository.update({ where: { id: event.repoId }, data: { lastSyncedAt: new Date() } }),
    ])

    await markProcessed(eventId)

    broadcast(event.repo.githubAccountId, {
      type: 'metrics_updated',
      repoId: event.repoId,
      accountId: event.repo.githubAccountId,
    })

    logger.info({ eventId, type, value }, 'WebhookEvent processed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ eventId, error }, 'Failed to process WebhookEvent')
    await markFailed(eventId, message)
  }
}
