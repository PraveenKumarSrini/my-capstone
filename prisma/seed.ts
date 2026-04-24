import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createCipheriv, randomBytes } from 'crypto'

const prisma = new PrismaClient()

function encryptToken(plaintext: string): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is not set')
  const keyBuf = Buffer.from(key, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('hex')
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main(): Promise<void> {
  await prisma.metric.deleteMany()
  await prisma.webhookEvent.deleteMany()
  await prisma.repository.deleteMany()
  await prisma.gitHubAccount.deleteMany()
  await prisma.user.deleteMany()

  const hashedPassword = await bcrypt.hash('demo1234', 10)

  const user = await prisma.user.create({
    data: {
      email: 'demo@devpulse.dev',
      name: 'Demo User',
      password: hashedPassword,
    },
  })

  const personalAccount = await prisma.gitHubAccount.create({
    data: {
      userId: user.id,
      githubLogin: 'demo-personal',
      accessToken: encryptToken('github_pat_personal_placeholder'),
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      displayName: 'Personal',
      webhookSecret: encryptToken('webhook-secret-personal'),
    },
  })

  const workAccount = await prisma.gitHubAccount.create({
    data: {
      userId: user.id,
      githubLogin: 'demo-work',
      accessToken: encryptToken('github_pat_work_placeholder'),
      avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
      displayName: 'Work',
      webhookSecret: encryptToken('webhook-secret-work'),
    },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { activeAccountId: personalAccount.id },
  })

  const repo1 = await prisma.repository.create({
    data: {
      githubAccountId: personalAccount.id,
      fullName: 'demo-personal/my-project',
      githubRepoId: 100001,
      isTracked: true,
    },
  })

  const repo2 = await prisma.repository.create({
    data: {
      githubAccountId: personalAccount.id,
      fullName: 'demo-personal/side-project',
      githubRepoId: 100002,
      isTracked: true,
    },
  })

  const repo3 = await prisma.repository.create({
    data: {
      githubAccountId: workAccount.id,
      fullName: 'demo-work/main-app',
      githubRepoId: 200001,
      isTracked: true,
    },
  })

  const metricTypes = [
    'COMMIT_COUNT',
    'PR_OPENED',
    'PR_MERGED',
    'PR_CLOSED',
    'REVIEW_COUNT',
    'COMMENT_COUNT',
  ] as const

  const repos = [repo1, repo2, repo3]
  const now = new Date()

  for (const repo of repos) {
    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const date = new Date(now)
      date.setDate(date.getDate() - daysAgo)
      date.setHours(12, 0, 0, 0)

      for (const type of metricTypes) {
        const maxValue =
          type === 'COMMIT_COUNT'
            ? 15
            : type === 'COMMENT_COUNT'
              ? 20
              : type === 'REVIEW_COUNT'
                ? 8
                : 5

        await prisma.metric.create({
          data: {
            repoId: repo.id,
            type,
            value: randomInt(0, maxValue),
            recordedAt: date,
          },
        })
      }
    }

    await prisma.repository.update({
      where: { id: repo.id },
      data: { lastSyncedAt: new Date() },
    })
  }

  console.log('Seed complete: 1 user, 2 accounts, 3 repos, 30 days × 6 metric types × 3 repos')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
