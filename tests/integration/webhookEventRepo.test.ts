import { clearDatabase, createTestUser, createTestGitHubAccount, createTestRepo } from 'tests/helpers/db'
import prisma from '@/lib/db'
import {
  enqueue,
  markProcessing,
  markProcessed,
  markFailed,
  getPendingAndFailed,
  isDuplicate,
} from '@/lib/db/webhookEventRepo'

afterAll(async () => { await prisma.$disconnect() })

describe('webhookEventRepo', () => {
  let repoId: string

  beforeEach(async () => {
    await clearDatabase()
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    const repo = await createTestRepo(acc.id)
    repoId = repo.id
  })

  describe('enqueue', () => {
    it('creates a PENDING WebhookEvent', async () => {
      const event = await enqueue({
        repoId,
        deliveryId: 'delivery-001',
        eventType: 'push',
        payload: { commits: [] },
      })
      expect(event.status).toBe('PENDING')
      expect(event.deliveryId).toBe('delivery-001')
      expect(event.eventType).toBe('push')
      expect(event.retryCount).toBe(0)
    })

    it('rejects duplicate deliveryId with unique constraint error', async () => {
      await enqueue({ repoId, deliveryId: 'dup-001', eventType: 'push', payload: {} })
      await expect(
        enqueue({ repoId, deliveryId: 'dup-001', eventType: 'push', payload: {} })
      ).rejects.toThrow()
    })
  })

  describe('markProcessing', () => {
    it('sets status to PROCESSING', async () => {
      const evt = await enqueue({ repoId, deliveryId: 'd-002', eventType: 'push', payload: {} })
      const updated = await markProcessing(evt.id)
      expect(updated.status).toBe('PROCESSING')
    })
  })

  describe('markProcessed', () => {
    it('sets status to PROCESSED and records processedAt', async () => {
      const evt = await enqueue({ repoId, deliveryId: 'd-003', eventType: 'push', payload: {} })
      await markProcessing(evt.id)
      const updated = await markProcessed(evt.id)
      expect(updated.status).toBe('PROCESSED')
      expect(updated.processedAt).toBeInstanceOf(Date)
    })
  })

  describe('markFailed', () => {
    it('sets status to FAILED, stores error, and increments retryCount', async () => {
      const evt = await enqueue({ repoId, deliveryId: 'd-004', eventType: 'push', payload: {} })
      const updated = await markFailed(evt.id, 'token expired')
      expect(updated.status).toBe('FAILED')
      expect(updated.error).toBe('token expired')
      expect(updated.retryCount).toBe(1)
    })

    it('increments retryCount on repeated failures', async () => {
      const evt = await enqueue({ repoId, deliveryId: 'd-005', eventType: 'push', payload: {} })
      await markFailed(evt.id, 'err1')
      const second = await markFailed(evt.id, 'err2')
      expect(second.retryCount).toBe(2)
    })
  })

  describe('getPendingAndFailed', () => {
    it('returns PENDING events', async () => {
      await enqueue({ repoId, deliveryId: 'd-p1', eventType: 'push', payload: {} })
      const result = await getPendingAndFailed(3)
      expect(result.some((e) => e.deliveryId === 'd-p1')).toBe(true)
    })

    it('returns FAILED events below maxRetries', async () => {
      const evt = await enqueue({ repoId, deliveryId: 'd-f1', eventType: 'push', payload: {} })
      await markFailed(evt.id, 'err')
      const result = await getPendingAndFailed(3)
      expect(result.some((e) => e.deliveryId === 'd-f1')).toBe(true)
    })

    it('excludes FAILED events at or above maxRetries', async () => {
      const evt = await enqueue({ repoId, deliveryId: 'd-f2', eventType: 'push', payload: {} })
      await markFailed(evt.id, 'e1')
      await markFailed(evt.id, 'e2')
      await markFailed(evt.id, 'e3')
      const result = await getPendingAndFailed(3)
      expect(result.some((e) => e.deliveryId === 'd-f2')).toBe(false)
    })

    it('excludes PROCESSED events', async () => {
      const evt = await enqueue({ repoId, deliveryId: 'd-ok', eventType: 'push', payload: {} })
      await markProcessing(evt.id)
      await markProcessed(evt.id)
      const result = await getPendingAndFailed(3)
      expect(result.some((e) => e.deliveryId === 'd-ok')).toBe(false)
    })
  })

  describe('isDuplicate', () => {
    it('returns false when deliveryId is new', async () => {
      const result = await isDuplicate('brand-new-delivery')
      expect(result).toBe(false)
    })

    it('returns true when deliveryId already exists', async () => {
      await enqueue({ repoId, deliveryId: 'known-delivery', eventType: 'push', payload: {} })
      const result = await isDuplicate('known-delivery')
      expect(result).toBe(true)
    })
  })
})
