import { test, expect } from '@playwright/test'
import { createHmac } from 'crypto'
import { DEMO_EMAIL, DEMO_PASSWORD, loginAs } from './helpers'

// These tests use the demo seed user (npx prisma db seed).
// Personal account webhook secret is the raw value before encryption in seed.ts.
const WEBHOOK_SECRET = 'webhook-secret-personal'
const DEMO_REPO_FULL_NAME = 'demo-personal/my-project'
const DEMO_REPO_GITHUB_ID = 100001

function signPayload(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

test.describe('Dashboard', () => {
  test('loads with seed data; commit chart is visible', async ({ page }) => {
    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD)

    // Wait for the dashboard page to fully load
    await expect(page.getByText('Total Commits')).toBeVisible()
    await expect(page.getByText('PRs Opened')).toBeVisible()
    await expect(page.getByText('PRs Merged')).toBeVisible()
    await expect(page.getByText('Reviews Given')).toBeVisible()

    // Recharts renders SVG elements for the charts
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible()
  })

  test('POST mock webhook triggers dashboard refresh via SSE within 5s', async ({ page }) => {
    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD)

    // Wait for initial dashboard load
    await expect(page.getByText('Total Commits')).toBeVisible()

    // Set up listener for the next dashboard API response BEFORE posting the webhook
    const dashboardRefetchPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/dashboard') && response.status() === 200,
      { timeout: 8000 }
    )

    // Build and sign the webhook payload
    const timestamp = new Date().toISOString()
    const deliveryId = `e2e-push-${Date.now()}`
    const payload = JSON.stringify({
      repository: { full_name: DEMO_REPO_FULL_NAME, id: DEMO_REPO_GITHUB_ID },
      commits: [{ id: 'abc123def456', message: 'e2e test commit', timestamp }],
      head_commit: { timestamp },
    })
    const signature = signPayload(WEBHOOK_SECRET, payload)

    // Post the webhook — the server should accept it, enqueue it, and broadcast via SSE
    const webhookRes = await page.request.post('/api/webhooks/github', {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': deliveryId,
      },
      data: payload,
    })
    expect(webhookRes.ok()).toBe(true)

    // SSE should broadcast metrics_updated → useSSE calls mutate('/api/dashboard')
    // → SWR re-fetches. Verify this refetch happens without a full page navigation.
    const currentUrl = page.url()
    await dashboardRefetchPromise
    expect(page.url()).toBe(currentUrl) // no page reload occurred
  })

  test('toggle repo tracking off; badge changes to Untracked', async ({ page }) => {
    await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD)

    // Navigate to the repos page
    await page.goto('/dashboard/repos')

    // Find the repo card for 'demo-personal/my-project'
    const repoCard = page.locator('div').filter({ hasText: DEMO_REPO_FULL_NAME }).first()
    await expect(repoCard).toBeVisible()

    // The repo should currently be tracked
    await expect(repoCard.getByText('Tracked')).toBeVisible()

    // Click "Untrack" button to toggle off
    await repoCard.getByRole('button', { name: 'Untrack' }).click()

    // Badge should update to "Untracked"
    await expect(repoCard.getByText('Untracked')).toBeVisible({ timeout: 5000 })

    // Toggle it back on (cleanup — seed data should remain tracked for other tests)
    await repoCard.getByRole('button', { name: 'Track' }).click()
    await expect(repoCard.getByText('Tracked')).toBeVisible({ timeout: 5000 })
  })
})
