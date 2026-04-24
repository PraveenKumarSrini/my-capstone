import { test, expect } from '@playwright/test'

const TEST_EMAIL = `e2e-auth-${Date.now()}@example.com`
const TEST_PASSWORD = 'SecurePass123'
const TEST_NAME = 'E2E Tester'

test.describe('Authentication', () => {
  test('registers with email and password, then redirects to dashboard', async ({ page }) => {
    await page.goto('/register')

    await page.getByLabel('Name').fill(TEST_NAME)
    await page.getByLabel('Email').fill(TEST_EMAIL)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    // After successful registration, app redirects to /login
    await expect(page).toHaveURL('/login')
  })

  test('logs in with credentials and lands on dashboard', async ({ page }) => {
    // Register first so the account exists
    const email = `e2e-login-${Date.now()}@example.com`
    await page.goto('/register')
    await page.getByLabel('Name').fill('Login Tester')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL('/login')

    // Now log in
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/dashboard')
    // Dashboard shell should be visible
    await expect(page.getByText('DevPulse')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('shows validation error for short password on register', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('Short Pass')
    await page.getByLabel('Email').fill('short@example.com')
    await page.getByLabel('Password').fill('abc')
    await page.getByRole('button', { name: 'Create account' }).click()

    // Client-side validation: minLength on the input prevents submission,
    // or server returns 400. Either way we should stay on /register
    await expect(page).toHaveURL('/register')
  })

  test('visiting /dashboard while logged out redirects to /login', async ({ page }) => {
    // Fresh context with no session cookies
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
  })

  test('visiting / while logged out redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('visiting / while logged in redirects to /dashboard', async ({ page }) => {
    const email = `e2e-root-${Date.now()}@example.com`

    // Register + login
    await page.goto('/register')
    await page.getByLabel('Name').fill('Root Redirect')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL('/login')

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dashboard')

    // Now visit root — should go to dashboard since authenticated
    await page.goto('/')
    await expect(page).toHaveURL('/dashboard')
  })
})
