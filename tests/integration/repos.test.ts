jest.mock('@/lib/auth')
jest.mock('@/lib/github/client')
jest.mock('@/lib/github/webhooks')
jest.mock('@/lib/github/metrics')

import { GET as GET_REPOS } from '@/app/api/repos/route'
import { POST as CONNECT_REPO } from '@/app/api/repos/connect/route'
import { PATCH } from '@/app/api/repos/[repoId]/route'
import { GET as GET_METRICS } from '@/app/api/repos/[repoId]/metrics/route'
import { clearDatabase, createTestUser, createTestGitHubAccount, createTestRepo } from 'tests/helpers/db'
import prisma from '@/lib/db'
import * as authLib from '@/lib/auth'
import * as webhooksLib from '@/lib/github/webhooks'

const mockAuth = authLib.auth as jest.MockedFunction<typeof authLib.auth>
const mockRegisterWebhook = webhooksLib.registerWebhook as jest.MockedFunction<typeof webhooksLib.registerWebhook>

afterAll(async () => { await prisma.$disconnect() })

describe('GET /api/repos', () => {
  beforeEach(async () => { await clearDatabase(); jest.resetAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await GET_REPOS(new Request('http://localhost/api/repos'))
    expect(res.status).toBe(401)
  })

  it('returns repos for the active account only', async () => {
    const user = await createTestUser()
    const acc1 = await createTestGitHubAccount(user.id, { githubLogin: 'acc1' })
    const acc2 = await createTestGitHubAccount(user.id, { githubLogin: 'acc2' })
    await createTestRepo(acc1.id, { fullName: 'acc1/repo' })
    await createTestRepo(acc2.id, { fullName: 'acc2/repo' })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc1.id } } as never)

    const res = await GET_REPOS(new Request('http://localhost/api/repos'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].fullName).toBe('acc1/repo')
  })

  it('returns 400 when no active account is set', async () => {
    const user = await createTestUser()
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    const res = await GET_REPOS(new Request('http://localhost/api/repos'))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/repos/connect', () => {
  beforeEach(async () => { await clearDatabase(); jest.resetAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await CONNECT_REPO(new Request('http://localhost/api/repos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'owner/repo' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when fullName format is invalid', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await CONNECT_REPO(new Request('http://localhost/api/repos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'not-valid' }),
    }))
    expect(res.status).toBe(400)
  })

  it('creates repo and registers webhook', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)
    mockRegisterWebhook.mockResolvedValueOnce(42)

    const mockOctokit = {
      repos: { get: jest.fn().mockResolvedValue({ data: { id: 99999, full_name: 'owner/my-repo' } }) },
    }
    const { getOctokitForAccount } = jest.requireMock('@/lib/github/client')
    getOctokitForAccount.mockResolvedValueOnce(mockOctokit)

    const res = await CONNECT_REPO(new Request('http://localhost/api/repos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'owner/my-repo' }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.fullName).toBe('owner/my-repo')
    expect(body.data.isTracked).toBe(true)
  })

  it('returns 409 when repo is already tracked', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    await createTestRepo(acc.id, { fullName: 'owner/existing' })
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const mockOctokit = {
      repos: { get: jest.fn().mockResolvedValue({ data: { id: 11111, full_name: 'owner/existing' } }) },
    }
    const { getOctokitForAccount } = jest.requireMock('@/lib/github/client')
    getOctokitForAccount.mockResolvedValueOnce(mockOctokit)

    const res = await CONNECT_REPO(new Request('http://localhost/api/repos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'owner/existing' }),
    }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/repos/:repoId', () => {
  beforeEach(async () => { await clearDatabase(); jest.resetAllMocks() })

  it('returns 404 when repo belongs to another user', async () => {
    const owner = await createTestUser({ email: 'o@example.com' })
    const other = await createTestUser({ email: 'x@example.com' })
    const acc = await createTestGitHubAccount(owner.id)
    const repo = await createTestRepo(acc.id)
    mockAuth.mockResolvedValueOnce({ user: { id: other.id, email: other.email!, activeAccountId: null } } as never)

    const res = await PATCH(
      new Request(`http://localhost/api/repos/${repo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTracked: false }),
      }),
      { params: Promise.resolve({ repoId: repo.id }) }
    )
    expect(res.status).toBe(404)
  })

  it('sets isTracked false and removes webhook', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    const repo = await createTestRepo(acc.id, { isTracked: true })
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await PATCH(
      new Request(`http://localhost/api/repos/${repo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTracked: false }),
      }),
      { params: Promise.resolve({ repoId: repo.id }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.isTracked).toBe(false)

    const { deleteWebhook } = jest.requireMock('@/lib/github/webhooks')
    expect(deleteWebhook).toHaveBeenCalled()
  })

  it('returns 400 for invalid body', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    const repo = await createTestRepo(acc.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await PATCH(
      new Request(`http://localhost/api/repos/${repo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTracked: 'not-a-bool' }),
      }),
      { params: Promise.resolve({ repoId: repo.id }) }
    )
    expect(res.status).toBe(400)
  })
})

describe('GET /api/repos/:repoId/metrics', () => {
  beforeEach(async () => { await clearDatabase(); jest.resetAllMocks() })

  it('returns 400 when query params are missing', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    const repo = await createTestRepo(acc.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await GET_METRICS(
      new Request(`http://localhost/api/repos/${repo.id}/metrics`),
      { params: Promise.resolve({ repoId: repo.id }) }
    )
    expect(res.status).toBe(400)
  })

  it('returns metrics for the correct date range and type', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    const repo = await createTestRepo(acc.id)

    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-01-31T23:59:59Z')
    const inRange = new Date('2026-01-15T12:00:00Z')
    const outRange = new Date('2025-12-01T12:00:00Z')

    await prisma.metric.createMany({
      data: [
        { repoId: repo.id, type: 'COMMIT_COUNT', value: 5, recordedAt: inRange },
        { repoId: repo.id, type: 'COMMIT_COUNT', value: 2, recordedAt: outRange },
        { repoId: repo.id, type: 'PR_OPENED', value: 1, recordedAt: inRange },
      ],
    })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const url = `http://localhost/api/repos/${repo.id}/metrics?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z&type=COMMIT_COUNT`
    const res = await GET_METRICS(new Request(url), { params: Promise.resolve({ repoId: repo.id }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].value).toBe(5)
    expect(body.data[0].type).toBe('COMMIT_COUNT')
  })

  it('returns 404 for another user\'s repo', async () => {
    const owner = await createTestUser({ email: 'o@example.com' })
    const other = await createTestUser({ email: 'x@example.com' })
    const acc = await createTestGitHubAccount(owner.id)
    const repo = await createTestRepo(acc.id)
    mockAuth.mockResolvedValueOnce({ user: { id: other.id, email: other.email!, activeAccountId: null } } as never)

    const url = `http://localhost/api/repos/${repo.id}/metrics?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z&type=COMMIT_COUNT`
    const res = await GET_METRICS(new Request(url), { params: Promise.resolve({ repoId: repo.id }) })
    expect(res.status).toBe(404)
  })
})
