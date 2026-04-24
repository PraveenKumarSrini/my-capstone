/**
 * @jest-environment jsdom
 */
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}))
jest.mock('@/components/ui/Spinner', () => ({
  __esModule: true,
  default: () => <svg data-testid="spinner" />,
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { signIn } from 'next-auth/react'
import GitHubOAuthButton from './GitHubOAuthButton'

const mockSignIn = signIn as jest.Mock

describe('GitHubOAuthButton', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders "Continue with GitHub" text', () => {
    render(<GitHubOAuthButton />)
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
  })

  it('calls signIn with github provider on click', async () => {
    mockSignIn.mockResolvedValue(undefined)
    render(<GitHubOAuthButton />)
    fireEvent.click(screen.getByText('Continue with GitHub'))
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('github', { callbackUrl: '/dashboard' })
    )
  })

  it('shows spinner while loading', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {}))
    render(<GitHubOAuthButton />)
    fireEvent.click(screen.getByText('Continue with GitHub'))
    await waitFor(() => expect(screen.getByTestId('spinner')).toBeInTheDocument())
  })

  it('disables the button while loading', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {}))
    render(<GitHubOAuthButton />)
    fireEvent.click(screen.getByText('Continue with GitHub'))
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())
  })
})
