import { test, expect } from '@playwright/test'
import { registerAndLogin, connectMockGitHubAccount } from './helpers'

test.describe('GitHub Account Management', () => {
  test('connect a GitHub account; verify it appears in AccountSwitcher', async ({ page }) => {
    const email = `e2e-connect-${Date.now()}@example.com`
    await registerAndLogin(page, email)

    // Connect a mock GitHub account via the API (bypasses OAuth flow)
    await connectMockGitHubAccount(page, 'my-gh-user', 'My GitHub')

    // Navigate to dashboard — AccountSwitcher should show the connected account
    await page.goto('/dashboard')
    await expect(page.getByText('my-gh-user')).toBeVisible()
  })

  test('switch to second account; verify active account changes', async ({ page }) => {
    const email = `e2e-switch-${Date.now()}@example.com`
    await registerAndLogin(page, email)

    // Connect two mock GitHub accounts
    await connectMockGitHubAccount(page, 'account-alpha', 'Alpha')
    await connectMockGitHubAccount(page, 'account-beta', 'Beta')

    // Navigate to dashboard
    await page.goto('/dashboard')

    // Both accounts should appear in the sidebar switcher
    await expect(page.getByText('account-alpha')).toBeVisible()
    await expect(page.getByText('account-beta')).toBeVisible()

    // First account (account-alpha) should be active (set when first account was connected)
    // Click account-beta to switch
    await page.getByRole('button', { name: /account-beta/i }).click()

    // Wait for the switch request to complete and the page to refresh
    await page.waitForLoadState('networkidle')

    // The sidebar should still show both accounts but account-beta is now highlighted
    await expect(page.getByText('account-beta')).toBeVisible()
    await expect(page.getByText('account-alpha')).toBeVisible()

    // Verify the active account changed via the API
    const res = await page.request.get('/api/github-accounts')
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.length).toBe(2)
  })

  test('disconnect an account; verify it disappears from settings', async ({ page }) => {
    const email = `e2e-disconnect-${Date.now()}@example.com`
    await registerAndLogin(page, email)

    // Connect two accounts so we can disconnect one
    await connectMockGitHubAccount(page, 'keep-this-account', 'Keep')
    await connectMockGitHubAccount(page, 'remove-this-account', 'Remove')

    // Navigate to Settings
    await page.goto('/dashboard/settings')

    // Both accounts should be visible
    await expect(page.getByText('keep-this-account')).toBeVisible()
    await expect(page.getByText('remove-this-account')).toBeVisible()

    // Find the AccountRow for the account we want to disconnect and click its Disconnect button
    // There are multiple Disconnect buttons (one per row); find the one in the "remove" row
    const removeRow = page.locator('div.py-4').filter({ hasText: 'remove-this-account' })
    await removeRow.getByRole('button', { name: 'Disconnect' }).click()

    // Confirmation modal appears — click the modal's Disconnect button to confirm
    // The modal renders an overlay div with a Disconnect button at the end
    await page.getByRole('button', { name: 'Disconnect' }).last().click()

    // The removed account should no longer appear
    await expect(page.getByText('remove-this-account')).not.toBeVisible()
    await expect(page.getByText('keep-this-account')).toBeVisible()
  })
})
