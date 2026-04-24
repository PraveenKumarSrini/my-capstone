/**
 * @jest-environment jsdom
 */
jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import MetricsChart from './MetricsChart'
import type { MetricDTO } from '@/types'

const makeMetric = (overrides: Partial<MetricDTO> = {}): MetricDTO => ({
  id: 'm1',
  repoId: 'r1',
  type: 'COMMIT_COUNT',
  value: 5,
  recordedAt: '2026-01-15T00:00:00Z',
  ...overrides,
})

describe('MetricsChart', () => {
  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<MetricsChart data={[]} type="COMMIT_COUNT" isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state when data is empty and not loading', () => {
    render(<MetricsChart data={[]} type="COMMIT_COUNT" />)
    expect(screen.getByText('No data for the selected range')).toBeInTheDocument()
  })

  it('renders LineChart when data is present', () => {
    render(<MetricsChart data={[makeMetric()]} type="COMMIT_COUNT" />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('does not show skeleton when data is present', () => {
    const { container } = render(<MetricsChart data={[makeMetric()]} type="COMMIT_COUNT" />)
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })

  it('does not show empty state when data is present', () => {
    render(<MetricsChart data={[makeMetric()]} type="COMMIT_COUNT" />)
    expect(screen.queryByText('No data for the selected range')).not.toBeInTheDocument()
  })
})
