/**
 * @jest-environment jsdom
 */
jest.mock('@/components/ui/Badge', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import ActivityFeed from './ActivityFeed'
import type { DashboardData } from '@/types'

type Event = DashboardData['recentActivity'][number]

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  repoFullName: 'owner/repo',
  type: 'COMMIT_COUNT',
  value: 5,
  recordedAt: new Date().toISOString(),
  ...overrides,
})

describe('ActivityFeed', () => {
  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<ActivityFeed events={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state when events array is empty', () => {
    render(<ActivityFeed events={[]} />)
    expect(screen.getByText('No recent activity')).toBeInTheDocument()
  })

  it('renders events when provided', () => {
    const events = [makeEvent({ repoFullName: 'acme/api', type: 'PR_MERGED', value: 1 })]
    render(<ActivityFeed events={events} />)
    expect(screen.getByText('acme/api')).toBeInTheDocument()
  })

  it('renders multiple events', () => {
    const events = [
      makeEvent({ repoFullName: 'acme/api' }),
      makeEvent({ repoFullName: 'acme/web' }),
    ]
    render(<ActivityFeed events={events} />)
    expect(screen.getByText('acme/api')).toBeInTheDocument()
    expect(screen.getByText('acme/web')).toBeInTheDocument()
  })

  it('renders the "Recent Activity" header', () => {
    render(<ActivityFeed events={[]} />)
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
  })

  it('shows formatted metric value for PR_MERGED', () => {
    const events = [makeEvent({ type: 'PR_MERGED', value: 2 })]
    render(<ActivityFeed events={events} />)
    expect(screen.getByText(/2 PRs merged/i)).toBeInTheDocument()
  })
})
