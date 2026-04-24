import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { getAccountWithSecret } from '@/lib/db/accountRepo'
import { decrypt } from '@/lib/crypto'
import logger from '@/lib/logger'

export type MCPRepoResult = {
  fullName: string
  description: string | null
  language: string | null
  isPrivate: boolean
  updatedAt: string | null
  htmlUrl: string
}

type GitHubSearchItem = {
  full_name: string
  description: string | null
  language: string | null
  private: boolean
  updated_at: string | null
  html_url: string
}

// Connects to the GitHub MCP server as a child process using the account's OAuth token.
// Used by GET /api/repos/discover to let users browse their GitHub repos without
// manually typing "owner/repo". Spawns @modelcontextprotocol/server-github per request.
export async function searchGitHubReposViaMCP(
  accountId: string,
  query?: string
): Promise<MCPRepoResult[]> {
  const account = await getAccountWithSecret(accountId)
  if (!account) throw new Error('GitHub account not found')

  const token = decrypt(account.accessToken)
  const searchQuery = query
    ? `user:${account.githubLogin} ${query} in:name`
    : `user:${account.githubLogin}`

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['--yes', '--quiet', '@modelcontextprotocol/server-github'],
    env: {
      ...process.env,
      GITHUB_PERSONAL_ACCESS_TOKEN: token,
    },
  })

  const client = new Client({ name: 'devpulse', version: '1.0.0' }, { capabilities: {} })

  try {
    await client.connect(transport)

    const result = await client.callTool({
      name: 'search_repositories',
      arguments: { query: searchQuery },
    })

    const contentArray = result.content as Array<{ type: string; text: string }>
    const raw = JSON.parse(contentArray[0]?.text ?? '{}')
    const items: GitHubSearchItem[] = raw.items ?? raw ?? []

    logger.info(
      { accountId, query: searchQuery, count: items.length },
      'GitHub repos fetched via MCP'
    )

    return items.map((r) => ({
      fullName: r.full_name,
      description: r.description ?? null,
      language: r.language ?? null,
      isPrivate: r.private,
      updatedAt: r.updated_at ?? null,
      htmlUrl: r.html_url,
    }))
  } finally {
    await client.close().catch(() => {})
  }
}
