/**
 * @jest-environment jsdom
 */
jest.mock('@/components/layout/AccountAvatar', () => ({
  __esModule: true,
  default: ({ login }: { login: string }) => <span data-testid="avatar">{login}</span>,
}))
jest.mock('@/components/ui/Badge', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, disabled, isLoading }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    isLoading?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled} data-loading={String(isLoading)}>
      {children}
    </button>
  ),
}))
jest.mock('@/components/ui/Modal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose, title, children }: {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
  }) => isOpen ? <div data-testid="modal" data-title={title}>{children}<button onClick={onClose}>×</button></div> : null,
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AccountRow from './AccountRow'
import type { GitHubAccountDTO } from '@/types'

const account: GitHubAccountDTO = {
  id: 'acc-1',
  githubLogin: 'alice',
  displayName: 'Personal',
  avatarUrl: null,
}

describe('AccountRow', () => {
  const onDisconnect = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => jest.clearAllMocks())

  it('renders github login', () => {
    render(<AccountRow account={account} isActive={false} onDisconnect={onDisconnect} isLast={false} />)
    expect(screen.getAllByText('alice').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Active badge when isActive is true', () => {
    render(<AccountRow account={account} isActive onDisconnect={onDisconnect} isLast={false} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('does not show Active badge when isActive is false', () => {
    render(<AccountRow account={account} isActive={false} onDisconnect={onDisconnect} isLast={false} />)
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('shows displayName when provided', () => {
    render(<AccountRow account={account} isActive={false} onDisconnect={onDisconnect} isLast={false} />)
    expect(screen.getByText('Personal')).toBeInTheDocument()
  })

  it('disables disconnect button when isLast is true', () => {
    render(<AccountRow account={account} isActive={false} onDisconnect={onDisconnect} isLast />)
    expect(screen.getByText('Disconnect')).toBeDisabled()
  })

  it('opens confirmation modal on Disconnect click', () => {
    render(<AccountRow account={account} isActive={false} onDisconnect={onDisconnect} isLast={false} />)
    fireEvent.click(screen.getByText('Disconnect'))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('calls onDisconnect when modal confirm is clicked', async () => {
    render(<AccountRow account={account} isActive={false} onDisconnect={onDisconnect} isLast={false} />)
    fireEvent.click(screen.getByText('Disconnect'))
    fireEvent.click(screen.getAllByText('Disconnect')[1])
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith('acc-1'))
  })

  it('closes modal when Cancel is clicked', () => {
    render(<AccountRow account={account} isActive={false} onDisconnect={onDisconnect} isLast={false} />)
    fireEvent.click(screen.getByText('Disconnect'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })
})
