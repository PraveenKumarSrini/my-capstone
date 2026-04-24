import prisma from '@/lib/db'

export async function clearDatabase(): Promise<void> {
  await prisma.metric.deleteMany()
  await prisma.webhookEvent.deleteMany()
  await prisma.repository.deleteMany()
  await prisma.gitHubAccount.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.user.deleteMany()
}

export async function createTestUser(overrides?: {
  email?: string
  name?: string
  password?: string
}) {
  return prisma.user.create({
    data: {
      email: overrides?.email ?? 'test@example.com',
      name: overrides?.name ?? 'Test User',
      password: overrides?.password ?? '$2b$10$hashedpasswordplaceholder',
    },
  })
}

export async function createTestGitHubAccount(
  userId: string,
  overrides?: { githubLogin?: string; displayName?: string }
) {
  return prisma.gitHubAccount.create({
    data: {
      userId,
      githubLogin: overrides?.githubLogin ?? 'testuser',
      accessToken: 'encrypted-placeholder-token',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      displayName: overrides?.displayName ?? 'Personal',
      webhookSecret: 'encrypted-placeholder-secret',
    },
  })
}

export async function createTestRepo(
  githubAccountId: string,
  overrides?: { fullName?: string; isTracked?: boolean }
) {
  return prisma.repository.create({
    data: {
      githubAccountId,
      fullName: overrides?.fullName ?? 'testuser/test-repo',
      githubRepoId: Math.floor(Math.random() * 1_000_000),
      isTracked: overrides?.isTracked ?? true,
      webhookId: 12345,
    },
  })
}
