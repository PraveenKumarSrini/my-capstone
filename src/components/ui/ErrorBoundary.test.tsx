/**
 * @jest-environment jsdom
 */
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'
import logger from '@/lib/logger'

const mockLogger = logger as { error: jest.Mock }

function BrokenChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return <span>ok</span>
}

const originalConsoleError = console.error
beforeAll(() => { console.error = jest.fn() })
afterAll(() => { console.error = originalConsoleError })

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <span>hello</span>
      </ErrorBoundary>
    )
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('shows default fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  })

  it('shows custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
  })

  it('logs the error via logger', () => {
    render(
      <ErrorBoundary>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    )
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'React render error'
    )
  })

  it('shows "Try again" button in the default fallback', () => {
    render(
      <ErrorBoundary>
        <BrokenChild shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('resets hasError state when "Try again" is clicked', () => {
    let shouldFail = true
    function Toggle() {
      if (shouldFail) throw new Error('boom')
      return <span>recovered</span>
    }
    render(<ErrorBoundary><Toggle /></ErrorBoundary>)
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    shouldFail = false
    fireEvent.click(screen.getByText('Try again'))
    expect(screen.getByText('recovered')).toBeInTheDocument()
  })
})
