/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import PRChart from './PRChart'

jest.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

const sampleData = [
  { date: '2026-01-01', opened: 2, merged: 1 },
  { date: '2026-01-02', opened: 1, merged: 0 },
]

describe('PRChart', () => {
  it('renders a bar chart when data is provided', () => {
    render(<PRChart data={sampleData} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('shows empty state when data is an empty array', () => {
    render(<PRChart data={[]} />)
    expect(screen.getByText('No PR data for this period')).toBeInTheDocument()
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<PRChart data={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('No PR data for this period')).not.toBeInTheDocument()
  })

  it('renders without isLoading prop (defaults to false)', () => {
    render(<PRChart data={sampleData} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })
})
