/**
 * @jest-environment jsdom
 */
jest.mock('@/components/ui/Badge', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import RepoSyncStatus from './RepoSyncStatus'
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

describe('RepoSyncStatus', () => {
  it('renders the repo full name', () => {
    render(<RepoSyncStatus repo={makeRepo()} />)
    expect(screen.getByText('owner/repo')).toBeInTheDocument()
  })

  it('shows "Not yet synced" when lastSyncedAt is null', () => {
    render(<RepoSyncStatus repo={makeRepo()} />)
    expect(screen.getByText('Not yet synced')).toBeInTheDocument()
  })

  it('shows "Last synced ..." when lastSyncedAt is provided', () => {
    render(<RepoSyncStatus repo={makeRepo({ lastSyncedAt: new Date().toISOString() })} />)
    expect(screen.getByText(/Last synced/)).toBeInTheDocument()
  })

  it('shows webhook active label', () => {
    render(<RepoSyncStatus repo={makeRepo({ webhookStatus: 'active' })} />)
    expect(screen.getByText('Webhook active')).toBeInTheDocument()
  })

  it('shows webhook missing label', () => {
    render(<RepoSyncStatus repo={makeRepo({ webhookStatus: 'missing' })} />)
    expect(screen.getByText('Webhook missing')).toBeInTheDocument()
  })

  it('shows no webhook label for unregistered status', () => {
    render(<RepoSyncStatus repo={makeRepo({ webhookStatus: 'unregistered' })} />)
    expect(screen.getByText('No webhook')).toBeInTheDocument()
  })
})
