/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

// Read Badge source to understand variants
describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge variant="success">Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies success variant styles', () => {
    const { container } = render(<Badge variant="success">OK</Badge>)
    expect(container.firstChild).toHaveClass('bg-green-100')
  })

  it('applies error variant styles', () => {
    const { container } = render(<Badge variant="error">Failed</Badge>)
    expect(container.firstChild).toHaveClass('bg-red-100')
  })

  it('applies warning variant styles', () => {
    const { container } = render(<Badge variant="warning">Pending</Badge>)
    expect(container.firstChild).toHaveClass('bg-yellow-100')
  })

  it('applies neutral variant styles', () => {
    const { container } = render(<Badge variant="neutral">N/A</Badge>)
    expect(container.firstChild).toHaveClass('bg-gray-100')
  })
})
