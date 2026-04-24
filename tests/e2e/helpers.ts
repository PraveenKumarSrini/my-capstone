import type { Page } from '@playwright/test'

export const DEMO_EMAIL = 'demo@devpulse.dev'
export const DEMO_PASSWORD = 'demo1234'
export const TEST_PASSWORD = 'SecurePass123'

export async function registerAndLogin(
  page: Page,
  email: string,
  password = TEST_PASSWORD
): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Name').fill('E2E Test User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('/login')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
}

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/dashboard')
}

export async function connectMockGitHubAccount(
  page: Page,
  githubLogin: string,
  displayName?: string
): Promise<void> {
  const res = await page.request.post('/api/github-accounts', {
    data: {
      accessToken: `mock-token-${Date.now()}`,
      githubLogin,
      displayName: displayName ?? githubLogin,
    },
  })
  if (!res.ok()) {
    throw new Error(`Failed to connect GitHub account: ${await res.text()}`)
  }
}
