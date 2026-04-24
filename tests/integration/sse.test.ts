jest.mock('@/lib/auth')

import { GET } from '@/app/api/sse/metrics/route'
import { clearDatabase, createTestUser, createTestGitHubAccount } from 'tests/helpers/db'
import prisma from '@/lib/db'
import * as authLib from '@/lib/auth'

const mockAuth = authLib.auth as jest.MockedFunction<typeof authLib.auth>

afterAll(async () => { await prisma.$disconnect() })

describe('GET /api/sse/metrics', () => {
  beforeEach(async () => { await clearDatabase(); jest.resetAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await GET(new Request('http://localhost/api/sse/metrics'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no active account is set', async () => {
    const user = await createTestUser()
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    const res = await GET(new Request('http://localhost/api/sse/metrics'))
    expect(res.status).toBe(400)
  })

  it('returns a text/event-stream response for an authenticated user', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await GET(new Request('http://localhost/api/sse/metrics'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
  })

  it('sends a connected event on initial connection', async () => {
    const user = await createTestUser()
    const acc = await createTestGitHubAccount(user.id)
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc.id } } as never)

    const res = await GET(new Request('http://localhost/api/sse/metrics'))
    expect(res.body).not.toBeNull()

    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    expect(text).toContain('event: connected')
    reader.cancel()
  })
})
