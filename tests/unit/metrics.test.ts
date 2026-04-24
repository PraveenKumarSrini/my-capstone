jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { fetchMetricsForRepo } from '@/lib/github/metrics'
import type { Octokit } from '@octokit/rest'
import logger from '@/lib/logger'

const mockLogger = logger as { warn: jest.Mock; error: jest.Mock }

function makeOctokit({
  commits = [] as unknown[],
  prs = [] as unknown[],
  rateLimitRemaining = '5000',
}: {
  commits?: unknown[]
  prs?: unknown[]
  rateLimitRemaining?: string
} = {}) {
  const listCommits = jest.fn().mockResolvedValue({
    data: commits,
    headers: { 'x-ratelimit-remaining': rateLimitRemaining },
  })
  const pullsList = jest.fn()

  return {
    octokit: {
      paginate: jest.fn().mockImplementation(async (fn: unknown) => {
        if (fn === listCommits) return commits
        if (fn === pullsList) return prs
        return []
      }),
      repos: { listCommits },
      pulls: { list: pullsList },
    } as unknown as Octokit,
    listCommits,
    pullsList,
  }
}

const FROM = new Date('2026-01-01T00:00:00Z')
const TO = new Date('2026-01-31T23:59:59Z')
const REPO_ID = 'repo-123'
const FULL_NAME = 'owner/my-repo'

describe('fetchMetricsForRepo', () => {
  it('returns COMMIT_COUNT when commits are present', async () => {
    const { octokit } = makeOctokit({ commits: [{ sha: 'a' }, { sha: 'b' }] })
    const result = await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)

    const commitMetric = result.find((m) => m.type === 'COMMIT_COUNT')
    expect(commitMetric).toBeDefined()
    expect(commitMetric?.value).toBe(2)
    expect(commitMetric?.repoId).toBe(REPO_ID)
  })

  it('returns no COMMIT_COUNT metric when commits array is empty', async () => {
    const { octokit } = makeOctokit({ commits: [] })
    const result = await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)
    expect(result.find((m) => m.type === 'COMMIT_COUNT')).toBeUndefined()
  })

  it('logs warning when rate limit is below 100', async () => {
    const { octokit } = makeOctokit({ commits: [{ sha: 'a' }], rateLimitRemaining: '50' })
    await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ remaining: '50' }),
      'GitHub rate limit running low'
    )
  })

  it('maps PR opened within date range to PR_OPENED', async () => {
    const prs = [
      { state: 'open', created_at: '2026-01-15T10:00:00Z', merged_at: null, closed_at: null },
    ]
    const { octokit } = makeOctokit({ prs })
    const result = await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)
    expect(result.find((m) => m.type === 'PR_OPENED')?.value).toBe(1)
  })

  it('maps merged PR to PR_MERGED', async () => {
    const prs = [
      {
        state: 'closed',
        created_at: '2026-01-05T10:00:00Z',
        merged_at: '2026-01-20T12:00:00Z',
        closed_at: '2026-01-20T12:00:00Z',
      },
    ]
    const { octokit } = makeOctokit({ prs })
    const result = await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)
    expect(result.find((m) => m.type === 'PR_MERGED')?.value).toBe(1)
  })

  it('maps closed-not-merged PR to PR_CLOSED', async () => {
    const prs = [
      {
        state: 'closed',
        created_at: '2026-01-05T10:00:00Z',
        merged_at: null,
        closed_at: '2026-01-18T12:00:00Z',
      },
    ]
    const { octokit } = makeOctokit({ prs })
    const result = await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)
    expect(result.find((m) => m.type === 'PR_CLOSED')?.value).toBe(1)
  })

  it('excludes PRs outside the date range', async () => {
    const prs = [
      { state: 'open', created_at: '2025-12-01T10:00:00Z', merged_at: null, closed_at: null },
    ]
    const { octokit } = makeOctokit({ prs })
    const result = await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)
    expect(result.find((m) => m.type === 'PR_OPENED')).toBeUndefined()
  })

  it('logs error and returns partial results when commits fetch throws', async () => {
    const listCommits = jest.fn()
    const pullsList = jest.fn()
    const oc = {
      paginate: jest.fn().mockImplementation(async (fn: unknown) => {
        if (fn === listCommits) throw new Error('network error')
        return []
      }),
      repos: { listCommits },
      pulls: { list: pullsList },
    } as unknown as Octokit

    const result = await fetchMetricsForRepo(oc, REPO_ID, FULL_NAME, FROM, TO)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: FULL_NAME }),
      'Failed to fetch commits'
    )
    expect(result).toBeDefined()
  })

  it('passes since/until params to paginate', async () => {
    const { octokit, listCommits } = makeOctokit({ commits: [] })
    await fetchMetricsForRepo(octokit, REPO_ID, FULL_NAME, FROM, TO)
    expect(octokit.paginate).toHaveBeenCalledWith(
      listCommits,
      expect.objectContaining({
        owner: 'owner',
        repo: 'my-repo',
        since: FROM.toISOString(),
        until: TO.toISOString(),
      })
    )
  })
})
