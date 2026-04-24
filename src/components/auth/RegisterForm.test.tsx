/**
 * @jest-environment jsdom
 */
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

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import RegisterForm from './RegisterForm'

const mockUseRouter = useRouter as jest.Mock

describe('RegisterForm', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({ push: mockPush, refresh: jest.fn() })
    global.fetch = jest.fn()
  })

  it('renders name, email, and password fields', () => {
    render(<RegisterForm />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders a "Create account" button', () => {
    render(<RegisterForm />)
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('renders a link to /login', () => {
    render(<RegisterForm />)
    expect(screen.getByText('Sign in').closest('a')).toHaveAttribute('href', '/login')
  })

  it('shows error when password is shorter than 8 characters', async () => {
    render(<RegisterForm />)
    fillForm('Alice', 'alice@test.com', 'short')
    submitForm()
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls /api/auth/register on valid submission', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    })
    render(<RegisterForm />)
    fillForm('Alice', 'alice@test.com', 'password123')
    submitForm()
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })

  it('redirects to /login on successful registration', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    })
    render(<RegisterForm />)
    fillForm('Alice', 'alice@test.com', 'password123')
    submitForm()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'))
  })

  it('shows error message from API on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Email already exists' }),
    })
    render(<RegisterForm />)
    fillForm('Alice', 'alice@test.com', 'password123')
    submitForm()
    expect(await screen.findByText('Email already exists')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

function fillForm(name: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

function submitForm() {
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
}
