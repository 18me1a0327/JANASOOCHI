import { describe, expect, it } from 'vitest'
import {
  EXPECTED_LOGICAL_VOTER_TOTAL,
  EXPECTED_VOTERS_BY_PART,
  assessSourceEditionCompleteness,
  classifyReviewIssue,
  createAutoResolutionAudit,
  createExpectedLogicalVoters,
  evaluateAutoResolution,
  reconcileEnglishTelugu,
  type ReconciliationRecord,
  type ReviewIssueKind,
} from './index'

const sourceRecord = (
  id: string,
  language: 'en' | 'te',
  serialNumber: number,
  overrides: Partial<ReconciliationRecord> = {},
): ReconciliationRecord => ({
  id,
  language,
  partNumber: 227,
  serialNumber,
  epic: `ABC${serialNumber}`,
  normalizedHouseNumber: '12-a',
  age: 40,
  gender: 'Male',
  ...overrides,
})

describe('canonical logical-voter foundation', () => {
  it('defines the required Part totals and exactly 3,454 unique identities', () => {
    expect(EXPECTED_VOTERS_BY_PART).toEqual({ 227: 1014, 228: 973, 229: 888, 230: 579 })
    expect(EXPECTED_LOGICAL_VOTER_TOTAL).toBe(3454)

    const identities = createExpectedLogicalVoters()
    expect(identities).toHaveLength(3454)
    expect(new Set(identities.map((identity) => identity.key)).size).toBe(3454)
    expect(identities.filter((identity) => identity.partNumber === 227)).toHaveLength(1014)
    expect(identities.filter((identity) => identity.partNumber === 228)).toHaveLength(973)
    expect(identities.filter((identity) => identity.partNumber === 229)).toHaveLength(888)
    expect(identities.filter((identity) => identity.partNumber === 230)).toHaveLength(579)
  })
})

describe('source-edition completeness', () => {
  it('accepts one complete edition without counting language copies as more voters', () => {
    const records = createExpectedLogicalVoters().map((identity) => ({
      id: identity.key,
      partNumber: identity.partNumber,
      serialNumber: identity.serialNumber,
    }))
    const report = assessSourceEditionCompleteness(records, 'en')

    expect(report.expectedLogicalTotal).toBe(3454)
    expect(report.recordCount).toBe(3454)
    expect(report.parts.every((part) => part.isComplete)).toBe(true)
    expect(report.duplicateEpics).toEqual([])
    expect(report.isComplete).toBe(true)
  })

  it('reports missing, duplicate, unexpected, invalid and unsupported records separately', () => {
    const report = assessSourceEditionCompleteness([
      { id: 'one', partNumber: 228, serialNumber: 1, epic: 'ABC 001' },
      { id: 'two-a', partNumber: 228, serialNumber: '002', epic: 'abc-001' },
      { id: 'two-b', partNumber: 228, serialNumber: 2 },
      { id: 'too-high', partNumber: 228, serialNumber: 974 },
      { id: 'invalid', partNumber: 228, serialNumber: null },
      { id: 'unsupported', partNumber: 231, serialNumber: 1 },
    ], 'te')
    const part228 = report.parts.find((part) => part.partNumber === 228)

    expect(part228?.missingSerials).toHaveLength(971)
    expect(part228?.duplicateSerials).toEqual([
      { serialNumber: 2, recordIds: ['two-a', 'two-b'] },
    ])
    expect(part228?.unexpectedSerials).toEqual([
      { serialNumber: 974, recordIds: ['too-high'] },
    ])
    expect(part228?.invalidSerialRecordIds).toEqual(['invalid'])
    expect(report.duplicateEpics).toEqual([
      { normalizedEpic: 'ABC001', recordIds: ['one', 'two-a'] },
    ])
    expect(report.unsupportedPartRecordIds).toEqual(['unsupported'])
    expect(report.isComplete).toBe(false)
  })

  it('never assigns a null source serial to an expected logical slot', () => {
    const report = assessSourceEditionCompleteness([
      { id: 'unknown-source', partNumber: 227, serialNumber: null },
    ], 'en')
    const part227 = report.parts.find((part) => part.partNumber === 227)

    expect(part227?.recordCount).toBe(1)
    expect(part227?.uniqueExpectedSerialCount).toBe(0)
    expect(part227?.missingSerials).toHaveLength(1014)
    expect(part227?.invalidSerialRecordIds).toEqual(['unknown-source'])
  })
})

