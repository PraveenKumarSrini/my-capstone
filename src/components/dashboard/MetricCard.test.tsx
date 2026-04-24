/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import MetricCard from './MetricCard'

describe('MetricCard', () => {
  const icon = <span data-testid="icon">📊</span>

  it('renders label and value', () => {
    render(<MetricCard label="Commits" value={42} icon={icon} />)
    expect(screen.getByText('Commits')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders delta when provided', () => {
    render(<MetricCard label="PRs" value={10} delta="+25%" icon={icon} />)
    expect(screen.getByText('+25% vs last period')).toBeInTheDocument()
  })

  it('applies green class for positive delta', () => {
    const { getByText } = render(<MetricCard label="PRs" value={10} delta="+5%" icon={icon} />)
    expect(getByText('+5% vs last period')).toHaveClass('text-green-600')
  })

  it('applies red class for negative delta', () => {
    const { getByText } = render(<MetricCard label="PRs" value={5} delta="-10%" icon={icon} />)
    expect(getByText('-10% vs last period')).toHaveClass('text-red-600')
  })

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<MetricCard label="Commits" value={0} icon={icon} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('Commits')).not.toBeInTheDocument()
  })

  it('renders icon', () => {
    render(<MetricCard label="Reviews" value={3} icon={icon} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
