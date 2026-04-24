/**
 * @jest-environment jsdom
 */
jest.mock('./MetricCard', () => ({
  __esModule: true,
  default: ({ label, value, isLoading }: { label: string; value: number; isLoading?: boolean }) => (
    <div data-testid={`card-${label}`} data-loading={String(isLoading)}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import MetricsSummaryBar from './MetricsSummaryBar'

describe('MetricsSummaryBar', () => {
  it('renders all four metric cards', () => {
    render(<MetricsSummaryBar />)
    expect(screen.getByTestId('card-Total Commits')).toBeInTheDocument()
    expect(screen.getByTestId('card-PRs Opened')).toBeInTheDocument()
    expect(screen.getByTestId('card-PRs Merged')).toBeInTheDocument()
    expect(screen.getByTestId('card-Reviews Given')).toBeInTheDocument()
  })

  it('displays summary values when provided', () => {
    const summary = { totalCommits: 10, totalPRsOpened: 3, totalPRsMerged: 2, totalReviews: 5 }
    render(<MetricsSummaryBar summary={summary} />)
    expect(screen.getByTestId('card-Total Commits')).toHaveTextContent('10')
    expect(screen.getByTestId('card-PRs Opened')).toHaveTextContent('3')
    expect(screen.getByTestId('card-PRs Merged')).toHaveTextContent('2')
    expect(screen.getByTestId('card-Reviews Given')).toHaveTextContent('5')
  })

  it('shows zeros when summary is not provided', () => {
    render(<MetricsSummaryBar />)
    const cards = screen.getAllByTestId(/^card-/)
    cards.forEach((card) => expect(card).toHaveTextContent('0'))
  })

  it('passes isLoading to all cards', () => {
    render(<MetricsSummaryBar isLoading />)
    const cards = screen.getAllByTestId(/^card-/)
    cards.forEach((card) => expect(card).toHaveAttribute('data-loading', 'true'))
  })
})
