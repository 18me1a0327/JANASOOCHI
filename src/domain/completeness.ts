import {
  EXPECTED_LOGICAL_VOTER_TOTAL,
  EXPECTED_VOTERS_BY_PART,
  SUPPORTED_PARTS,
  isSupportedPart,
  parseSerialInteger,
  type SourceLanguage,
  type SupportedPart,
} from './model'

export interface SourceSerialRecord {
  id: string
  partNumber: number
  serialNumber: string | number | null
  epic?: string | null
}

export interface SerialOccurrence {
  serialNumber: number
  recordIds: string[]
}

export interface EpicOccurrence {
  normalizedEpic: string
  recordIds: string[]
}

export interface PartCompleteness {
  partNumber: SupportedPart
  expectedCount: number
  recordCount: number
  uniqueExpectedSerialCount: number
  missingSerials: number[]
  duplicateSerials: SerialOccurrence[]
  unexpectedSerials: SerialOccurrence[]
  invalidSerialRecordIds: string[]
  isComplete: boolean
}

export interface SourceEditionCompleteness {
  language: SourceLanguage | null
  expectedLogicalTotal: number
  recordCount: number
  parts: PartCompleteness[]
  duplicateEpics: EpicOccurrence[]
  unsupportedPartRecordIds: string[]
  isComplete: boolean
}

function normalizedEpic(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') ?? ''
  return normalized || null
}

function duplicateEpicOccurrences(records: readonly SourceSerialRecord[]): EpicOccurrence[] {
  const occurrences = new Map<string, string[]>()

  for (const record of records) {
    const epic = normalizedEpic(record.epic)
    if (!epic) continue
    const ids = occurrences.get(epic) ?? []
    ids.push(record.id)
    occurrences.set(epic, ids)
  }

  return [...occurrences.entries()]
    .filter(([, recordIds]) => recordIds.length > 1)
    .map(([normalizedEpicValue, recordIds]) => ({
      normalizedEpic: normalizedEpicValue,
      recordIds: [...recordIds].sort(),
    }))
    .sort((left, right) => left.normalizedEpic.localeCompare(right.normalizedEpic))
}

function occurrencesBySerial(records: SourceSerialRecord[]) {
  const result = new Map<number, string[]>()
  const invalidSerialRecordIds: string[] = []

  for (const record of records) {
    const serial = parseSerialInteger(record.serialNumber)
    if (serial === null) {
      invalidSerialRecordIds.push(record.id)
      continue
    }
    const ids = result.get(serial) ?? []
    ids.push(record.id)
    result.set(serial, ids)
  }

  return { result, invalidSerialRecordIds }
}

function assessPart(partNumber: SupportedPart, records: SourceSerialRecord[]): PartCompleteness {
  const expectedCount = EXPECTED_VOTERS_BY_PART[partNumber]
  const { result: occurrences, invalidSerialRecordIds } = occurrencesBySerial(records)
  const expectedSerials = new Set<number>()
  const duplicateSerials: SerialOccurrence[] = []
  const unexpectedSerials: SerialOccurrence[] = []

  for (const [serialNumber, recordIds] of occurrences) {
    if (serialNumber >= 1 && serialNumber <= expectedCount) {
      expectedSerials.add(serialNumber)
      if (recordIds.length > 1) {
        duplicateSerials.push({ serialNumber, recordIds: [...recordIds].sort() })
      }
    } else {
      unexpectedSerials.push({ serialNumber, recordIds: [...recordIds].sort() })
    }
  }

  const missingSerials = Array.from(
    { length: expectedCount },
    (_, index) => index + 1,
  ).filter((serial) => !expectedSerials.has(serial))

  duplicateSerials.sort((left, right) => left.serialNumber - right.serialNumber)
  unexpectedSerials.sort((left, right) => left.serialNumber - right.serialNumber)
  invalidSerialRecordIds.sort()

  const isComplete = missingSerials.length === 0
    && duplicateSerials.length === 0
    && unexpectedSerials.length === 0
    && invalidSerialRecordIds.length === 0

  return {
    partNumber,
    expectedCount,
    recordCount: records.length,
    uniqueExpectedSerialCount: expectedSerials.size,
    missingSerials,
    duplicateSerials,
    unexpectedSerials,
    invalidSerialRecordIds,
    isComplete,
  }
}

/**
 * Assesses one source-language edition. Callers must not combine English and
 * Telugu copies; each edition is compared independently with the 3,454 logical
 * identities.
 */
export function assessSourceEditionCompleteness(
  records: readonly SourceSerialRecord[],
  language: SourceLanguage | null = null,
): SourceEditionCompleteness {
  const supportedRecords = new Map<SupportedPart, SourceSerialRecord[]>(
    SUPPORTED_PARTS.map((part) => [part, []]),
  )
  const unsupportedPartRecordIds: string[] = []

  for (const record of records) {
    if (!isSupportedPart(record.partNumber)) {
      unsupportedPartRecordIds.push(record.id)
      continue
    }
    supportedRecords.get(record.partNumber)?.push(record)
  }

  const parts = SUPPORTED_PARTS.map((part) => assessPart(part, supportedRecords.get(part) ?? []))
  const duplicateEpics = duplicateEpicOccurrences([...supportedRecords.values()].flat())
  unsupportedPartRecordIds.sort()

  return {
    language,
    expectedLogicalTotal: EXPECTED_LOGICAL_VOTER_TOTAL,
    recordCount: records.length,
    parts,
    duplicateEpics,
    unsupportedPartRecordIds,
    isComplete: unsupportedPartRecordIds.length === 0
      && duplicateEpics.length === 0
      && parts.every((part) => part.isComplete),
  }
}
