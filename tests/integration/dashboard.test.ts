jest.mock('@/lib/auth')

import { GET } from '@/app/api/dashboard/route'
import { clearDatabase, createTestUser, createTestGitHubAccount, createTestRepo } from 'tests/helpers/db'
import prisma from '@/lib/db'
import * as authLib from '@/lib/auth'

const mockAuth = authLib.auth as jest.MockedFunction<typeof authLib.auth>

afterAll(async () => { await prisma.$disconnect() })

describe('GET /api/dashboard', () => {
  beforeEach(async () => { await clearDatabase(); jest.resetAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await GET(new Request('http://localhost/api/dashboard?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no active account is set', async () => {
    const user = await createTestUser()
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    const res = await GET(new Request('http://localhost/api/dashboard?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with defaults when query params are omitted', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await GET(new Request('http://localhost/api/dashboard'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns aggregated dashboard data with correct structure', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    const repo = await createTestRepo(acc.id, { fullName: 'owner/repo', isTracked: true })

    const inRange = new Date('2026-01-15T12:00:00Z')

    await prisma.metric.createMany({
      data: [
        { repoId: repo.id, type: 'COMMIT_COUNT', value: 10, recordedAt: inRange },
        { repoId: repo.id, type: 'PR_OPENED', value: 3, recordedAt: inRange },
        { repoId: repo.id, type: 'PR_MERGED', value: 2, recordedAt: inRange },
        { repoId: repo.id, type: 'REVIEW_COUNT', value: 5, recordedAt: inRange },
      ],
    })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await GET(new Request('http://localhost/api/dashboard?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('summary')
    expect(body.data).toHaveProperty('commitTimeline')
    expect(body.data).toHaveProperty('prTimeline')
    expect(body.data).toHaveProperty('recentActivity')
    expect(body.data).toHaveProperty('repos')

    expect(body.data.summary.totalCommits).toBe(10)
    expect(body.data.summary.totalPRsOpened).toBe(3)
    expect(body.data.summary.totalPRsMerged).toBe(2)
    expect(body.data.summary.totalReviews).toBe(5)
  })

  it('excludes metrics outside the date range', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    const repo = await createTestRepo(acc.id, { isTracked: true })

    await prisma.metric.createMany({
      data: [
        { repoId: repo.id, type: 'COMMIT_COUNT', value: 5, recordedAt: new Date('2026-01-15T00:00:00Z') },
        { repoId: repo.id, type: 'COMMIT_COUNT', value: 99, recordedAt: new Date('2025-12-01T00:00:00Z') },
      ],
    })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await GET(new Request('http://localhost/api/dashboard?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z'))
    const body = await res.json()
    expect(body.data.summary.totalCommits).toBe(5)
  })

  it('returns empty data when account has no tracked repos', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await GET(new Request('http://localhost/api/dashboard?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.summary.totalCommits).toBe(0)
    expect(body.data.repos).toHaveLength(0)
    expect(body.data.recentActivity).toHaveLength(0)
  })
})
