jest.mock('@/lib/db/accountRepo')
jest.mock('@/lib/crypto')
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const mockConnect = jest.fn().mockResolvedValue(undefined)
const mockCallTool = jest.fn()
const mockClose = jest.fn().mockResolvedValue(undefined)

jest.mock('@modelcontextprotocol/sdk/client', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    callTool: mockCallTool,
    close: mockClose,
  })),
}))
jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => ({})),
}))

import { searchGitHubReposViaMCP } from '@/lib/github/mcp'
import { getAccountWithSecret } from '@/lib/db/accountRepo'
import { decrypt } from '@/lib/crypto'

const mockGetAccount = getAccountWithSecret as jest.Mock
const mockDecrypt = decrypt as jest.Mock

const fakeAccount = { id: 'acc-1', githubLogin: 'alice', accessToken: 'enc-token' }

describe('searchGitHubReposViaMCP', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAccount.mockResolvedValue(fakeAccount)
    mockDecrypt.mockReturnValue('raw-token')
    mockClose.mockResolvedValue(undefined)
  })

  it('throws when account is not found', async () => {
    mockGetAccount.mockResolvedValue(null)
    await expect(searchGitHubReposViaMCP('missing')).rejects.toThrow('GitHub account not found')
  })

  it('calls search_repositories tool with user-scoped query', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ items: [] }) }],
    })
    await searchGitHubReposViaMCP('acc-1')
    expect(mockCallTool).toHaveBeenCalledWith({
      name: 'search_repositories',
      arguments: { query: 'user:alice' },
    })
  })

  it('appends user search term when query is provided', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ items: [] }) }],
    })
    await searchGitHubReposViaMCP('acc-1', 'devpulse')
    expect(mockCallTool).toHaveBeenCalledWith({
      name: 'search_repositories',
      arguments: { query: 'user:alice devpulse in:name' },
    })
  })

  it('maps GitHub search items to MCPRepoResult shape', async () => {
    const items = [
      {
        full_name: 'alice/awesome-repo',
        description: 'A cool project',
        language: 'TypeScript',
        private: false,
        updated_at: '2026-01-01T00:00:00Z',
        html_url: 'https://github.com/alice/awesome-repo',
      },
    ]
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ items }) }],
    })

    const results = await searchGitHubReposViaMCP('acc-1')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      fullName: 'alice/awesome-repo',
      description: 'A cool project',
      language: 'TypeScript',
      isPrivate: false,
      updatedAt: '2026-01-01T00:00:00Z',
      htmlUrl: 'https://github.com/alice/awesome-repo',
    })
  })

  it('returns empty array when items are empty', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ items: [] }) }],
    })
    const results = await searchGitHubReposViaMCP('acc-1')
    expect(results).toEqual([])
  })

  it('closes the client even when callTool throws', async () => {
    mockCallTool.mockRejectedValue(new Error('MCP error'))
    await expect(searchGitHubReposViaMCP('acc-1')).rejects.toThrow('MCP error')
    expect(mockClose).toHaveBeenCalled()
  })

  it('decrypts the access token and uses it for the transport', async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ items: [] }) }],
    })
    await searchGitHubReposViaMCP('acc-1')
    expect(mockDecrypt).toHaveBeenCalledWith('enc-token')
  })
})
