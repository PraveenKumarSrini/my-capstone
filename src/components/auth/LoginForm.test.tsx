/**
 * @jest-environment jsdom
 */
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), refresh: jest.fn() })),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, type, isLoading }: { children: React.ReactNode; type?: string; isLoading?: boolean }) => (
    <button type={type as 'submit' | 'button'} data-loading={String(isLoading)}>
      {children}
    </button>
  ),
}))
jest.mock('./GitHubOAuthButton', () => ({
  __esModule: true,
  default: () => <button>Continue with GitHub</button>,
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import LoginForm from './LoginForm'

const mockSignIn = signIn as jest.Mock
const mockUseRouter = useRouter as jest.Mock

describe('LoginForm', () => {
  const mockPush = jest.fn()
  const mockRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({ push: mockPush, refresh: mockRefresh })
  })

  it('renders email and password fields', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders "Sign in" button', () => {
    render(<LoginForm />)
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('renders a link to /register', () => {
    render(<LoginForm />)
    expect(screen.getByText('Create one').closest('a')).toHaveAttribute('href', '/register')
  })

  it('shows error message on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin' })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to dashboard on successful sign-in', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct' } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('calls signIn with credentials provider and redirect false', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'user@test.com',
        password: 'pass',
        redirect: false,
      })
    )
  })

  it('renders GitHubOAuthButton', () => {
    render(<LoginForm />)
    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
  })
})
