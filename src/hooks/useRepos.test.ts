/**
 * @jest-environment jsdom
 */
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}))

import { renderHook } from '@testing-library/react'
import useSWR from 'swr'
import { useRepos } from './useRepos'

const mockUseSWR = useSWR as jest.Mock

describe('useRepos', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses /api/repos as the SWR key', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: null, mutate: jest.fn() })

    renderHook(() => useRepos())

    expect(mockUseSWR).toHaveBeenCalledWith('/api/repos', expect.any(Function))
  })

  it('returns repos from data.data', () => {
    const repos = [{ id: 'r1', fullName: 'owner/repo' }]
    mockUseSWR.mockReturnValue({ data: { data: repos }, isLoading: false, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useRepos())

    expect(result.current.repos).toEqual(repos)
    expect(result.current.isLoading).toBe(false)
  })

  it('returns empty array when data is undefined', () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useRepos())

    expect(result.current.repos).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('exposes error and mutate', () => {
    const error = new Error('network error')
    const mutate = jest.fn()
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error, mutate })

    const { result } = renderHook(() => useRepos())

    expect(result.current.error).toBe(error)
    expect(result.current.mutate).toBe(mutate)
  })
})
