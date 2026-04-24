/**
 * @jest-environment jsdom
 */
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, type, disabled, isLoading, onClick }: {
    children: React.ReactNode
    type?: 'submit' | 'button'
    disabled?: boolean
    isLoading?: boolean
    onClick?: () => void
  }) => (
    <button type={type} disabled={disabled} data-loading={String(isLoading)} onClick={onClick}>
      {children}
    </button>
  ),
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConnectRepoForm from './ConnectRepoForm'

describe('ConnectRepoForm', () => {
  const onConnect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('renders the form with an input and Connect button', () => {
    render(<ConnectRepoForm onConnect={onConnect} />)
    expect(screen.getByPlaceholderText('owner/repo')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
  })

  it('shows validation error for invalid repo name format', async () => {
    render(<ConnectRepoForm onConnect={onConnect} />)
    fireEvent.change(screen.getByPlaceholderText('owner/repo'), { target: { value: 'invalid' } })
    fireEvent.submit(screen.getByPlaceholderText('owner/repo').closest('form')!)
    expect(await screen.findByText('Enter a valid repo name in owner/repo format')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls /api/repos/connect with fullName on valid submission', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    })
    render(<ConnectRepoForm onConnect={onConnect} />)
    fireEvent.change(screen.getByPlaceholderText('owner/repo'), { target: { value: 'owner/repo' } })
    fireEvent.submit(screen.getByPlaceholderText('owner/repo').closest('form')!)
    await waitFor(() => expect(onConnect).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/repos/connect',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows success message and clears input after successful connect', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    })
    render(<ConnectRepoForm onConnect={onConnect} />)
    fireEvent.change(screen.getByPlaceholderText('owner/repo'), { target: { value: 'owner/my-repo' } })
    fireEvent.submit(screen.getByPlaceholderText('owner/repo').closest('form')!)
    expect(await screen.findByText('owner/my-repo connected successfully')).toBeInTheDocument()
    expect((screen.getByPlaceholderText('owner/repo') as HTMLInputElement).value).toBe('')
  })

  it('shows error message from API on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Repo not found' }),
    })
    render(<ConnectRepoForm onConnect={onConnect} />)
    fireEvent.change(screen.getByPlaceholderText('owner/repo'), { target: { value: 'owner/repo' } })
    fireEvent.submit(screen.getByPlaceholderText('owner/repo').closest('form')!)
    expect(await screen.findByText('Repo not found')).toBeInTheDocument()
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('Connect button is disabled when input is empty', () => {
    render(<ConnectRepoForm onConnect={onConnect} />)
    expect(screen.getByText('Connect')).toBeDisabled()
  })
})
