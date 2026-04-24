import type { Repository } from '@prisma/client'
import prisma from '@/lib/db'

export async function createRepo(data: {
  githubAccountId: string
  fullName: string
  githubRepoId: number
  webhookId?: number
}): Promise<Repository> {
  return prisma.repository.create({ data })
}

export async function getReposByAccountId(githubAccountId: string): Promise<Repository[]> {
  return prisma.repository.findMany({
    where: { githubAccountId },
    orderBy: { fullName: 'asc' },
  })
}

export async function getRepoById(id: string): Promise<Repository | null> {
  return prisma.repository.findUnique({ where: { id } })
}

export async function updateRepo(
  id: string,
  data: Partial<Pick<Repository, 'isTracked' | 'webhookId' | 'lastSyncedAt'>>
): Promise<Repository> {
  return prisma.repository.update({ where: { id }, data })
}

export async function getStaleRepos(thresholdMinutes: number): Promise<Repository[]> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000)
  return prisma.repository.findMany({
    where: {
      isTracked: true,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
    },
  })
}
