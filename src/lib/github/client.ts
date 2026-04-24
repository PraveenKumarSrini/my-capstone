import { Octokit } from '@octokit/rest'
import { getAccountWithSecret } from '@/lib/db/accountRepo'
import { decrypt } from '@/lib/crypto'
import { ApiException } from '@/lib/api'
import logger from '@/lib/logger'

// The Octokit instance created here mirrors the GitHub MCP server's tool surface
// (list_repositories, list_commits, list_pull_requests, list_pull_request_files).
// During development, Claude Code connects to the GitHub MCP server via .mcp.json
// to inspect the same data this factory provides at runtime.
export async function getOctokitForAccount(accountId: string): Promise<Octokit> {
  const account = await getAccountWithSecret(accountId)
  if (!account) {
    logger.warn({ accountId }, 'GitHub account not found for Octokit construction')
    throw new ApiException('GitHub account not found', 404)
  }
  const token = decrypt(account.accessToken)
  return new Octokit({ auth: token })
}

// Single authorised call site for raw accessToken — used only by mcp.ts
// where an Octokit instance is insufficient (MCP needs the raw bearer token).
export async function getAccessTokenForAccount(accountId: string): Promise<string> {
  const account = await getAccountWithSecret(accountId)
  if (!account) throw new ApiException('GitHub account not found', 404)
  return decrypt(account.accessToken)
}

// Single authorised call site for raw webhookSecret — used by webhooks.ts
// when registering a webhook with GitHub (the secret must be sent in plaintext
// to the GitHub API so it can sign future deliveries).
export async function getWebhookSecretForAccount(accountId: string): Promise<string | null> {
  const account = await getAccountWithSecret(accountId)
  if (!account) throw new ApiException('GitHub account not found', 404)
  return account.webhookSecret ? decrypt(account.webhookSecret) : null
}
