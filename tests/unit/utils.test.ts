import { buildDateRange, formatMetricValue, chunkArray, timeAgo } from '@/lib/utils'

describe('buildDateRange', () => {
  it('parses valid ISO datetimes into Date objects', () => {
    const result = buildDateRange('2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z')
    expect(result.gte).toEqual(new Date('2026-01-01T00:00:00Z'))
    expect(result.lte).toEqual(new Date('2026-01-31T23:59:59Z'))
  })

  it('throws ZodError when from is not a valid ISO datetime', () => {
    expect(() => buildDateRange('not-a-date', '2026-01-31T23:59:59Z')).toThrow()
  })

  it('throws ZodError when to is not a valid ISO datetime', () => {
    expect(() => buildDateRange('2026-01-01T00:00:00Z', 'bad')).toThrow()
  })

  it('throws ZodError when both values are invalid', () => {
    expect(() => buildDateRange('', '')).toThrow()
  })
})

describe('formatMetricValue', () => {
  it('formats COMMIT_COUNT with singular form at 1', () => {
    expect(formatMetricValue('COMMIT_COUNT', 1)).toBe('1 commit')
  })

  it('formats COMMIT_COUNT with plural form at 0', () => {
    expect(formatMetricValue('COMMIT_COUNT', 0)).toBe('0 commits')
  })

  it('formats COMMIT_COUNT with plural form at 42', () => {
    expect(formatMetricValue('COMMIT_COUNT', 42)).toBe('42 commits')
  })

  it('formats PR_OPENED', () => {
    expect(formatMetricValue('PR_OPENED', 3)).toBe('3 PRs opened')
    expect(formatMetricValue('PR_OPENED', 1)).toBe('1 PR opened')
  })

  it('formats PR_MERGED', () => {
    expect(formatMetricValue('PR_MERGED', 2)).toBe('2 PRs merged')
    expect(formatMetricValue('PR_MERGED', 1)).toBe('1 PR merged')
  })

  it('formats PR_CLOSED', () => {
    expect(formatMetricValue('PR_CLOSED', 0)).toBe('0 PRs closed')
    expect(formatMetricValue('PR_CLOSED', 1)).toBe('1 PR closed')
  })

  it('formats REVIEW_COUNT', () => {
    expect(formatMetricValue('REVIEW_COUNT', 5)).toBe('5 reviews')
    expect(formatMetricValue('REVIEW_COUNT', 1)).toBe('1 review')
  })

  it('formats COMMENT_COUNT', () => {
    expect(formatMetricValue('COMMENT_COUNT', 10)).toBe('10 comments')
    expect(formatMetricValue('COMMENT_COUNT', 1)).toBe('1 comment')
  })
})

describe('chunkArray', () => {
  it('splits an array into chunks of the given size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns the whole array as one chunk when size >= length', () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]])
  })

  it('returns an empty array for empty input', () => {
    expect(chunkArray([], 3)).toEqual([])
  })

  it('handles chunk size of 1', () => {
    expect(chunkArray(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']])
  })
})

describe('timeAgo', () => {
  it('formats seconds ago', () => {
    const date = new Date(Date.now() - 45_000)
    expect(timeAgo(date)).toBe('45 seconds ago')
  })

  it('uses singular "second"', () => {
    const date = new Date(Date.now() - 1_000)
    expect(timeAgo(date)).toBe('1 second ago')
  })

  it('formats minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60_000)
    expect(timeAgo(date)).toBe('5 minutes ago')
  })

  it('uses singular "minute"', () => {
    const date = new Date(Date.now() - 60_000)
    expect(timeAgo(date)).toBe('1 minute ago')
  })

  it('formats hours ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60_000)
    expect(timeAgo(date)).toBe('3 hours ago')
  })

  it('uses singular "hour"', () => {
    const date = new Date(Date.now() - 60 * 60_000)
    expect(timeAgo(date)).toBe('1 hour ago')
  })

  it('formats days ago', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60_000)
    expect(timeAgo(date)).toBe('2 days ago')
  })

  it('uses singular "day"', () => {
    const date = new Date(Date.now() - 24 * 60 * 60_000)
    expect(timeAgo(date)).toBe('1 day ago')
  })
})
