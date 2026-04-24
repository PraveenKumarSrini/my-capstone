import type { GitHubAccount } from '@prisma/client'
import prisma from '@/lib/db'

export async function createAccount(data: {
  userId: string
  githubLogin: string
  accessToken: string
  avatarUrl?: string
  displayName?: string
}): Promise<GitHubAccount> {
  return prisma.gitHubAccount.create({ data })
}

export async function getAccountsByUserId(userId: string): Promise<GitHubAccount[]> {
  return prisma.gitHubAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getAccountById(id: string): Promise<GitHubAccount | null> {
  return prisma.gitHubAccount.findUnique({ where: { id } })
}

export async function getAccountWithSecret(id: string): Promise<GitHubAccount | null> {
  return prisma.gitHubAccount.findUnique({ where: { id } })
}

export async function updateAccount(
  id: string,
  data: Partial<Pick<GitHubAccount, 'accessToken' | 'webhookSecret' | 'displayName' | 'avatarUrl'>>
): Promise<GitHubAccount> {
  return prisma.gitHubAccount.update({ where: { id }, data })
}

export async function deleteAccount(id: string): Promise<void> {
  await prisma.gitHubAccount.delete({ where: { id } })
}
