import { Prisma, type WebhookEvent } from '@prisma/client'
import prisma from '@/lib/db'

export async function enqueue(data: {
  repoId: string
  deliveryId: string
  eventType: string
  payload: Record<string, unknown>
}): Promise<WebhookEvent> {
  return prisma.webhookEvent.create({
    data: {
      repoId: data.repoId,
      deliveryId: data.deliveryId,
      eventType: data.eventType,
      payload: data.payload as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  })
}

export async function markProcessing(id: string): Promise<WebhookEvent> {
  return prisma.webhookEvent.update({
    where: { id },
    data: { status: 'PROCESSING' },
  })
}

export async function markProcessed(id: string): Promise<WebhookEvent> {
  return prisma.webhookEvent.update({
    where: { id },
    data: { status: 'PROCESSED', processedAt: new Date() },
  })
}

export async function markFailed(id: string, error: string): Promise<WebhookEvent> {
  return prisma.webhookEvent.update({
    where: { id },
    data: {
      status: 'FAILED',
      error,
      retryCount: { increment: 1 },
    },
  })
}

export async function getPendingAndFailed(maxRetries: number): Promise<WebhookEvent[]> {
  return prisma.webhookEvent.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'FAILED', retryCount: { lt: maxRetries } },
      ],
    },
    orderBy: { receivedAt: 'asc' },
  })
}

export async function isDuplicate(deliveryId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({ where: { deliveryId } })
  return existing !== null
}
