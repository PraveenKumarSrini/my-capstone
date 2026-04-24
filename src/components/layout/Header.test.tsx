/**
 * @jest-environment jsdom
 */
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import Header from './Header'

const mockUseSession = useSession as jest.Mock
const mockSignOut = signOut as jest.Mock

describe('Header', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the title', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<Header title="Dashboard" />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders breadcrumb when provided', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<Header title="Repos" breadcrumb="Settings" />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('does not render breadcrumb when not provided', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<Header title="Dashboard" />)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('shows user name when session has a name', () => {
    mockUseSession.mockReturnValue({ data: { user: { name: 'Alice' } } })
    render(<Header title="Dashboard" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('does not show user name when session has no name', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } })
    render(<Header title="Dashboard" />)
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('calls signOut when sign out button is clicked', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<Header title="Dashboard" />)
    fireEvent.click(screen.getByText('Sign out'))
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })
})
