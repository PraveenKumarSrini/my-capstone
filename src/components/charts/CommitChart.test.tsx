/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import CommitChart from './CommitChart'

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

const sampleData = [
  { date: '2026-01-01', count: 5 },
  { date: '2026-01-02', count: 3 },
]

describe('CommitChart', () => {
  it('renders a line chart when data is provided', () => {
    render(<CommitChart data={sampleData} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('shows empty state when data is an empty array', () => {
    render(<CommitChart data={[]} />)
    expect(screen.getByText('No commit data for this period')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<CommitChart data={[]} isLoading />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
    expect(screen.queryByText('No commit data for this period')).not.toBeInTheDocument()
  })

  it('does not show skeleton when isLoading is false with data', () => {
    const { container } = render(<CommitChart data={sampleData} isLoading={false} />)
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })
})
