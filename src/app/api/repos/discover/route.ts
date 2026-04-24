import { requireAuth, apiSuccess, apiError, handleApiError } from '@/lib/api'
import { searchGitHubReposViaMCP } from '@/lib/github/mcp'

// GET /api/repos/discover?q=<optional-search-term>
// Uses GitHub MCP server (via @modelcontextprotocol/server-github) to search the
// authenticated user's GitHub repositories. Called by the Connect Repo UI to let
// users pick a repo from a list instead of typing "owner/repo" manually.
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth()
    const { activeAccountId } = session.user

    if (!activeAccountId) {
      return apiError('No active GitHub account set', 400)
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? undefined

    const repos = await searchGitHubReposViaMCP(activeAccountId, q)
    return apiSuccess(repos)
  } catch (error) {
    return handleApiError(error)
  }
}
