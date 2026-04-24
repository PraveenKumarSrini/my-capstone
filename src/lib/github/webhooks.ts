import { randomBytes } from 'crypto'
import { getOctokitForAccount } from '@/lib/github/client'
import { getAccountWithSecret, updateAccount } from '@/lib/db/accountRepo'
import { encrypt, decrypt } from '@/lib/crypto'
import logger from '@/lib/logger'

export async function registerWebhook(accountId: string, repoFullName: string): Promise<number> {
  const account = await getAccountWithSecret(accountId)
  if (!account) throw new Error('Account not found')

  let rawSecret: string
  if (account.webhookSecret) {
    rawSecret = decrypt(account.webhookSecret)
  } else {
    rawSecret = randomBytes(32).toString('hex')
    await updateAccount(accountId, { webhookSecret: encrypt(rawSecret) })
  }

  const octokit = await getOctokitForAccount(accountId)
  const [owner, repo] = repoFullName.split('/')
  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhooks/github`

  const { data } = await octokit.repos.createWebhook({
    owner,
    repo,
    config: { url: webhookUrl, content_type: 'json', secret: rawSecret },
    events: ['push', 'pull_request', 'pull_request_review'],
    active: true,
  })

  logger.info({ accountId, repoFullName, webhookId: data.id }, 'Webhook registered')
  return data.id
}

export async function deleteWebhook(
  accountId: string,
  repoFullName: string,
  webhookId: number
): Promise<void> {
  const octokit = await getOctokitForAccount(accountId)
  const [owner, repo] = repoFullName.split('/')

  try {
    await octokit.repos.deleteWebhook({ owner, repo, hook_id: webhookId })
    logger.info({ accountId, repoFullName, webhookId }, 'Webhook deleted')
  } catch (error: unknown) {
    if ((error as { status?: number }).status === 404) {
      logger.warn({ accountId, repoFullName, webhookId }, 'Webhook already removed on GitHub')
      return
    }
    throw error
  }
}
