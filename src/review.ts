import type { FieldConfidence, RecordLanguage } from './types'

export type ReviewCategory =
  | 'all'
  | 'critical'
  | 'pages'
  | 'records'
  | 'low_confidence'
  | 'serial_gaps'
  | 'house_number'
  | 'possible_duplicate'
  | 'language'

export interface ReviewPageRow {
  issue_id: number
  issue_type: string
  issue_detail: string
  issue_status: string
  issue_severity: 'critical' | 'needs_review' | 'informational'
  issue_created_at: string
  voter_id: string | null
  part_number: number | null
  serial_number: string | null
  voter_name: string | null
  relation_type: string | null
  relation_name: string | null
  house_number: string | null
  age: number | null
  gender: string | null
  epic_number: string | null
  source_language: RecordLanguage | null
  verification_status: 'verified' | 'requires_review' | 'unverified' | null
  voter_ocr_confidence: number | null
  voter_pdf_page_number: number | null
  voter_printed_page_number: number | null
  original_text: string | null
  field_confidence: FieldConfidence | null
  corrected_value: Record<string, string> | null
  pdf_id: string
  filename: string
  storage_path: string
  page_id: number | null
  page_status: string | null
  page_ocr_confidence: number | null
  page_pdf_page_number: number | null
  page_printed_page_number: number | null
  total_count: number
}

export type ReviewCursor = {
  createdAt: string
  issueId: number
}

export interface ReviewQueryError {
  kind: 'session' | 'permission' | 'query' | 'network' | 'unknown'
  message: string
}

type ErrorShape = {
  status?: number
  code?: string
  message?: string
  details?: string
  hint?: string
}

export function reviewPageOffset(page: number, pageSize: number) {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const safeSize = [25, 50, 100].includes(pageSize) ? pageSize : 50
  return (safePage - 1) * safeSize
}

export function normalizeReviewSearch(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120)
}

export function reviewCursorFromRows(rows: ReviewPageRow[]): ReviewCursor | null {
  const row = rows.at(-1)
  if (!row) return null
  return { createdAt: row.issue_created_at, issueId: row.issue_id }
}

export function classifyReviewError(error: unknown): ReviewQueryError {
  const value = (typeof error === 'object' && error !== null ? error : {}) as ErrorShape
  const message = `${value.message ?? error ?? ''}`.toLowerCase()
  const code = `${value.code ?? ''}`.toUpperCase()
  if (value.status === 401 || code.includes('JWT') || /session|refresh token|jwt.*expired|not authenticated/.test(message)) {
    return { kind: 'session', message: 'Your session has expired. Please sign in again.' }
  }
  if (value.status === 403 || code === '42501' || /permission denied|not authorized|forbidden/.test(message)) {
    return { kind: 'permission', message: 'You do not have permission to view review issues.' }
  }
  if (/failed to fetch|networkerror|network request|load failed/.test(message)) {
    return { kind: 'network', message: 'Network unavailable. Check your connection and try again.' }
  }
  if (value.status === 400 || code.startsWith('PGRST') || code.startsWith('22') || code.startsWith('42')) {
    return { kind: 'query', message: 'Review query failed. Please refresh and try again.' }
  }
  return { kind: 'unknown', message: 'Unable to load review issues right now.' }
}

export function reviewErrorContext(error: unknown, context: Record<string, unknown>) {
  const value = (typeof error === 'object' && error !== null ? error : {}) as ErrorShape
  return {
    context,
    status: value.status ?? null,
    code: value.code ?? null,
    message: value.message ?? String(error),
    details: value.details ?? null,
    hint: value.hint ?? null,
  }
}

