import { Octokit } from '@octokit/rest'
import { getAccountWithSecret } from '@/lib/db/accountRepo'
import { decrypt } from '@/lib/crypto'
import { ApiException } from '@/lib/api'
import logger from '@/lib/logger'

export async function getOctokitForAccount(accountId: string): Promise<Octokit> {
  const account = await getAccountWithSecret(accountId)
  if (!account) {
    logger.warn({ accountId }, 'GitHub account not found for Octokit construction')
    throw new ApiException('GitHub account not found', 404)
  }
  const token = decrypt(account.accessToken)
  return new Octokit({ auth: token })
}
