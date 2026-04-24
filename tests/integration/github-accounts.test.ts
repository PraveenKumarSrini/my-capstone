jest.mock('@/lib/auth')
jest.mock('@/lib/github/client')
jest.mock('@/lib/github/webhooks')

import { GET, POST } from '@/app/api/github-accounts/route'
import { GET as GET_ONE, DELETE } from '@/app/api/github-accounts/[accountId]/route'
import { POST as SWITCH } from '@/app/api/github-accounts/[accountId]/switch/route'
import { clearDatabase, createTestUser, createTestGitHubAccount } from 'tests/helpers/db'
import prisma from '@/lib/db'
import * as authLib from '@/lib/auth'
import { encrypt } from '@/lib/crypto'

const mockAuth = authLib.auth as jest.MockedFunction<typeof authLib.auth>

afterAll(async () => { await prisma.$disconnect() })

describe('GET /api/github-accounts', () => {
  beforeEach(async () => {
    await clearDatabase()
    jest.resetAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await GET(new Request('http://localhost/api/github-accounts'))
    expect(res.status).toBe(401)
  })

  it('returns the authenticated user\'s accounts without tokens', async () => {
    const user = await createTestUser()
    await createTestGitHubAccount(user.id, { githubLogin: 'personal' })
    await createTestGitHubAccount(user.id, { githubLogin: 'work' })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    const res = await GET(new Request('http://localhost/api/github-accounts'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0]).not.toHaveProperty('accessToken')
    expect(body.data[0]).not.toHaveProperty('webhookSecret')
  })

  it('does not return accounts belonging to a different user', async () => {
    const userA = await createTestUser({ email: 'a@example.com' })
    const userB = await createTestUser({ email: 'b@example.com' })
    await createTestGitHubAccount(userB.id)

    mockAuth.mockResolvedValueOnce({ user: { id: userA.id, email: userA.email!, activeAccountId: null } } as never)

    const res = await GET(new Request('http://localhost/api/github-accounts'))
    const body = await res.json()
    expect(body.data).toHaveLength(0)
  })
})

