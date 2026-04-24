jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    webhookEvent: { findUnique: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([{}, {}]),
    metric: { create: jest.fn().mockReturnValue({}) },
    repository: { update: jest.fn().mockReturnValue({}) },
  },
}))
jest.mock('@/lib/db/webhookEventRepo')
jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }))
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { processWebhookEvent } from '@/lib/github/processWebhookEvent'
import prisma from '@/lib/db'
import * as repo from '@/lib/db/webhookEventRepo'
import * as sse from '@/lib/sse'

const mockPrisma = prisma as {
  webhookEvent: { findUnique: jest.Mock }
  $transaction: jest.Mock
  metric: { create: jest.Mock }
  repository: { update: jest.Mock }
}
const mockMarkProcessing = repo.markProcessing as jest.Mock
const mockMarkProcessed = repo.markProcessed as jest.Mock
const mockMarkFailed = repo.markFailed as jest.Mock
const mockBroadcast = (sse as { broadcast: jest.Mock }).broadcast

const baseEvent = {
  id: 'evt-1',
  repoId: 'repo-1',
  eventType: 'push',
  payload: {},
  repo: { id: 'repo-1', githubAccountId: 'acc-1' },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockMarkProcessing.mockResolvedValue({})
  mockMarkProcessed.mockResolvedValue({})
  mockMarkFailed.mockResolvedValue({})
})

describe('processWebhookEvent', () => {
  it('returns early when event is not found', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
    await processWebhookEvent('missing-id')
    expect(mockMarkProcessing).not.toHaveBeenCalled()
  })

  it('processes push event → inserts COMMIT_COUNT with correct value', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'push',
      payload: { commits: [{ id: 'a' }, { id: 'b' }], head_commit: { timestamp: '2026-01-15T12:00:00Z' } },
    })

    await processWebhookEvent('evt-1')

    expect(mockMarkProcessing).toHaveBeenCalledWith('evt-1')
    expect(mockPrisma.metric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'COMMIT_COUNT', value: 2 }) })
    )
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt-1')
    expect(mockBroadcast).toHaveBeenCalledWith('acc-1', expect.objectContaining({ type: 'metrics_updated' }))
  })

  it('push with zero commits records value 0', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'push',
      payload: { commits: [], head_commit: { timestamp: '2026-01-15T12:00:00Z' } },
    })
    await processWebhookEvent('evt-1')
    expect(mockPrisma.metric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'COMMIT_COUNT', value: 0 }) })
    )
  })

  it('processes pull_request opened → PR_OPENED', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'pull_request',
      payload: { action: 'opened', pull_request: { merged: false, created_at: '2026-01-15T12:00:00Z' } },
    })
    await processWebhookEvent('evt-1')
    expect(mockPrisma.metric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PR_OPENED' }) })
    )
  })

  it('processes pull_request closed+merged → PR_MERGED', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'pull_request',
      payload: { action: 'closed', pull_request: { merged: true } },
    })
    await processWebhookEvent('evt-1')
    expect(mockPrisma.metric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PR_MERGED' }) })
    )
  })

  it('processes pull_request closed not merged → PR_CLOSED', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'pull_request',
      payload: { action: 'closed', pull_request: { merged: false } },
    })
    await processWebhookEvent('evt-1')
    expect(mockPrisma.metric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'PR_CLOSED' }) })
    )
  })

  it('processes pull_request_review submitted → REVIEW_COUNT', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'pull_request_review',
      payload: { action: 'submitted', review: { submitted_at: '2026-01-15T12:00:00Z' } },
    })
    await processWebhookEvent('evt-1')
    expect(mockPrisma.metric.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'REVIEW_COUNT' }) })
    )
  })

  it('marks failed for unhandled event type', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'unknown_event',
      payload: {},
    })
    await processWebhookEvent('evt-1')
    expect(mockMarkFailed).toHaveBeenCalledWith('evt-1', expect.stringContaining('Unhandled event type'))
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('marks failed when pull_request action is neither opened nor closed', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'pull_request',
      payload: { action: 'labeled', pull_request: {} },
    })
    await processWebhookEvent('evt-1')
    expect(mockMarkFailed).toHaveBeenCalledWith('evt-1', expect.stringContaining('Unhandled'))
  })

  it('marks failed and does not rethrow when transaction throws', async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      ...baseEvent,
      eventType: 'push',
      payload: { commits: [{ id: 'a' }] },
    })
    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'))

    await expect(processWebhookEvent('evt-1')).resolves.toBeUndefined()
    expect(mockMarkFailed).toHaveBeenCalledWith('evt-1', 'DB error')
    expect(mockBroadcast).not.toHaveBeenCalled()
  })
})
