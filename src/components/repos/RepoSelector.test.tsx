/**
 * @jest-environment jsdom
 */
jest.mock('@/hooks/useRepos', () => ({
  useRepos: jest.fn(),
}))
jest.mock('./RepoCard', () => ({
  __esModule: true,
  default: ({ repo }: { repo: { fullName: string } }) => (
    <div data-testid={`repo-${repo.fullName}`}>{repo.fullName}</div>
  ),
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import { useRepos } from '@/hooks/useRepos'
import RepoSelector from './RepoSelector'

const mockUseRepos = useRepos as jest.Mock

describe('RepoSelector', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows loading skeleton rows when isLoading is true', () => {
    mockUseRepos.mockReturnValue({ repos: [], isLoading: true, error: null, mutate: jest.fn() })
    const { container } = render(<RepoSelector />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state when repos is empty', () => {
    mockUseRepos.mockReturnValue({ repos: [], isLoading: false, error: null, mutate: jest.fn() })
    render(<RepoSelector />)
    expect(screen.getByText('No repositories connected yet')).toBeInTheDocument()
  })

  it('shows error state when error is present', () => {
    mockUseRepos.mockReturnValue({ repos: [], isLoading: false, error: new Error('fail'), mutate: jest.fn() })
    render(<RepoSelector />)
    expect(screen.getByText('Failed to load repositories')).toBeInTheDocument()
  })

  it('renders a RepoCard for each repo', () => {
    const repos = [
      { id: 'r1', fullName: 'alice/api', isTracked: true, webhookStatus: 'active', lastSyncedAt: null, githubRepoId: 1, githubAccountId: 'acc-1' },
      { id: 'r2', fullName: 'alice/web', isTracked: false, webhookStatus: 'unregistered', lastSyncedAt: null, githubRepoId: 2, githubAccountId: 'acc-1' },
    ]
    mockUseRepos.mockReturnValue({ repos, isLoading: false, error: null, mutate: jest.fn() })
    render(<RepoSelector />)
    expect(screen.getByTestId('repo-alice/api')).toBeInTheDocument()
    expect(screen.getByTestId('repo-alice/web')).toBeInTheDocument()
  })
})
