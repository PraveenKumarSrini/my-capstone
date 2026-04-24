jest.mock('@/lib/db/accountRepo')
jest.mock('@/lib/crypto')
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@/lib/api', () => ({
  ApiException: class ApiException extends Error {
    constructor(message: string, public statusCode: number) { super(message) }
  },
  apiSuccess: jest.fn(),
  apiError: jest.fn(),
  requireAuth: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { getOctokitForAccount } from '@/lib/github/client'
import { getAccountWithSecret } from '@/lib/db/accountRepo'
import { decrypt } from '@/lib/crypto'
import { Octokit } from '@octokit/rest'

const mockGetAccount = getAccountWithSecret as jest.Mock
const mockDecrypt = decrypt as jest.Mock
const MockOctokit = Octokit as jest.MockedClass<typeof Octokit>

describe('getOctokitForAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(MockOctokit as jest.Mock).mockImplementation(() => ({}))
  })

  it('returns an Octokit instance authenticated with the decrypted token', async () => {
    mockGetAccount.mockResolvedValue({ id: 'acc-1', accessToken: 'encrypted-token' })
    mockDecrypt.mockReturnValue('raw-github-token')

    const oc = await getOctokitForAccount('acc-1')

    expect(mockGetAccount).toHaveBeenCalledWith('acc-1')
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-token')
    expect(MockOctokit).toHaveBeenCalledWith({ auth: 'raw-github-token' })
    expect(oc).toBeDefined()
  })

  it('throws ApiException when account is not found', async () => {
    mockGetAccount.mockResolvedValue(null)

    await expect(getOctokitForAccount('missing')).rejects.toThrow('GitHub account not found')
  })

  it('propagates errors from accountRepo', async () => {
    mockGetAccount.mockRejectedValue(new Error('DB unavailable'))

    await expect(getOctokitForAccount('acc-1')).rejects.toThrow('DB unavailable')
  })
})
