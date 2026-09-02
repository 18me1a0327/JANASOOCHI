import { describe, expect, it } from 'vitest'
import { classifyReviewError, reviewPageOffset } from './review'

describe('review pagination', () => {
  it('calculates bounded page offsets for the supported page sizes', () => {
    expect(reviewPageOffset(1, 50)).toBe(0)
    expect(reviewPageOffset(2, 50)).toBe(50)
    expect(reviewPageOffset(20, 100)).toBe(1900)
    expect(reviewPageOffset(0, 5000)).toBe(0)
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
