import {
  canonicalVoterKey,
  type SourceLanguage,
} from './model'

export interface ReconciliationRecord {
  id: string
  language: SourceLanguage
  partNumber: number
  serialNumber: string | number | null
  epic: string | null
  normalizedHouseNumber: string | null
  age: number | null
  gender: string | null
  normalizedName?: string | null
  normalizedRelationName?: string | null
}

export type EvidenceResult = 'match' | 'mismatch' | 'unavailable'

export interface StructuredEvidence {
  epic: EvidenceResult
  houseNumber: EvidenceResult
  age: EvidenceResult
  gender: EvidenceResult
}

export interface SupportingNameEvidence {
  name: EvidenceResult
  relationName: EvidenceResult
}

export interface ReconciliationLink {
  canonicalKey: string
  englishRecordId: string
  teluguRecordId: string
  evidence: StructuredEvidence
  supportingNameEvidence: SupportingNameEvidence
  decision: 'verified' | 'needs_review'
  reason: string
}

export interface ReconciliationConflict {
  kind: 'duplicate_identity' | 'epic_conflict' | 'structural_conflict'
  canonicalKey: string | null
  recordIds: string[]
  reason: string
}

export interface ReconciliationReport {
  links: ReconciliationLink[]
  conflicts: ReconciliationConflict[]
  unmatchedEnglishRecordIds: string[]
  unmatchedTeluguRecordIds: string[]
}

function normalizedValue(value: string | null): string | null {
  const normalized = value?.trim().toLocaleLowerCase('en').replace(/\s+/g, '') ?? ''
  return normalized || null
}

function normalizedEpic(value: string | null): string | null {
  const normalized = value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') ?? ''
  return normalized || null
}

function normalizedGender(value: string | null): string | null {
  const normalized = value?.trim().toLocaleLowerCase('en') ?? ''
  if (['m', 'male'].includes(normalized)) return 'male'
  if (['f', 'female'].includes(normalized)) return 'female'
  if (['o', 'other', 'third gender'].includes(normalized)) return 'other'
  return normalized || null
}

function compareValues<T>(left: T | null, right: T | null): EvidenceResult {
  if (left === null || right === null) return 'unavailable'
  return left === right ? 'match' : 'mismatch'
}

function structuredEvidence(
  english: ReconciliationRecord,
  telugu: ReconciliationRecord,
): StructuredEvidence {
  return {
    epic: compareValues(normalizedEpic(english.epic), normalizedEpic(telugu.epic)),
    houseNumber: compareValues(
      normalizedValue(english.normalizedHouseNumber),
      normalizedValue(telugu.normalizedHouseNumber),
    ),
    age: compareValues(english.age, telugu.age),
    gender: compareValues(normalizedGender(english.gender), normalizedGender(telugu.gender)),
  }
}

function supportingNameEvidence(
  english: ReconciliationRecord,
  telugu: ReconciliationRecord,
): SupportingNameEvidence {
  return {
    name: compareValues(
      normalizedValue(english.normalizedName ?? null),
      normalizedValue(telugu.normalizedName ?? null),
    ),
    relationName: compareValues(
      normalizedValue(english.normalizedRelationName ?? null),
      normalizedValue(telugu.normalizedRelationName ?? null),
    ),
  }
}

interface LanguageIndex {
  unique: Map<string, ReconciliationRecord>
  duplicateKeys: Map<string, ReconciliationRecord[]>
  invalid: ReconciliationRecord[]
  wrongLanguage: ReconciliationRecord[]
}

function indexLanguage(
  records: readonly ReconciliationRecord[],
  expectedLanguage: 'en' | 'te',
): LanguageIndex {
  const groups = new Map<string, ReconciliationRecord[]>()
  const invalid: ReconciliationRecord[] = []
  const wrongLanguage: ReconciliationRecord[] = []

  for (const record of records) {
    if (record.language !== expectedLanguage) {
      wrongLanguage.push(record)
      continue
    }
    const key = canonicalVoterKey(record.partNumber, record.serialNumber)
    if (!key) {
      invalid.push(record)
      continue
    }
    const group = groups.get(key) ?? []
    group.push(record)
    groups.set(key, group)
  }

  const unique = new Map<string, ReconciliationRecord>()
  const duplicateKeys = new Map<string, ReconciliationRecord[]>()
  for (const [key, group] of groups) {
    if (group.length === 1) unique.set(key, group[0])
    else duplicateKeys.set(key, group)
  }

  return { unique, duplicateKeys, invalid, wrongLanguage }
}

/**
 * Reconciles language editions by Part + Serial only. Names are intentionally
 * absent from the evidence model because literal comparison across scripts is
 * not an identity rule.
 */
