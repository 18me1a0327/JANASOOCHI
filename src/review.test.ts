import { describe, expect, it } from 'vitest'
import { classifyReviewError, normalizeReviewSearch, reviewCursorFromRows, reviewPageOffset } from './review'
import type { ReviewPageRow } from './review'

describe('review pagination', () => {
  it('calculates bounded page offsets for the supported page sizes', () => {
    expect(reviewPageOffset(1, 50)).toBe(0)
    expect(reviewPageOffset(2, 50)).toBe(50)
    expect(reviewPageOffset(20, 100)).toBe(1900)
    expect(reviewPageOffset(0, 5000)).toBe(0)
  })
})

describe('review server-search contracts', () => {
  it('normalizes and bounds text search without changing source data', () => {
    expect(normalizeReviewSearch('  Lakshmi   1-25  ')).toBe('Lakshmi 1-25')
    expect(normalizeReviewSearch('x'.repeat(140))).toHaveLength(120)
  })

  it('creates the next keyset cursor from the final ordered row', () => {
    const rows = [
      { issue_id: 11, issue_created_at: '2026-09-09T11:00:00Z' },
      { issue_id: 7, issue_created_at: '2026-09-09T10:00:00Z' },
    ] as ReviewPageRow[]
    expect(reviewCursorFromRows(rows)).toEqual({ createdAt: '2026-09-09T10:00:00Z', issueId: 7 })
    expect(reviewCursorFromRows([])).toBeNull()
  })
})

describe('review error messages', () => {
  it('distinguishes session, permission, query and network failures', () => {
    expect(classifyReviewError({ status: 401, message: 'JWT expired' }).kind).toBe('session')
    expect(classifyReviewError({ code: '42501', message: 'permission denied' }).kind).toBe('permission')
    expect(classifyReviewError({ status: 400, code: 'PGRST100' }).kind).toBe('query')
    expect(classifyReviewError(new TypeError('Failed to fetch')).kind).toBe('network')
  })
})

