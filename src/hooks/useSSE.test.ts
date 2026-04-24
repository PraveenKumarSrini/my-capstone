/**
 * @jest-environment jsdom
 */
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))

import { renderHook, act } from '@testing-library/react'
import { mutate } from 'swr'
import { useSSE } from './useSSE'

const mockMutate = mutate as jest.Mock

type FakeES = {
  listeners: Record<string, (() => void)[]>
  onerror: (() => void) | null
  closed: boolean
  addEventListener: (type: string, fn: () => void) => void
  close: () => void
  dispatch: (type: string) => void
}

function makeFakeEventSource(): FakeES {
  const es: FakeES = {
    listeners: {},
    onerror: null,
    closed: false,
    addEventListener(type: string, fn: () => void) {
      this.listeners[type] = this.listeners[type] ?? []
      this.listeners[type].push(fn)
    },
    close() { this.closed = true },
    dispatch(type: string) {
      ;(this.listeners[type] ?? []).forEach((fn) => fn())
    },
  }
  return es
}

let fakeES: FakeES

beforeEach(() => {
  jest.clearAllMocks()
  fakeES = makeFakeEventSource()
  global.EventSource = jest.fn().mockImplementation(() => fakeES) as never
})

describe('useSSE', () => {
  it('starts in connecting state', () => {
    const { result } = renderHook(() => useSSE())
    expect(result.current.status).toBe('connecting')
  })

  it('transitions to connected on "connected" event', () => {
    const { result } = renderHook(() => useSSE())
    act(() => { fakeES.dispatch('connected') })
    expect(result.current.status).toBe('connected')
  })

  it('transitions to connected on "heartbeat" event', () => {
    const { result } = renderHook(() => useSSE())
    act(() => { fakeES.dispatch('heartbeat') })
    expect(result.current.status).toBe('connected')
  })

  it('transitions to error on onerror', () => {
    const { result } = renderHook(() => useSSE())
    act(() => { if (fakeES.onerror) fakeES.onerror() })
    expect(result.current.status).toBe('error')
  })

  it('calls mutate on metrics_updated event', () => {
    renderHook(() => useSSE())
    act(() => { fakeES.dispatch('metrics_updated') })
    expect(mockMutate).toHaveBeenCalledWith('/api/dashboard')
    expect(mockMutate).toHaveBeenCalledWith('/api/repos')
  })

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useSSE())
    unmount()
    expect(fakeES.closed).toBe(true)
  })

  it('creates an EventSource connection to /api/sse/metrics', () => {
    renderHook(() => useSSE())
    expect(global.EventSource).toHaveBeenCalledWith('/api/sse/metrics')
  })
})
