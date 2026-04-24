/**
 * @jest-environment jsdom
 */
jest.mock('@/components/ui/Badge', () => ({
  __esModule: true,
  default: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <span data-testid={`badge-${variant}`}>{children}</span>
  ),
}))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, isLoading }: { children: React.ReactNode; onClick?: () => void; isLoading?: boolean }) => (
    <button onClick={onClick} data-loading={String(isLoading)}>{children}</button>
  ),
}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import RepoCard from './RepoCard'
import type { RepositoryDTO } from '@/types'

const makeRepo = (overrides: Partial<RepositoryDTO> = {}): RepositoryDTO => ({
  id: 'r1',
  fullName: 'owner/repo',
  isTracked: true,
  webhookStatus: 'active',
  lastSyncedAt: null,
  githubRepoId: 123,
  githubAccountId: 'acc-1',
  ...overrides,
})

describe('RepoCard', () => {
  const onToggleTrack = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => jest.clearAllMocks())

  it('renders the repo full name', () => {
    render(<RepoCard repo={makeRepo()} onToggleTrack={onToggleTrack} isUpdating={false} />)
    expect(screen.getByText('owner/repo')).toBeInTheDocument()
  })

  it('shows webhook active badge', () => {
    render(<RepoCard repo={makeRepo({ webhookStatus: 'active' })} onToggleTrack={onToggleTrack} isUpdating={false} />)
    expect(screen.getByText('Webhook active')).toBeInTheDocument()
  })

  it('shows webhook missing badge', () => {
    render(<RepoCard repo={makeRepo({ webhookStatus: 'missing' })} onToggleTrack={onToggleTrack} isUpdating={false} />)
    expect(screen.getByText('Webhook missing')).toBeInTheDocument()
  })

  it('shows "Not yet synced" when lastSyncedAt is null', () => {
    render(<RepoCard repo={makeRepo()} onToggleTrack={onToggleTrack} isUpdating={false} />)
    expect(screen.getByText('Not yet synced')).toBeInTheDocument()
  })

  it('shows "Synced ..." when lastSyncedAt is set', () => {
    render(<RepoCard repo={makeRepo({ lastSyncedAt: new Date().toISOString() })} onToggleTrack={onToggleTrack} isUpdating={false} />)
    expect(screen.getByText(/Synced/)).toBeInTheDocument()
  })

  it('shows "Tracked" badge when isTracked is true', () => {
    render(<RepoCard repo={makeRepo({ isTracked: true })} onToggleTrack={onToggleTrack} isUpdating={false} />)
    expect(screen.getByText('Tracked')).toBeInTheDocument()
  })

  it('shows "Untracked" badge when isTracked is false', () => {
    render(<RepoCard repo={makeRepo({ isTracked: false })} onToggleTrack={onToggleTrack} isUpdating={false} />)
    expect(screen.getByText('Untracked')).toBeInTheDocument()
  })

  it('calls onToggleTrack with inverted isTracked when button clicked', () => {
    render(<RepoCard repo={makeRepo({ isTracked: true })} onToggleTrack={onToggleTrack} isUpdating={false} />)
    fireEvent.click(screen.getByText('Untrack'))
    expect(onToggleTrack).toHaveBeenCalledWith('r1', false)
  })

  it('shows loading state on button when isUpdating', () => {
    render(<RepoCard repo={makeRepo()} onToggleTrack={onToggleTrack} isUpdating={true} />)
    expect(screen.getByText('Untrack')).toHaveAttribute('data-loading', 'true')
  })
})
