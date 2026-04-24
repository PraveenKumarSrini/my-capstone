/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import MetricTypeSelector from './MetricTypeSelector'

describe('MetricTypeSelector', () => {
  const onChange = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders all six metric type options', () => {
    render(<MetricTypeSelector selected="COMMIT_COUNT" onChange={onChange} />)
    expect(screen.getByText('Commits')).toBeInTheDocument()
    expect(screen.getByText('PRs Opened')).toBeInTheDocument()
    expect(screen.getByText('PRs Merged')).toBeInTheDocument()
    expect(screen.getByText('PRs Closed')).toBeInTheDocument()
    expect(screen.getByText('Reviews')).toBeInTheDocument()
    expect(screen.getByText('Comments')).toBeInTheDocument()
  })

  it('selects the correct option based on selected prop', () => {
    render(<MetricTypeSelector selected="PR_MERGED" onChange={onChange} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('PR_MERGED')
  })

  it('calls onChange when a different option is selected', () => {
    render(<MetricTypeSelector selected="COMMIT_COUNT" onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'REVIEW_COUNT' } })
    expect(onChange).toHaveBeenCalledWith('REVIEW_COUNT')
  })

  it('renders a label', () => {
    render(<MetricTypeSelector selected="COMMIT_COUNT" onChange={onChange} />)
    expect(screen.getByText('Metric')).toBeInTheDocument()
  })
})
