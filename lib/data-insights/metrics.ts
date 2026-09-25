export const EXPECTED_PART_TOTALS = { 227: 1014, 228: 973, 229: 888, 230: 579 } as const
export const EXPECTED_LOGICAL_TOTAL = Object.values(EXPECTED_PART_TOTALS).reduce((total, value) => total + value, 0)

export type GenderGroup = 'male' | 'female' | 'other' | 'unknown'
export type AgeGroup = '18_25' | '26_35' | '36_45' | '46_60' | '61_75' | '76_plus' | 'unknown_invalid'

export type CanonicalAnalyticsRow = {
  logicalVoterId: string
  partNumber: number
  age: number | null
  gender: string | null
  houseNumber: string | null
  epic: string | null
}

const MALE_VALUES = new Set(['m', 'male', 'man', 'పురుషుడు', 'పురుషులు'])
const FEMALE_VALUES = new Set(['f', 'female', 'woman', 'స్త్రీ', 'మహిళ'])
const OTHER_VALUES = new Set(['other', 'third gender', 'transgender', 't', 'ఇతరులు', 'తృతీయ లింగం'])

export function normalizeGender(value: string | null | undefined): GenderGroup {
  const normalized = value?.trim().toLocaleLowerCase() ?? ''
  if (MALE_VALUES.has(normalized)) return 'male'
  if (FEMALE_VALUES.has(normalized)) return 'female'
  if (OTHER_VALUES.has(normalized)) return 'other'
  return 'unknown'
}

export function ageGroup(value: number | null | undefined): AgeGroup {
  if (!Number.isInteger(value) || value === null || value === undefined || value < 18 || value > 125) return 'unknown_invalid'
  if (value <= 25) return '18_25'
  if (value <= 35) return '26_35'
  if (value <= 45) return '36_45'
  if (value <= 60) return '46_60'
  if (value <= 75) return '61_75'
  return '76_plus'
}

export function normalizeHouseNumber(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase().replace(/\s+/g, '') ?? ''
  return normalized || null
}

export function safePercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return Math.round(value / total * 1000) / 10
}

export function filterCanonicalRows(
  rows: CanonicalAnalyticsRow[],
  filters: { partNumber?: number; gender?: GenderGroup | 'other_unknown'; age?: AgeGroup },
) {
  return rows.filter((row) => {
    const gender = normalizeGender(row.gender)
    return (!filters.partNumber || row.partNumber === filters.partNumber)
      && (!filters.gender || gender === filters.gender || (filters.gender === 'other_unknown' && (gender === 'other' || gender === 'unknown')))
      && (!filters.age || ageGroup(row.age) === filters.age)
  })
}

export function hasComparableRevision(revisionCount: number) {
  return Number.isFinite(revisionCount) && revisionCount > 1
}

export function aggregateCanonicalRows(rows: CanonicalAnalyticsRow[]) {
  const unique = new Map<string, CanonicalAnalyticsRow>()
  for (const row of rows) if (!unique.has(row.logicalVoterId)) unique.set(row.logicalVoterId, row)
  const canonical = [...unique.values()]
  const validAges = canonical.map((row) => row.age).filter((value): value is number => ageGroup(value) !== 'unknown_invalid')
  const houseGroups = new Set(canonical.flatMap((row) => {
    const house = normalizeHouseNumber(row.houseNumber)
    return house ? [`${row.partNumber}:${house}`] : []
  }))
  const epicCounts = new Map<string, number>()
  for (const row of canonical) {
    const epic = row.epic?.trim().toUpperCase()
    if (epic) epicCounts.set(epic, (epicCounts.get(epic) ?? 0) + 1)
  }
  return {
    total: canonical.length,
    male: canonical.filter((row) => normalizeGender(row.gender) === 'male').length,
    female: canonical.filter((row) => normalizeGender(row.gender) === 'female').length,
    other: canonical.filter((row) => normalizeGender(row.gender) === 'other').length,
    unknownGender: canonical.filter((row) => normalizeGender(row.gender) === 'unknown').length,
    validAgeCount: validAges.length,
    unknownInvalidAge: canonical.length - validAges.length,
    averageAge: validAges.length ? validAges.reduce((sum, age) => sum + age, 0) / validAges.length : null,
    houseGroups: houseGroups.size,
    duplicateEpicGroups: [...epicCounts.values()].filter((count) => count > 1).length,
  }
}

