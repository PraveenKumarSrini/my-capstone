jest.mock('@/lib/auth')

import { POST } from '@/app/api/auth/register/route'
import { clearDatabase } from 'tests/helpers/db'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('creates a user and returns 201 with valid input', async () => {
    const res = await POST(makeRequest({ name: 'Alice', email: 'alice@example.com', password: 'securepass' }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.email).toBe('alice@example.com')
    expect(body.data.name).toBe('Alice')
    expect(body.data).not.toHaveProperty('password')
  })

  it('stores a bcrypt-hashed password, never plaintext', async () => {
    await POST(makeRequest({ name: 'Bob', email: 'bob@example.com', password: 'mypassword' }))

    const user = await prisma.user.findUnique({ where: { email: 'bob@example.com' } })
    expect(user?.password).not.toBe('mypassword')
    expect(await bcrypt.compare('mypassword', user!.password!)).toBe(true)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest({ email: 'bad@example.com' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 400 when password is too short', async () => {
    const res = await POST(makeRequest({ name: 'Eve', email: 'eve@example.com', password: 'short' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 400 when email format is invalid', async () => {
    const res = await POST(makeRequest({ name: 'Mal', email: 'not-an-email', password: 'validpass123' }))

    expect(res.status).toBe(400)
  })

  it('returns 409 when email is already registered', async () => {
    await prisma.user.create({ data: { email: 'dupe@example.com', password: 'hashed' } })

    const res = await POST(makeRequest({ name: 'Dupe', email: 'dupe@example.com', password: 'validpass123' }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('EMAIL_EXISTS')
  })
})
