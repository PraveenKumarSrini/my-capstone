jest.mock('@/lib/db/repoRepo')
jest.mock('@/lib/github/client')
jest.mock('@/lib/github/metrics')
jest.mock('@/lib/db/metricRepo')
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { reconcileStaleRepos } from '@/lib/github/sync'
import * as repoRepo from '@/lib/db/repoRepo'
import * as githubClient from '@/lib/github/client'
import * as metrics from '@/lib/github/metrics'
import * as metricRepo from '@/lib/db/metricRepo'

const mockGetStaleRepos = repoRepo.getStaleRepos as jest.Mock
const mockUpdateRepo = repoRepo.updateRepo as jest.Mock
const mockGetOctokit = githubClient.getOctokitForAccount as jest.Mock
const mockFetchMetrics = metrics.fetchMetricsForRepo as jest.Mock
const mockInsertMetric = metricRepo.insertMetric as jest.Mock

const fakeOctokit = {} as never
const now = new Date('2026-01-15T12:00:00Z')

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(now)
  mockGetOctokit.mockResolvedValue(fakeOctokit)
  mockUpdateRepo.mockResolvedValue({})
  mockInsertMetric.mockResolvedValue({})
})

afterEach(() => {
  jest.useRealTimers()
})

describe('reconcileStaleRepos', () => {
  it('does nothing when there are no stale repos', async () => {
    mockGetStaleRepos.mockResolvedValue([])
    await reconcileStaleRepos()
    expect(mockGetOctokit).not.toHaveBeenCalled()
    expect(mockFetchMetrics).not.toHaveBeenCalled()
  })

  it('fetches metrics and updates lastSyncedAt for each stale repo', async () => {
    const lastSynced = new Date('2026-01-15T11:00:00Z')
    const repo = { id: 'r1', fullName: 'owner/repo', githubAccountId: 'acc-1', lastSyncedAt: lastSynced }
    mockGetStaleRepos.mockResolvedValue([repo])
    mockFetchMetrics.mockResolvedValue([
      { repoId: 'r1', type: 'COMMIT_COUNT', value: 3, recordedAt: now },
    ])

    await reconcileStaleRepos()

    expect(mockGetOctokit).toHaveBeenCalledWith('acc-1')
    expect(mockFetchMetrics).toHaveBeenCalledWith(fakeOctokit, 'r1', 'owner/repo', lastSynced, now)
    expect(mockInsertMetric).toHaveBeenCalledTimes(1)
    expect(mockUpdateRepo).toHaveBeenCalledWith('r1', { lastSyncedAt: now })
  })

  it('uses 35-min-ago as from date when lastSyncedAt is null', async () => {
    const repo = { id: 'r1', fullName: 'owner/repo', githubAccountId: 'acc-1', lastSyncedAt: null }
    mockGetStaleRepos.mockResolvedValue([repo])
    mockFetchMetrics.mockResolvedValue([])

    await reconcileStaleRepos()

    const expectedFrom = new Date(now.getTime() - 35 * 60 * 1000)
    expect(mockFetchMetrics).toHaveBeenCalledWith(fakeOctokit, 'r1', 'owner/repo', expectedFrom, now)
  })

  it('continues to next repo after an error and does not rethrow', async () => {
    const r1 = { id: 'r1', fullName: 'a/b', githubAccountId: 'acc-1', lastSyncedAt: null }
    const r2 = { id: 'r2', fullName: 'c/d', githubAccountId: 'acc-2', lastSyncedAt: null }
    mockGetStaleRepos.mockResolvedValue([r1, r2])
    mockGetOctokit
      .mockRejectedValueOnce(new Error('token expired'))
      .mockResolvedValueOnce(fakeOctokit)
    mockFetchMetrics.mockResolvedValue([])

    await expect(reconcileStaleRepos()).resolves.toBeUndefined()
    // r2 still processed despite r1 error
    expect(mockFetchMetrics).toHaveBeenCalledTimes(1)
    expect(mockFetchMetrics).toHaveBeenCalledWith(
      expect.anything(), 'r2', 'c/d', expect.any(Date), expect.any(Date)
    )
  })

  it('inserts all returned metrics', async () => {
    const repo = { id: 'r1', fullName: 'o/r', githubAccountId: 'acc-1', lastSyncedAt: null }
    mockGetStaleRepos.mockResolvedValue([repo])
    mockFetchMetrics.mockResolvedValue([
      { repoId: 'r1', type: 'COMMIT_COUNT', value: 5, recordedAt: now },
      { repoId: 'r1', type: 'PR_OPENED', value: 2, recordedAt: now },
    ])

    await reconcileStaleRepos()

    expect(mockInsertMetric).toHaveBeenCalledTimes(2)
  })
})