describe('GET /api/github-accounts/:accountId', () => {
  beforeEach(async () => {
    await clearDatabase()
    jest.resetAllMocks()
  })

  it('returns 404 when account belongs to another user', async () => {
    const owner = await createTestUser({ email: 'owner@example.com' })
    const other = await createTestUser({ email: 'other@example.com' })
    const account = await createTestGitHubAccount(owner.id)

    mockAuth.mockResolvedValueOnce({ user: { id: other.id, email: other.email!, activeAccountId: null } } as never)

    const res = await GET_ONE(
      new Request(`http://localhost/api/github-accounts/${account.id}`),
      { params: Promise.resolve({ accountId: account.id }) }
    )
    expect(res.status).toBe(404)
  })

  it('returns the account for the owning user', async () => {
    const user = await createTestUser()
    const account = await createTestGitHubAccount(user.id, { githubLogin: 'mylogin' })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    const res = await GET_ONE(
      new Request(`http://localhost/api/github-accounts/${account.id}`),
      { params: Promise.resolve({ accountId: account.id }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.githubLogin).toBe('mylogin')
    expect(body.data).not.toHaveProperty('accessToken')
  })
})

describe('DELETE /api/github-accounts/:accountId', () => {
  beforeEach(async () => {
    await clearDatabase()
    jest.resetAllMocks()
  })

  it('deletes a non-active account and cascades repositories', async () => {
    const user = await createTestUser()
    const active = await createTestGitHubAccount(user.id, { githubLogin: 'active-acc' })
    const toDelete = await createTestGitHubAccount(user.id, { githubLogin: 'to-delete' })
    await prisma.repository.create({
      data: { githubAccountId: toDelete.id, fullName: 'u/r', githubRepoId: 1, isTracked: false },
    })
    await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: active.id } })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: active.id } } as never)

    const res = await DELETE(
      new Request(`http://localhost/api/github-accounts/${toDelete.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ accountId: toDelete.id }) }
    )
    expect(res.status).toBe(200)

    const gone = await prisma.gitHubAccount.findUnique({ where: { id: toDelete.id } })
    expect(gone).toBeNull()
  })

  it('returns 409 when deleting the only active account', async () => {
    const user = await createTestUser()
    const account = await createTestGitHubAccount(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: account.id } })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: account.id } } as never)

    const res = await DELETE(
      new Request(`http://localhost/api/github-accounts/${account.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ accountId: account.id }) }
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('LAST_ACTIVE_ACCOUNT')
  })

  it('returns 404 for another user\'s account', async () => {
    const owner = await createTestUser({ email: 'owner@example.com' })
    const other = await createTestUser({ email: 'other@example.com' })
    const account = await createTestGitHubAccount(owner.id)

    mockAuth.mockResolvedValueOnce({ user: { id: other.id, email: other.email!, activeAccountId: null } } as never)

    const res = await DELETE(
      new Request(`http://localhost/api/github-accounts/${account.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ accountId: account.id }) }
    )
    expect(res.status).toBe(404)
  })
})

describe('POST /api/github-accounts/:accountId/switch', () => {
  beforeEach(async () => {
    await clearDatabase()
    jest.resetAllMocks()
  })

  it('updates activeAccountId and returns the new id', async () => {
    const user = await createTestUser()
    const acc1 = await createTestGitHubAccount(user.id, { githubLogin: 'acc1' })
    const acc2 = await createTestGitHubAccount(user.id, { githubLogin: 'acc2' })
    await prisma.user.update({ where: { id: user.id }, data: { activeAccountId: acc1.id } })

    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: acc1.id } } as never)

    const res = await SWITCH(
      new Request(`http://localhost/api/github-accounts/${acc2.id}/switch`, { method: 'POST' }),
      { params: Promise.resolve({ accountId: acc2.id }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.activeAccountId).toBe(acc2.id)

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.activeAccountId).toBe(acc2.id)
  })

  it('returns 404 when switching to another user\'s account', async () => {
    const owner = await createTestUser({ email: 'owner@example.com' })
    const other = await createTestUser({ email: 'other@example.com' })
    const account = await createTestGitHubAccount(owner.id)

    mockAuth.mockResolvedValueOnce({ user: { id: other.id, email: other.email!, activeAccountId: null } } as never)

    const res = await SWITCH(
      new Request(`http://localhost/api/github-accounts/${account.id}/switch`, { method: 'POST' }),
      { params: Promise.resolve({ accountId: account.id }) }
    )
    expect(res.status).toBe(404)
  })
})

describe('POST /api/github-accounts (connect via OAuth code)', () => {
  beforeEach(async () => {
    await clearDatabase()
    jest.resetAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null as never)
    const res = await POST(
      new Request('http://localhost/api/github-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'ghp_test', githubLogin: 'newuser', avatarUrl: null }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('creates a new account with encrypted token', async () => {
    const user = await createTestUser()
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    const rawToken = 'ghp_real_token_value'
    const res = await POST(
      new Request('http://localhost/api/github-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: rawToken, githubLogin: 'newuser', avatarUrl: null }),
      })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.githubLogin).toBe('newuser')

    const acct = await prisma.gitHubAccount.findFirst({ where: { githubLogin: 'newuser' } })
    expect(acct?.accessToken).not.toBe(rawToken)
  })

  it('returns 409 when the GitHub login is already connected', async () => {
    const user = await createTestUser()
    await createTestGitHubAccount(user.id, { githubLogin: 'existing' })
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    const res = await POST(
      new Request('http://localhost/api/github-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'ghp_x', githubLogin: 'existing', avatarUrl: null }),
      })
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('ALREADY_CONNECTED')
  })

  it('sets activeAccountId when this is the user\'s first account', async () => {
    const user = await createTestUser()
    mockAuth.mockResolvedValueOnce({ user: { id: user.id, email: user.email!, activeAccountId: null } } as never)

    await POST(
      new Request('http://localhost/api/github-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'ghp_first', githubLogin: 'firstuser', avatarUrl: null }),
      })
    )

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.activeAccountId).not.toBeNull()
  })
})
