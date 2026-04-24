import type { Octokit } from '@octokit/rest'
import type { MetricType } from '@prisma/client'
import logger from '@/lib/logger'

export type MetricData = {
  repoId: string
  type: MetricType
  value: number
  recordedAt: Date
  metadata?: Record<string, unknown>
}

export async function fetchMetricsForRepo(
  octokit: Octokit,
  repoId: string,
  fullName: string,
  from: Date,
  to: Date
): Promise<MetricData[]> {
  const [owner, repo] = fullName.split('/')
  const metrics: MetricData[] = []

  try {
    const commits = await octokit.paginate(octokit.repos.listCommits, {
      owner,
      repo,
      since: from.toISOString(),
      until: to.toISOString(),
      per_page: 100,
    })

    const remaining = commits[0]
      ? (await octokit.repos.listCommits({ owner, repo, per_page: 1 })).headers[
          'x-ratelimit-remaining'
        ]
      : null
    if (remaining && Number(remaining) < 100) {
      logger.warn({ remaining, fullName }, 'GitHub rate limit running low')
    }

    if (commits.length > 0) {
      metrics.push({
        repoId,
        type: 'COMMIT_COUNT',
        value: commits.length,
        recordedAt: new Date(),
        metadata: { from: from.toISOString(), to: to.toISOString() },
      })
    }
  } catch (error) {
    logger.error({ error, fullName }, 'Failed to fetch commits')
  }

  try {
    const prs = await octokit.paginate(octokit.pulls.list, {
      owner,
      repo,
      state: 'all',
      per_page: 100,
    })

    const fromMs = from.getTime()
    const toMs = to.getTime()

    const opened = prs.filter(() => {
      return true
    }).filter((pr) => {
      const t = new Date(pr.created_at).getTime()
      return t >= fromMs && t <= toMs
    })

    const merged = prs.filter((pr) => {
      if (!pr.merged_at) return false
      const t = new Date(pr.merged_at).getTime()
      return t >= fromMs && t <= toMs
    })

    const closed = prs.filter((pr) => {
      if (pr.state !== 'closed' || pr.merged_at) return false
      if (!pr.closed_at) return false
      const t = new Date(pr.closed_at).getTime()
      return t >= fromMs && t <= toMs
    })

    if (opened.length > 0)
      metrics.push({ repoId, type: 'PR_OPENED', value: opened.length, recordedAt: new Date() })
    if (merged.length > 0)
      metrics.push({ repoId, type: 'PR_MERGED', value: merged.length, recordedAt: new Date() })
    if (closed.length > 0)
      metrics.push({ repoId, type: 'PR_CLOSED', value: closed.length, recordedAt: new Date() })
  } catch (error) {
    logger.error({ error, fullName }, 'Failed to fetch PRs')
  }

  return metrics
}
