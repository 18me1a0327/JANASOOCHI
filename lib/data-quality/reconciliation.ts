import type { Json } from '../../supabase/database.types'

export type ReconciliationStatus =
  | 'all'
  | 'reconciled'
  | 'needs_review'
  | 'missing_en'
  | 'missing_te'
  | 'duplicate_source'
  | 'epic_conflict'
  | 'unlinked_source'

export type EvidenceResult = 'match' | 'mismatch' | 'unavailable'

export type RevisionReconciliationSummary = {
  part_number: number
  expected_slots: number | string
  active_documents: number | string
  revision_identifiers: string[]
  source_records: number | string
  unlinked_source_records: number | string
  english_linked_slots: number | string
  telugu_linked_slots: number | string
  paired_slots: number | string
  reconciled_slots: number | string
  needs_review_slots: number | string
  missing_english_slots: number | string
  missing_telugu_slots: number | string
  duplicate_source_slots: number | string
  epic_conflict_slots: number | string
  verified_slots: number | string
}

export type ReconciliationEvidenceRow = {
  row_key: string
  logical_voter_id: string | null
  part_number: number
  serial_number: string | null
  logical_verification_status: 'unverified' | 'requires_review' | 'verified'
  reconciliation_status: Exclude<ReconciliationStatus, 'all'>
  english_source_count: number | string
  telugu_source_count: number | string
  epic_evidence: EvidenceResult
  house_evidence: EvidenceResult
  age_evidence: EvidenceResult
  gender_evidence: EvidenceResult
  english_source_record_id: string | null
  english_document_id: string | null
  english_revision_identifier: string | null
  english_voter_name: string | null
  english_relation_name: string | null
  english_house_number: string | null
  english_age: number | null
  english_gender: string | null
  english_epic: string | null
  english_physical_page: number | null
  english_printed_page: number | null
  english_bounding_box: Json | null
  telugu_source_record_id: string | null
  telugu_document_id: string | null
  telugu_revision_identifier: string | null
  telugu_voter_name: string | null
  telugu_relation_name: string | null
  telugu_house_number: string | null
  telugu_age: number | null
  telugu_gender: string | null
  telugu_epic: string | null
  telugu_physical_page: number | null
  telugu_printed_page: number | null
  telugu_bounding_box: Json | null
  cursor_part: number
  cursor_serial: number
  total_count: number | string
}

export type ReconciliationCursor = {
  part: number
  serial: number
  rowKey: string
}

export function reconciliationCursorFromRows(
  rows: readonly ReconciliationEvidenceRow[],
): ReconciliationCursor | null {
  const last = rows.at(-1)
  if (!last) return null
  return { part: last.cursor_part, serial: last.cursor_serial, rowKey: last.row_key }
}

export function normalizeReconciliationSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120)
}

export function summarizeRevisionRows(rows: readonly RevisionReconciliationSummary[]) {
  const sum = (key: keyof RevisionReconciliationSummary) => rows.reduce((total, row) => {
    const value = Number(row[key] ?? 0)
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)

  return {
    expectedLogicalVoters: sum('expected_slots'),
    pairedSlots: sum('paired_slots'),
    reconciledSlots: sum('reconciled_slots'),
    needsReviewSlots: sum('needs_review_slots'),
    unlinkedSourceRecords: sum('unlinked_source_records'),
  }
}

