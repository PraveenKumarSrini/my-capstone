/**
 * @jest-environment jsdom
 */
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import NavLinks from './NavLinks'

const mockUsePathname = usePathname as jest.Mock

describe('NavLinks', () => {
  it('renders all three navigation links', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<NavLinks />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Repositories')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('applies active class to Dashboard when on /dashboard exactly', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<NavLinks />)
    expect(screen.getByText('Dashboard').closest('a')).toHaveClass('bg-indigo-50')
    expect(screen.getByText('Repositories').closest('a')).not.toHaveClass('bg-indigo-50')
  })

  it('does not activate Dashboard for /dashboard/repos (exact match required)', () => {
    mockUsePathname.mockReturnValue('/dashboard/repos')
    render(<NavLinks />)
    expect(screen.getByText('Dashboard').closest('a')).not.toHaveClass('bg-indigo-50')
    expect(screen.getByText('Repositories').closest('a')).toHaveClass('bg-indigo-50')
  })

  it('activates Settings for /dashboard/settings subpaths', () => {
    mockUsePathname.mockReturnValue('/dashboard/settings/profile')
    render(<NavLinks />)
    expect(screen.getByText('Settings').closest('a')).toHaveClass('bg-indigo-50')
  })

  it('links to the correct hrefs', () => {
    mockUsePathname.mockReturnValue('/')
    render(<NavLinks />)
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('Repositories').closest('a')).toHaveAttribute('href', '/dashboard/repos')
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/dashboard/settings')
  })
})
