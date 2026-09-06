export type IssueSeverity = 'Critical' | 'Needs Review' | 'Informational'

export type ReviewIssueKind =
  | 'missing_voter'
  | 'missing_serial'
  | 'duplicate_serial'
  | 'unexpected_serial'
  | 'epic_conflict'
  | 'duplicate_identity'
  | 'structural_conflict'
  | 'failed_page'
  | 'partial_page'
  | 'field_missing'
  | 'field_uncertain'
  | 'corroboration_mismatch'
  | 'low_ocr_confidence'
  | 'normalization_variance'
  | 'language_unavailable'

export interface ReviewIssueFacts {
  kind: ReviewIssueKind
  identityAgreement?: 'confirmed' | 'uncertain' | 'conflict'
  structuredAgreement?: 'strong' | 'partial' | 'unavailable' | 'conflict'
  deterministicCorrection?: boolean
  sourceValuesPreserved?: boolean
  hasMissingVoter?: boolean
  hasEpicConflict?: boolean
  hasDuplicateIdentity?: boolean
  hasStructuralConflict?: boolean
}

export interface IssueClassification {
  severity: IssueSeverity
  requiresManualReview: boolean
  reason: string
}

export interface AutoResolutionDecision {
  canAutoResolve: boolean
  resolutionType: 'structured_auto_verification' | 'deterministic_normalization' | null
  reason: string
}

export interface AutoResolutionAudit {
  resolutionType: NonNullable<AutoResolutionDecision['resolutionType']>
  reason: string
  resolvedAt: string
  originalValues: Readonly<Record<string, unknown>>
  resultingValues: Readonly<Record<string, unknown>>
}

const CRITICAL_KINDS = new Set<ReviewIssueKind>([
  'missing_voter',
  'missing_serial',
  'duplicate_serial',
  'unexpected_serial',
  'epic_conflict',
  'duplicate_identity',
  'structural_conflict',
  'failed_page',
])

const INFORMATIONAL_KINDS = new Set<ReviewIssueKind>([
  'language_unavailable',
])

const NEVER_AUTO_RESOLVE = new Set<ReviewIssueKind>([
  'missing_voter',
  'missing_serial',
  'duplicate_serial',
  'unexpected_serial',
  'epic_conflict',
  'duplicate_identity',
  'structural_conflict',
  'failed_page',
  'partial_page',
])

export function classifyReviewIssue(issue: ReviewIssueFacts): IssueClassification {
  if (CRITICAL_KINDS.has(issue.kind)) {
    return {
      severity: 'Critical',
      requiresManualReview: true,
      reason: 'This issue can affect voter identity or dataset completeness.',
    }
  }

  if (issue.kind === 'low_ocr_confidence') {
    const safelyCorroborated = issue.identityAgreement === 'confirmed'
      && issue.structuredAgreement === 'strong'
    return safelyCorroborated
      ? {
          severity: 'Informational',
          requiresManualReview: false,
          reason: 'Low OCR confidence is corroborated by the unique identity and strong structured fields.',
        }
      : {
          severity: 'Needs Review',
          requiresManualReview: true,
          reason: 'Low OCR confidence does not have enough independent structured corroboration.',
        }
  }

  if (INFORMATIONAL_KINDS.has(issue.kind)) {
    return {
      severity: 'Informational',
      requiresManualReview: false,
      reason: 'The issue records source-language availability without changing voter identity.',
    }
  }

  return {
    severity: 'Needs Review',
    requiresManualReview: true,
    reason: 'The source or reconciliation result requires a human decision.',
  }
}

export function evaluateAutoResolution(issue: ReviewIssueFacts): AutoResolutionDecision {
  const hasBlockingConflict = issue.hasMissingVoter
    || issue.hasEpicConflict
    || issue.hasDuplicateIdentity
    || issue.hasStructuralConflict
    || issue.identityAgreement === 'conflict'
    || issue.structuredAgreement === 'conflict'

  if (NEVER_AUTO_RESOLVE.has(issue.kind) || hasBlockingConflict) {
    return {
      canAutoResolve: false,
      resolutionType: null,
      reason: 'Missing voters, identity/EPIC conflicts, duplicates, and structural conflicts require manual review.',
    }
  }

  if (
    issue.kind === 'low_ocr_confidence'
    && issue.identityAgreement === 'confirmed'
    && issue.structuredAgreement === 'strong'
    && issue.sourceValuesPreserved === true
  ) {
    return {
      canAutoResolve: true,
      resolutionType: 'structured_auto_verification',
      reason: 'The unique identity and strong structured fields agree; original OCR values remain preserved.',
    }
  }

  if (
    issue.kind === 'normalization_variance'
    && issue.deterministicCorrection === true
    && issue.sourceValuesPreserved === true
    && issue.identityAgreement === 'confirmed'
  ) {
    return {
      canAutoResolve: true,
      resolutionType: 'deterministic_normalization',
      reason: 'A deterministic search normalization can be recorded without overwriting source values.',
    }
  }

  return {
    canAutoResolve: false,
    resolutionType: null,
    reason: 'The evidence is insufficient for deterministic auto-resolution.',
  }
}

export function createAutoResolutionAudit(
  decision: AutoResolutionDecision,
  resolvedAt: string,
  originalValues: Readonly<Record<string, unknown>>,
  resultingValues: Readonly<Record<string, unknown>>,
): AutoResolutionAudit {
  if (!decision.canAutoResolve || !decision.resolutionType) {
    throw new Error('Cannot create an auto-resolution audit for a blocked decision.')
  }
  return {
    resolutionType: decision.resolutionType,
    reason: decision.reason,
    resolvedAt,
    originalValues: { ...originalValues },
    resultingValues: { ...resultingValues },
  }
}
