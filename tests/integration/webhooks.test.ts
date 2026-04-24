jest.mock('@/lib/github/processWebhookEvent')

// Prevents Jest from loading @octokit/rest (ESM) while still providing
// a real getWebhookSecretForAccount backed by actual crypto + DB.
// Plain async function (not jest.fn) so jest.resetAllMocks() cannot discard it.
jest.mock('@/lib/github/client', () => ({
  getWebhookSecretForAccount: async (accountId: string) => {
    const { decrypt } = require('@/lib/crypto') as typeof import('@/lib/crypto')
    const { default: db } = require('@/lib/db') as typeof import('@/lib/db')
    const account = await db.gitHubAccount.findUnique({
      where: { id: accountId },
      select: { webhookSecret: true },
    })
    return account?.webhookSecret ? decrypt(account.webhookSecret) : null
  },
}))

import { createHmac } from 'crypto'
import { POST } from '@/app/api/webhooks/github/route'
import { clearDatabase, createTestUser, createTestGitHubAccount, createTestRepo } from 'tests/helpers/db'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/crypto'

const RAW_SECRET = 'test-webhook-secret-value'

function sign(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

function makeRequest(
  body: string,
  headers: Record<string, string>
): Request {
  return new Request('http://localhost/api/webhooks/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

afterAll(async () => { await prisma.$disconnect() })

describe('POST /api/webhooks/github', () => {
  let accId: string
  let repoId: string
  let githubRepoId: number

  beforeEach(async () => {
    await clearDatabase()
    jest.resetAllMocks()

    const user = await createTestUser()
    const acc = await prisma.gitHubAccount.create({
      data: {
        userId: user.id,
        githubLogin: 'testuser',
        accessToken: encrypt('ghp_test'),
        webhookSecret: encrypt(RAW_SECRET),
      },
    })
    accId = acc.id

    githubRepoId = 99999
    const repo = await createTestRepo(acc.id, { fullName: 'owner/test-repo' })
    repoId = repo.id

    await prisma.repository.update({
      where: { id: repo.id },
      data: { githubRepoId },
    })
  })

  it('returns 401 when HMAC signature is invalid', async () => {
    const body = JSON.stringify({ repository: { full_name: 'owner/test-repo', id: githubRepoId } })
    const res = await POST(makeRequest(body, {
      'X-Hub-Signature-256': 'sha256=invalidsignature',
      'X-GitHub-Delivery': 'delivery-001',
      'X-GitHub-Event': 'push',
    }))
    expect(res.status).toBe(401)
  })

  it('returns 200 and persists a PENDING WebhookEvent for a valid push event', async () => {
    const payload = {
      commits: [{ id: 'abc' }],
      head_commit: { timestamp: '2026-01-15T12:00:00Z' },
      repository: { full_name: 'owner/test-repo', id: githubRepoId },
    }
    const body = JSON.stringify(payload)
    const sig = sign(RAW_SECRET, body)

    const res = await POST(makeRequest(body, {
      'X-Hub-Signature-256': sig,
      'X-GitHub-Delivery': 'delivery-001',
      'X-GitHub-Event': 'push',
    }))

    expect(res.status).toBe(200)

    const event = await prisma.webhookEvent.findFirst({ where: { repoId } })
    expect(event).not.toBeNull()
    expect(event?.status).toBe('PENDING')
    expect(event?.deliveryId).toBe('delivery-001')
    expect(event?.eventType).toBe('push')
  })

  it('returns 409 when the same delivery ID is received twice', async () => {
    const payload = { repository: { full_name: 'owner/test-repo', id: githubRepoId } }
    const body = JSON.stringify(payload)
    const sig = sign(RAW_SECRET, body)
    const headers = {
      'X-Hub-Signature-256': sig,
      'X-GitHub-Delivery': 'delivery-dup',
      'X-GitHub-Event': 'push',
    }

    await POST(makeRequest(body, headers))
    const res = await POST(makeRequest(body, headers))
    expect(res.status).toBe(409)
  })

  it('returns 404 when the repo is not found for this account', async () => {
    const payload = { repository: { full_name: 'unknown/repo', id: 0 } }
    const body = JSON.stringify(payload)
    const sig = sign(RAW_SECRET, body)

    const res = await POST(makeRequest(body, {
      'X-Hub-Signature-256': sig,
      'X-GitHub-Delivery': 'delivery-002',
      'X-GitHub-Event': 'push',
    }))
    expect(res.status).toBe(404)
  })

  it('triggers async processing after persisting the event', async () => {
    const { processWebhookEvent } = jest.requireMock('@/lib/github/processWebhookEvent')

    const payload = {
      commits: [],
      repository: { full_name: 'owner/test-repo', id: githubRepoId },
    }
    const body = JSON.stringify(payload)
    const sig = sign(RAW_SECRET, body)

    await POST(makeRequest(body, {
      'X-Hub-Signature-256': sig,
      'X-GitHub-Delivery': 'delivery-003',
      'X-GitHub-Event': 'push',
    }))

    await new Promise((resolve) => setImmediate(resolve))
    expect(processWebhookEvent).toHaveBeenCalled()
  })
})
