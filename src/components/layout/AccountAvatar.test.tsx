/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import AccountAvatar from './AccountAvatar'

describe('AccountAvatar', () => {
  it('renders an img when avatarUrl is provided', () => {
    render(<AccountAvatar login="alice" avatarUrl="https://example.com/avatar.png" />)
    const img = screen.getByAltText('alice') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe('https://example.com/avatar.png')
  })

  it('renders initials fallback when avatarUrl is null', () => {
    render(<AccountAvatar login="bob" avatarUrl={null} />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('applies sm size class', () => {
    const { container } = render(<AccountAvatar login="alice" avatarUrl={null} size="sm" />)
    expect(container.firstChild).toHaveClass('h-6', 'w-6')
  })

  it('applies md size class by default', () => {
    const { container } = render(<AccountAvatar login="alice" avatarUrl={null} />)
    expect(container.firstChild).toHaveClass('h-8', 'w-8')
  })

  it('applies lg size class', () => {
    const { container } = render(<AccountAvatar login="alice" avatarUrl={null} size="lg" />)
    expect(container.firstChild).toHaveClass('h-10', 'w-10')
  })

  it('uppercases the first character of login', () => {
    render(<AccountAvatar login="charlie" avatarUrl={null} />)
    expect(screen.getByText('C')).toBeInTheDocument()
  })
})
