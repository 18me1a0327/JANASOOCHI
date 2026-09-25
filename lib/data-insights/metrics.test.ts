import { describe, expect, it } from 'vitest'

import {
  EXPECTED_LOGICAL_TOTAL,
  EXPECTED_PART_TOTALS,
  ageGroup,
  aggregateCanonicalRows,
  filterCanonicalRows,
  hasComparableRevision,
  normalizeGender,
  normalizeHouseNumber,
  safePercent,
} from './metrics'

const rows = [
  { logicalVoterId: 'a', partNumber: 227, age: 18, gender: 'Male', houseNumber: ' 1 - 2 ', epic: 'ABC1' },
  { logicalVoterId: 'b', partNumber: 227, age: 25, gender: 'Female', houseNumber: '1-2', epic: 'ABC1' },
  { logicalVoterId: 'c', partNumber: 228, age: null, gender: 'uncertain', houseNumber: null, epic: null },
]

describe('voter insights metrics', () => {
  it('keeps official Part totals and 3,454 logical voters', () => {
    expect(EXPECTED_PART_TOTALS).toEqual({ 227: 1014, 228: 973, 229: 888, 230: 579 })
    expect(EXPECTED_LOGICAL_TOTAL).toBe(3454)
  })

  it('does not double-count language source copies of one logical voter', () => {
    expect(aggregateCanonicalRows([...rows, { ...rows[0], gender: 'పురుషుడు' }]).total).toBe(3)
  })

  it('keeps malformed or missing gender unknown', () => {
    expect(normalizeGender('Male')).toBe('male')
    expect(normalizeGender('స్త్రీ')).toBe('female')
    expect(normalizeGender('Third gender')).toBe('other')
    expect(normalizeGender('not-readable')).toBe('unknown')
    expect(normalizeGender(null)).toBe('unknown')
  })

  it.each([
    [18, '18_25'], [25, '18_25'], [26, '26_35'], [35, '26_35'],
    [36, '36_45'], [45, '36_45'], [46, '46_60'], [60, '46_60'],
    [61, '61_75'], [75, '61_75'], [76, '76_plus'], [125, '76_plus'],
    [null, 'unknown_invalid'], [17, 'unknown_invalid'], [126, 'unknown_invalid'],
  ])('groups age %s as %s', (age, group) => expect(ageGroup(age)).toBe(group))

  it('excludes invalid ages from averages and exposes unknown age', () => {
    const result = aggregateCanonicalRows([...rows, { logicalVoterId: 'd', partNumber: 229, age: 999, gender: null, houseNumber: null, epic: null }])
    expect(result.averageAge).toBe(21.5)
    expect(result.validAgeCount).toBe(2)
    expect(result.unknownInvalidAge).toBe(2)
  })

  it('normalizes house numbers for grouping without merging voters', () => {
    expect(normalizeHouseNumber(' 1 - 2 ')).toBe('1-2')
    const result = aggregateCanonicalRows(rows)
    expect(result.total).toBe(3)
    expect(result.houseGroups).toBe(1)
  })

  it('reports duplicate EPIC as an indicator only', () => {
    expect(aggregateCanonicalRows(rows).duplicateEpicGroups).toBe(1)
  })

  it('returns a safe zero percentage for empty filters', () => {
    expect(safePercent(0, 0)).toBe(0)
    expect(Number.isFinite(safePercent(1, 0))).toBe(true)
  })

  it('applies Part, gender, and age filters to the same canonical rows', () => {
    expect(filterCanonicalRows(rows, { partNumber: 228 })).toHaveLength(1)
    expect(filterCanonicalRows(rows, { gender: 'female' })).toEqual([rows[1]])
    expect(filterCanonicalRows(rows, { age: '18_25' })).toHaveLength(2)
    expect(filterCanonicalRows(rows, { partNumber: 230 })).toEqual([])
  })

  it('requires a second real revision before comparison', () => {
    expect(hasComparableRevision(1)).toBe(false)
    expect(hasComparableRevision(2)).toBe(true)
  })

  it('does not mutate source rows while aggregating analytics', () => {
    const snapshot = structuredClone(rows)
    aggregateCanonicalRows(rows)
    expect(rows).toEqual(snapshot)
  })
})

