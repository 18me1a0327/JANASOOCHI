import { describe, expect, it } from 'vitest'

import {
  normalizeReconciliationSearch,
  reconciliationCursorFromRows,
  summarizeRevisionRows,
  type ReconciliationEvidenceRow,
  type RevisionReconciliationSummary,
} from './reconciliation'

function summary(part: number, expected: number): RevisionReconciliationSummary {
  return {
    part_number: part,
    expected_slots: expected,
    active_documents: 2,
    revision_identifiers: ['2026'],
    source_records: expected * 2,
    unlinked_source_records: 3,
    english_linked_slots: expected,
    telugu_linked_slots: expected - 10,
    paired_slots: expected - 10,
    reconciled_slots: expected - 20,
    needs_review_slots: 10,
    missing_english_slots: 0,
    missing_telugu_slots: 10,
    duplicate_source_slots: 0,
    epic_conflict_slots: 0,
    verified_slots: 0,
  }
}

describe('Phase 4C reconciliation helpers', () => {
  it('uses expected slots as logical voters instead of adding language rows', () => {
    const result = summarizeRevisionRows([summary(227, 1014), summary(228, 973)])
    expect(result.expectedLogicalVoters).toBe(1987)
    expect(result.pairedSlots).toBe(1967)
  })

  it('aggregates reconciliation and unlinked evidence independently', () => {
    const result = summarizeRevisionRows([summary(227, 1014), summary(228, 973)])
    expect(result.reconciledSlots).toBe(1947)
    expect(result.needsReviewSlots).toBe(20)
    expect(result.unlinkedSourceRecords).toBe(6)
  })

  it('normalizes bounded reconciliation searches', () => {
    expect(normalizeReconciliationSearch('  227   RSU  123  ')).toBe('227 RSU 123')
    expect(normalizeReconciliationSearch('x'.repeat(150))).toHaveLength(120)
  })

  it('creates a complete keyset cursor from the last row', () => {
    const rows = [{ row_key: 'logical:b', cursor_part: 227, cursor_serial: 2 }] as ReconciliationEvidenceRow[]
    expect(reconciliationCursorFromRows(rows)).toEqual({ part: 227, serial: 2, rowKey: 'logical:b' })
    expect(reconciliationCursorFromRows([])).toBeNull()
  })
})

