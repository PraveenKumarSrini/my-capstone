/**
 * @jest-environment jsdom
 */
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}))

import { renderHook } from '@testing-library/react'
import useSWR from 'swr'
import { useMetrics } from './useMetrics'

const mockUseSWR = useSWR as jest.Mock

describe('useMetrics', () => {
  beforeEach(() => jest.clearAllMocks())

  const params = { repoId: 'r1', from: '2026-01-01T00:00:00Z', to: '2026-01-31T00:00:00Z', type: 'COMMIT_COUNT' as const }

  it('builds the correct SWR key', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: null, mutate: jest.fn() })

    renderHook(() => useMetrics(params as never))

    const expectedKey = `/api/repos/r1/metrics?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}&type=COMMIT_COUNT`
    expect(mockUseSWR).toHaveBeenCalledWith(expectedKey, expect.any(Function))
  })

  it('returns metrics from data.data', () => {
    const metrics = [{ id: 'm1', type: 'COMMIT_COUNT', value: 5 }]
    mockUseSWR.mockReturnValue({ data: { data: metrics }, isLoading: false, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useMetrics(params as never))

    expect(result.current.metrics).toEqual(metrics)
    expect(result.current.isLoading).toBe(false)
  })

  it('returns empty array when data is undefined', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useMetrics(params as never))

    expect(result.current.metrics).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('exposes error and mutate', () => {
    const error = new Error('fetch failed')
    const mutate = jest.fn()
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error, mutate })

    const { result } = renderHook(() => useMetrics(params as never))

    expect(result.current.error).toBe(error)
    expect(result.current.mutate).toBe(mutate)
  })
})
