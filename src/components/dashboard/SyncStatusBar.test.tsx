/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import SyncStatusBar from './SyncStatusBar'

describe('SyncStatusBar', () => {
  it('shows "Live" when SSE is connected', () => {
    render(<SyncStatusBar lastSyncedAt={null} sseStatus="connected" />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows "Connecting…" when SSE is connecting', () => {
    render(<SyncStatusBar lastSyncedAt={null} sseStatus="connecting" />)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows "Disconnected" when SSE is in error state', () => {
    render(<SyncStatusBar lastSyncedAt={null} sseStatus="error" />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows "Not yet synced" when lastSyncedAt is null', () => {
    render(<SyncStatusBar lastSyncedAt={null} sseStatus="connected" />)
    expect(screen.getByText('Not yet synced')).toBeInTheDocument()
  })

  it('shows relative time when lastSyncedAt is provided', () => {
    const recent = new Date().toISOString()
    render(<SyncStatusBar lastSyncedAt={recent} sseStatus="connected" />)
    expect(screen.getByText(/Last synced/)).toBeInTheDocument()
  })

  it('applies green dot for connected status', () => {
    const { container } = render(<SyncStatusBar lastSyncedAt={null} sseStatus="connected" />)
    const dot = container.querySelector('.bg-green-500')
    expect(dot).toBeInTheDocument()
  })

  it('applies red dot for error status', () => {
    const { container } = render(<SyncStatusBar lastSyncedAt={null} sseStatus="error" />)
    const dot = container.querySelector('.bg-red-500')
    expect(dot).toBeInTheDocument()
  })
})