describe('English–Telugu reconciliation', () => {
  it('uses unique Part + Serial identity and structured evidence, not cross-script names', () => {
    const report = reconcileEnglishTelugu(
      [
        sourceRecord('en-1', 'en', 1, { normalizedName: 'Lakshmi', normalizedRelationName: 'Rama' }),
        sourceRecord('en-2', 'en', 2, { epic: null }),
      ],
      [
        sourceRecord('te-1', 'te', 1, {
          gender: 'M',
          normalizedName: 'లక్ష్మి',
          normalizedRelationName: 'రామ',
        }),
        sourceRecord('te-2', 'te', 2, { epic: null, normalizedHouseNumber: '12-A' }),
      ],
    )

    expect(report.links).toHaveLength(2)
    expect(report.links.every((link) => link.decision === 'verified')).toBe(true)
    expect(report.links[0].supportingNameEvidence).toEqual({
      name: 'mismatch',
      relationName: 'mismatch',
    })
    expect(report.conflicts).toEqual([])
  })

  it('blocks genuine EPIC conflicts and duplicate logical identities', () => {
    const report = reconcileEnglishTelugu(
      [
        sourceRecord('en-1', 'en', 1, { epic: 'ABC1' }),
        sourceRecord('en-2-a', 'en', 2),
        sourceRecord('en-2-b', 'en', 2),
      ],
      [
        sourceRecord('te-1', 'te', 1, { epic: 'DIFFERENT1' }),
        sourceRecord('te-2', 'te', 2),
      ],
    )

    expect(report.links).toEqual([])
    expect(report.conflicts.map((conflict) => conflict.kind).sort()).toEqual([
      'duplicate_identity',
      'epic_conflict',
    ])
    expect(report.unmatchedEnglishRecordIds).toEqual(['en-1', 'en-2-a', 'en-2-b'])
    expect(report.unmatchedTeluguRecordIds).toEqual(['te-1', 'te-2'])
  })

  it('links a unique primary identity but requires review when corroboration is weak', () => {
    const report = reconcileEnglishTelugu(
      [sourceRecord('en-3', 'en', 3, { epic: null, age: null })],
      [sourceRecord('te-3', 'te', 3, { epic: null, age: null, gender: null })],
    )

    expect(report.links).toHaveLength(1)
    expect(report.links[0].decision).toBe('needs_review')
  })
})

describe('review classification and deterministic auto-resolution', () => {
  it('does not turn low OCR confidence into Review when strong evidence agrees', () => {
    expect(classifyReviewIssue({
      kind: 'low_ocr_confidence',
      identityAgreement: 'confirmed',
      structuredAgreement: 'strong',
    })).toEqual({
      severity: 'Informational',
      requiresManualReview: false,
      reason: 'Low OCR confidence is corroborated by the unique identity and strong structured fields.',
    })

    expect(classifyReviewIssue({
      kind: 'low_ocr_confidence',
      identityAgreement: 'uncertain',
      structuredAgreement: 'partial',
    }).severity).toBe('Needs Review')
    expect(classifyReviewIssue({ kind: 'missing_voter' }).severity).toBe('Critical')
  })

  it('permits only evidence-backed, source-preserving auto-resolution', () => {
    const decision = evaluateAutoResolution({
      kind: 'low_ocr_confidence',
      identityAgreement: 'confirmed',
      structuredAgreement: 'strong',
      sourceValuesPreserved: true,
    })
    expect(decision.canAutoResolve).toBe(true)

    const audit = createAutoResolutionAudit(
      decision,
      '2026-09-05T12:00:00.000Z',
      { originalName: 'లక్ష్మి' },
      { verificationStatus: 'verified' },
    )
    expect(audit.originalValues).toEqual({ originalName: 'లక్ష్మి' })
    expect(audit.resultingValues).toEqual({ verificationStatus: 'verified' })
  })

  it.each<ReviewIssueKind>([
    'missing_voter',
    'epic_conflict',
    'duplicate_identity',
    'structural_conflict',
  ])('never auto-resolves %s', (kind) => {
    expect(evaluateAutoResolution({
      kind,
      identityAgreement: 'confirmed',
      structuredAgreement: 'strong',
      deterministicCorrection: true,
      sourceValuesPreserved: true,
    }).canAutoResolve).toBe(false)
  })

  it('also blocks a nominally safe issue when conflict flags are present', () => {
    expect(evaluateAutoResolution({
      kind: 'low_ocr_confidence',
      identityAgreement: 'confirmed',
      structuredAgreement: 'strong',
      sourceValuesPreserved: true,
      hasEpicConflict: true,
    }).canAutoResolve).toBe(false)
  })
})
