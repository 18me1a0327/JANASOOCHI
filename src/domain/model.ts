export const SUPPORTED_PARTS = [227, 228, 229, 230] as const

export type SupportedPart = (typeof SUPPORTED_PARTS)[number]
export type SourceLanguage = 'en' | 'te' | 'ur'

export const EXPECTED_VOTERS_BY_PART: Readonly<Record<SupportedPart, number>> = Object.freeze({
  227: 1014,
  228: 973,
  229: 888,
  230: 579,
})

export const EXPECTED_LOGICAL_VOTER_TOTAL = SUPPORTED_PARTS.reduce(
  (total, part) => total + EXPECTED_VOTERS_BY_PART[part],
  0,
)

export interface LogicalVoterIdentity {
  partNumber: SupportedPart
  serialNumber: number
  key: string
}

export function isSupportedPart(part: number): part is SupportedPart {
  return (SUPPORTED_PARTS as readonly number[]).includes(part)
}

export function parseSerialInteger(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : null
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null
  }
  const parsed = Number(value.trim())
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function canonicalVoterKey(
  part: number,
  serial: string | number | null | undefined,
): string | null {
  if (!isSupportedPart(part)) return null
  const parsedSerial = parseSerialInteger(serial)
  if (
    parsedSerial === null
    || parsedSerial < 1
    || parsedSerial > EXPECTED_VOTERS_BY_PART[part]
  ) {
    return null
  }
  return `${part}:${parsedSerial}`
}

/**
 * Creates the expected canonical slots, not extracted source evidence. A slot
 * must only be linked to a source record when that record itself supplies the
 * same valid Part + Serial; missing/null serials are never assigned by position.
 */
export function createExpectedLogicalVoters(): LogicalVoterIdentity[] {
  return SUPPORTED_PARTS.flatMap((partNumber) =>
    Array.from({ length: EXPECTED_VOTERS_BY_PART[partNumber] }, (_, index) => {
      const serialNumber = index + 1
      return {
        partNumber,
        serialNumber,
        key: `${partNumber}:${serialNumber}`,
      }
    }),
  )
}