export function reconcileEnglishTelugu(
  englishRecords: readonly ReconciliationRecord[],
  teluguRecords: readonly ReconciliationRecord[],
): ReconciliationReport {
  const english = indexLanguage(englishRecords, 'en')
  const telugu = indexLanguage(teluguRecords, 'te')
  const links: ReconciliationLink[] = []
  const conflicts: ReconciliationConflict[] = []
  const unmatchedEnglish = new Set<string>()
  const unmatchedTelugu = new Set<string>()

  for (const [canonicalKey, records] of english.duplicateKeys) {
    records.forEach((record) => unmatchedEnglish.add(record.id))
    conflicts.push({
      kind: 'duplicate_identity',
      canonicalKey,
      recordIds: records.map((record) => record.id).sort(),
      reason: 'Multiple English records claim the same Part + Serial identity.',
    })
  }
  for (const [canonicalKey, records] of telugu.duplicateKeys) {
    records.forEach((record) => unmatchedTelugu.add(record.id))
    conflicts.push({
      kind: 'duplicate_identity',
      canonicalKey,
      recordIds: records.map((record) => record.id).sort(),
      reason: 'Multiple Telugu records claim the same Part + Serial identity.',
    })
  }

  for (const record of [...english.invalid, ...english.wrongLanguage]) {
    unmatchedEnglish.add(record.id)
    conflicts.push({
      kind: 'structural_conflict',
      canonicalKey: null,
      recordIds: [record.id],
      reason: record.language === 'en'
        ? 'English record has an invalid or out-of-range Part + Serial identity.'
        : 'Record was supplied to the English edition with a different source language.',
    })
  }
  for (const record of [...telugu.invalid, ...telugu.wrongLanguage]) {
    unmatchedTelugu.add(record.id)
    conflicts.push({
      kind: 'structural_conflict',
      canonicalKey: null,
      recordIds: [record.id],
      reason: record.language === 'te'
        ? 'Telugu record has an invalid or out-of-range Part + Serial identity.'
        : 'Record was supplied to the Telugu edition with a different source language.',
    })
  }

  for (const [canonicalKey, englishRecord] of english.unique) {
    if (telugu.duplicateKeys.has(canonicalKey)) {
      unmatchedEnglish.add(englishRecord.id)
      continue
    }
    const teluguRecord = telugu.unique.get(canonicalKey)
    if (!teluguRecord) {
      unmatchedEnglish.add(englishRecord.id)
      continue
    }

    const evidence = structuredEvidence(englishRecord, teluguRecord)
    const nameEvidence = supportingNameEvidence(englishRecord, teluguRecord)
    if (evidence.epic === 'mismatch') {
      unmatchedEnglish.add(englishRecord.id)
      unmatchedTelugu.add(teluguRecord.id)
      conflicts.push({
        kind: 'epic_conflict',
        canonicalKey,
        recordIds: [englishRecord.id, teluguRecord.id].sort(),
        reason: 'Part + Serial agree, but both source records contain different EPIC values.',
      })
      continue
    }

    const secondaryEvidence = [evidence.houseNumber, evidence.age, evidence.gender]
    const matchingSecondaryFields = secondaryEvidence.filter((value) => value === 'match').length
    const mismatchingFields = Object.values(evidence).filter((value) => value === 'mismatch').length
    const verified = mismatchingFields === 0
      && (evidence.epic === 'match' || matchingSecondaryFields >= 2)

    links.push({
      canonicalKey,
      englishRecordId: englishRecord.id,
      teluguRecordId: teluguRecord.id,
      evidence,
      supportingNameEvidence: nameEvidence,
      decision: verified ? 'verified' : 'needs_review',
      reason: verified
        ? 'Unique Part + Serial identity is corroborated by strong structured fields.'
        : 'Unique Part + Serial identity matched, but structured corroboration is incomplete or inconsistent.',
    })
  }

  for (const [canonicalKey, teluguRecord] of telugu.unique) {
    if (english.duplicateKeys.has(canonicalKey) || !english.unique.has(canonicalKey)) {
      unmatchedTelugu.add(teluguRecord.id)
    }
  }

  links.sort((left, right) => left.canonicalKey.localeCompare(right.canonicalKey, 'en', { numeric: true }))
  conflicts.sort((left, right) =>
    (left.canonicalKey ?? '').localeCompare(right.canonicalKey ?? '', 'en', { numeric: true })
    || left.kind.localeCompare(right.kind),
  )

  return {
    links,
    conflicts,
    unmatchedEnglishRecordIds: [...unmatchedEnglish].sort(),
    unmatchedTeluguRecordIds: [...unmatchedTelugu].sort(),
  }
}
