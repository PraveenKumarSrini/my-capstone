/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AccountSwitcher from './AccountSwitcher'

jest.mock('@/hooks/useActiveAccount', () => ({
  useActiveAccount: jest.fn(),
}))
jest.mock('./AccountAvatar', () => ({
  __esModule: true,
  default: ({ login }: { login: string }) => <span data-testid={`avatar-${login}`}>{login}</span>,
}))
jest.mock('@/components/ui/Spinner', () => ({
  __esModule: true,
  default: () => <svg data-testid="spinner" />,
}))

import { useActiveAccount } from '@/hooks/useActiveAccount'

const mockUseActiveAccount = useActiveAccount as jest.Mock
const mockRouterRefresh = jest.fn()

// next/navigation is mocked in jest.setup.ts; override refresh for this file
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRouterRefresh }),
  usePathname: jest.fn(() => '/'),
  redirect: jest.fn(),
  notFound: jest.fn(),
}))

const accounts = [
  { id: 'acc-1', githubLogin: 'alice', displayName: 'Personal', avatarUrl: null },
  { id: 'acc-2', githubLogin: 'alice-work', displayName: 'Work', avatarUrl: null },
]

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
})

describe('AccountSwitcher', () => {
  it('shows spinner while loading', () => {
    mockUseActiveAccount.mockReturnValue({
      accounts: [],
      activeAccountId: null,
      isLoading: true,
      mutate: jest.fn(),
    })
    const { container } = render(<AccountSwitcher />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders all connected accounts', () => {
    mockUseActiveAccount.mockReturnValue({
      accounts,
      activeAccountId: 'acc-1',
      isLoading: false,
      mutate: jest.fn(),
    })
    render(<AccountSwitcher />)
    expect(screen.getByTestId('avatar-alice')).toBeInTheDocument()
    expect(screen.getByTestId('avatar-alice-work')).toBeInTheDocument()
  })

  it('shows "Connect GitHub Account" link', () => {
    mockUseActiveAccount.mockReturnValue({
      accounts: [],
      activeAccountId: null,
      isLoading: false,
      mutate: jest.fn(),
    })
    render(<AccountSwitcher />)
    expect(screen.getByText('Connect GitHub Account')).toBeInTheDocument()
  })

  it('calls switch API and router.refresh when a non-active account is clicked', async () => {
    const mutate = jest.fn().mockResolvedValue(undefined)
    mockUseActiveAccount.mockReturnValue({
      accounts,
      activeAccountId: 'acc-1',
      isLoading: false,
      mutate,
    })
    render(<AccountSwitcher />)

    const workBtn = screen.getByText('Work').closest('button')!
    fireEvent.click(workBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/github-accounts/acc-2/switch',
        { method: 'POST' }
      )
    })
    await waitFor(() => expect(mockRouterRefresh).toHaveBeenCalled())
  })

  it('does not call switch API when the active account is clicked again', () => {
    mockUseActiveAccount.mockReturnValue({
      accounts,
      activeAccountId: 'acc-1',
      isLoading: false,
      mutate: jest.fn(),
    })
    render(<AccountSwitcher />)

    const personalBtn = screen.getByText('Personal').closest('button')!
    fireEvent.click(personalBtn)

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
