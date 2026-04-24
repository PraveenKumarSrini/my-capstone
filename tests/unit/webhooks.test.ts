jest.mock('@/lib/github/client')
jest.mock('@/lib/db/accountRepo')
jest.mock('@/lib/crypto')
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({ toString: () => 'generated-secret-hex' })),
}))
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { registerWebhook, deleteWebhook } from '@/lib/github/webhooks'
import { getOctokitForAccount } from '@/lib/github/client'
import { getAccountWithSecret, updateAccount } from '@/lib/db/accountRepo'
import { encrypt, decrypt } from '@/lib/crypto'

const mockGetOctokit = getOctokitForAccount as jest.Mock
const mockGetAccount = getAccountWithSecret as jest.Mock
const mockUpdateAccount = updateAccount as jest.Mock
const mockEncrypt = encrypt as jest.Mock
const mockDecrypt = decrypt as jest.Mock

process.env.WEBHOOK_BASE_URL = 'https://example.ngrok.io'

function makeOctokit(createHookId = 42, deleteOk = true, deleteStatus?: number) {
  const createWebhook = jest.fn().mockResolvedValue({ data: { id: createHookId } })
  const deleteWebhook = deleteOk
    ? jest.fn().mockResolvedValue({})
    : jest.fn().mockRejectedValue(Object.assign(new Error('not found'), { status: deleteStatus ?? 404 }))
  return { repos: { createWebhook, deleteWebhook } }
}

describe('registerWebhook', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses existing webhook secret when account already has one', async () => {
    mockGetAccount.mockResolvedValue({ id: 'acc-1', webhookSecret: 'enc-secret' })
    mockDecrypt.mockReturnValue('raw-secret')
    const oc = makeOctokit()
    mockGetOctokit.mockResolvedValue(oc)

    const id = await registerWebhook('acc-1', 'owner/repo')

    expect(mockDecrypt).toHaveBeenCalledWith('enc-secret')
    expect(mockUpdateAccount).not.toHaveBeenCalled()
    expect(id).toBe(42)
    expect(oc.repos.createWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'owner', repo: 'repo', config: expect.objectContaining({ secret: 'raw-secret' }) })
    )
  })

  it('generates and stores a new secret when account has none', async () => {
    mockGetAccount.mockResolvedValue({ id: 'acc-1', webhookSecret: null })
    mockEncrypt.mockReturnValue('newly-encrypted')
    mockUpdateAccount.mockResolvedValue({})
    const oc = makeOctokit()
    mockGetOctokit.mockResolvedValue(oc)

    await registerWebhook('acc-1', 'owner/repo')

    expect(mockUpdateAccount).toHaveBeenCalledWith('acc-1', { webhookSecret: 'newly-encrypted' })
  })

  it('throws when account is not found', async () => {
    mockGetAccount.mockResolvedValue(null)

    await expect(registerWebhook('missing', 'owner/repo')).rejects.toThrow('Account not found')
  })

  it('returns the webhook id from GitHub', async () => {
    mockGetAccount.mockResolvedValue({ id: 'acc-1', webhookSecret: 'enc' })
    mockDecrypt.mockReturnValue('s')
    mockGetOctokit.mockResolvedValue(makeOctokit(99))

    const id = await registerWebhook('acc-1', 'owner/repo')

    expect(id).toBe(99)
  })
})

describe('deleteWebhook', () => {
  beforeEach(() => jest.clearAllMocks())

  it('deletes the webhook via Octokit', async () => {
    const oc = makeOctokit(0, true)
    mockGetOctokit.mockResolvedValue(oc)

    await deleteWebhook('acc-1', 'owner/repo', 55)

    expect(oc.repos.deleteWebhook).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', hook_id: 55 })
  })

  it('silently ignores 404 from GitHub (already removed)', async () => {
    const oc = makeOctokit(0, false, 404)
    mockGetOctokit.mockResolvedValue(oc)

    await expect(deleteWebhook('acc-1', 'owner/repo', 55)).resolves.toBeUndefined()
  })

  it('rethrows non-404 errors', async () => {
    const oc = makeOctokit(0, false, 500)
    mockGetOctokit.mockResolvedValue(oc)

    await expect(deleteWebhook('acc-1', 'owner/repo', 55)).rejects.toThrow('not found')
  })
})
