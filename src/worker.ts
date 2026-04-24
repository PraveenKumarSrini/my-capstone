import { getPendingAndFailed } from '@/lib/db/webhookEventRepo'
import { processWebhookEvent } from '@/lib/github/processWebhookEvent'
import { reconcileStaleRepos } from '@/lib/github/sync'
import logger from '@/lib/logger'

const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS ?? '1800000', 10)
const RATE_LIMIT_BACKOFF_MS = 60_000

let intervalId: ReturnType<typeof setInterval> | null = null
let backoffTimer: ReturnType<typeof setTimeout> | null = null

function isRateLimitError(error: unknown): boolean {
  const err = error as { status?: number; message?: string }
  return (
    err.status === 429 ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('rate limit'))
  )
}

async function runReconciliation(): Promise<void> {
  try {
    await reconcileStaleRepos()
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      logger.warn('GitHub rate limit hit — pausing reconciliation for 60s')
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
      backoffTimer = setTimeout(() => {
        backoffTimer = null
        intervalId = setInterval(runReconciliation, SYNC_INTERVAL_MS)
        void runReconciliation()
      }, RATE_LIMIT_BACKOFF_MS)
    } else {
      logger.error({ error }, 'Reconciliation cycle error')
    }
  }
}

async function startup(): Promise<void> {
  const events = await getPendingAndFailed(3)
  logger.info({ count: events.length }, 'Startup catch-up: processing pending/failed events')

  for (const event of events) {
    try {
      await processWebhookEvent(event.id)
      logger.info({ eventId: event.id }, 'Startup: event processed')
    } catch (error) {
      logger.error({ eventId: event.id, error }, 'Startup: failed to process event')
    }
  }
}

function shutdown(): void {
  logger.info('Worker shutting down')
  if (intervalId !== null) clearInterval(intervalId)
  if (backoffTimer !== null) clearTimeout(backoffTimer)
  process.exit(0)
}

async function main(): Promise<void> {
  logger.info({ syncIntervalMs: SYNC_INTERVAL_MS }, 'Worker starting')

  await startup()

  await runReconciliation()
  if (intervalId === null && backoffTimer === null) {
    intervalId = setInterval(runReconciliation, SYNC_INTERVAL_MS)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  logger.error({ error }, 'Worker failed to start')
  process.exit(1)
})
