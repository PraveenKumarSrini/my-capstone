/**
 * @jest-environment jsdom
 */
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

import { renderHook } from '@testing-library/react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { useActiveAccount } from './useActiveAccount'

const mockUseSWR = useSWR as jest.Mock
const mockUseSession = useSession as jest.Mock

describe('useActiveAccount', () => {
  beforeEach(() => jest.clearAllMocks())

  it('passes null key to SWR when no session', () => {
    mockUseSession.mockReturnValue({ data: null })
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useActiveAccount())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function))
    expect(result.current.accounts).toEqual([])
    expect(result.current.activeAccountId).toBeNull()
  })

  it('passes /api/github-accounts key when session exists', () => {
    mockUseSession.mockReturnValue({ data: { user: { activeAccountId: 'acc-1' } } })
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useActiveAccount())

    expect(mockUseSWR).toHaveBeenCalledWith('/api/github-accounts', expect.any(Function))
    expect(result.current.isLoading).toBe(true)
  })

  it('returns accounts from data.data', () => {
    const accounts = [{ id: 'a1', githubLogin: 'alice' }]
    mockUseSession.mockReturnValue({ data: { user: { activeAccountId: 'a1' } } })
    mockUseSWR.mockReturnValue({ data: { data: accounts }, isLoading: false, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useActiveAccount())

    expect(result.current.accounts).toEqual(accounts)
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('returns empty array when data is undefined', () => {
    mockUseSession.mockReturnValue({ data: { user: {} } })
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: null, mutate: jest.fn() })

    const { result } = renderHook(() => useActiveAccount())

    expect(result.current.accounts).toEqual([])
    expect(result.current.activeAccountId).toBeNull()
  })

  it('exposes mutate function', () => {
    const mutate = jest.fn()
    mockUseSession.mockReturnValue({ data: null })
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: null, mutate })

    const { result } = renderHook(() => useActiveAccount())

    expect(result.current.mutate).toBe(mutate)
  })
})
