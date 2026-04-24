import { getStaleRepos, updateRepo } from '@/lib/db/repoRepo'
import { getOctokitForAccount } from '@/lib/github/client'
import { fetchMetricsForRepo } from '@/lib/github/metrics'
import { insertMetric } from '@/lib/db/metricRepo'
import logger from '@/lib/logger'

export async function reconcileStaleRepos(): Promise<void> {
  logger.info('Reconciliation cycle started')

  const staleRepos = await getStaleRepos(35)
  logger.info({ count: staleRepos.length }, 'Stale repos found')

  for (const repo of staleRepos) {
    try {
      const from = repo.lastSyncedAt ?? new Date(Date.now() - 35 * 60 * 1000)
      const to = new Date()

      const octokit = await getOctokitForAccount(repo.githubAccountId)
      const metrics = await fetchMetricsForRepo(octokit, repo.id, repo.fullName, from, to)

      for (const metric of metrics) {
        await insertMetric(metric)
      }

      await updateRepo(repo.id, { lastSyncedAt: new Date() })

      logger.info(
        { repoId: repo.id, fullName: repo.fullName, metrics: metrics.length },
        'Repo reconciled'
      )
    } catch (error) {
      logger.error({ repoId: repo.id, fullName: repo.fullName, error }, 'Reconciliation failed')
    }
  }

  logger.info('Reconciliation cycle complete')
}
