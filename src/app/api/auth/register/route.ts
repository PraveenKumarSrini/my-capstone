import bcrypt from 'bcryptjs'
import { RegisterSchema } from '@/types'
import { getUserByEmail, createUser } from '@/lib/db/userRepo'
import { apiSuccess, apiError } from '@/lib/api'
import logger from '@/lib/logger'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const parsed = RegisterSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400)
    }

    const { name, email, password } = parsed.data

    const existing = await getUserByEmail(email)
    if (existing) return apiError('Email already registered', 409, 'EMAIL_EXISTS')

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await createUser({ name, email, password: hashedPassword })

    logger.info({ userId: user.id }, 'User registered')

    return apiSuccess({ id: user.id, email: user.email, name: user.name }, 201)
  } catch (error) {
    logger.error({ error }, 'Register failed')
    return apiError('Internal server error', 500)
  }
}
