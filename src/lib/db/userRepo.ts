import type { User } from '@prisma/client'
import prisma from '@/lib/db'

export async function createUser(data: {
  email: string
  name?: string
  password?: string
}): Promise<User> {
  return prisma.user.create({ data })
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } })
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } })
}

export async function updateActiveAccount(
  userId: string,
  activeAccountId: string | null
): Promise<User> {
  return prisma.user.update({ where: { id: userId }, data: { activeAccountId } })
}
