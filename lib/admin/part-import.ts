export type PartImportRow = {
  part_number: number
  expected_voter_total: number
  expected_serial_start: number
  expected_serial_end: number
  polling_station_name: string | null
  polling_station_address: string | null
}

export type PartImportParseResult = {
  rows: PartImportRow[]
  errors: string[]
}

const REQUIRED = ['part_number', 'expected_voter_total'] as const
const OPTIONAL = ['expected_serial_start', 'expected_serial_end', 'polling_station_name', 'polling_station_address'] as const
export const PART_IMPORT_COLUMNS = [...REQUIRED, ...OPTIONAL] as const
export const PART_IMPORT_MAX_ROWS = 500

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { current += '"'; index += 1 }
      else if (char === '"') quoted = false
      else current += char
    } else if (char === '"') quoted = true
    else if (char === ',') { cells.push(current); current = '' }
    else current += char
  }
  cells.push(current)
  return { cells: cells.map((cell) => cell.trim()), unterminated: quoted }
}

function parseWholeNumber(value: string | undefined) {
  if (value === undefined || !/^\d{1,5}$/.test(value)) return null
  return Number(value)
}

export function parsePartImportCsv(text: string): PartImportParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line, index) => ({ line, number: index + 1 })).filter(({ line }) => line.trim())
  if (!lines.length) return { rows: [], errors: ['Paste a CSV with a header row and at least one Part.'] }

  const header = splitCsvLine(lines[0].line).cells.map((cell) => cell.toLowerCase())
  const errors: string[] = []
  for (const column of REQUIRED) if (!header.includes(column)) errors.push(`Missing required column "${column}".`)
  const unknown = header.filter((column) => !(PART_IMPORT_COLUMNS as readonly string[]).includes(column))
  if (unknown.length) errors.push(`Unknown column(s): ${unknown.join(', ')}.`)
  if (errors.length) return { rows: [], errors }

  const body = lines.slice(1)
  if (!body.length) return { rows: [], errors: ['The CSV has no Part rows.'] }
  if (body.length > PART_IMPORT_MAX_ROWS) return { rows: [], errors: [`Import at most ${PART_IMPORT_MAX_ROWS} Parts at a time.`] }

  const rows: PartImportRow[] = []
  const seen = new Set<number>()
  for (const { line, number } of body) {
    const { cells, unterminated } = splitCsvLine(line)
    if (unterminated) { errors.push(`Line ${number}: unterminated quoted value.`); continue }
    const value = (column: string) => {
      const cell = cells[header.indexOf(column)]
      return cell === undefined || cell === '' ? undefined : cell
    }
    const part = parseWholeNumber(value('part_number'))
    const total = parseWholeNumber(value('expected_voter_total'))
    const start = value('expected_serial_start') === undefined ? 1 : parseWholeNumber(value('expected_serial_start'))
    if (part === null || part < 1 || part > 9999) { errors.push(`Line ${number}: Part number must be between 1 and 9999.`); continue }
    if (total === null || total < 1) { errors.push(`Line ${number}: expected voter total must be a positive whole number.`); continue }
    if (start === null || start < 1) { errors.push(`Line ${number}: serial start must be a positive whole number.`); continue }
    const end = start + total - 1
    const declaredEnd = value('expected_serial_end')
    if (declaredEnd !== undefined && parseWholeNumber(declaredEnd) !== end) { errors.push(`Line ${number}: serial end ${declaredEnd} does not match ${total} voters starting at ${start} (expected ${end}).`); continue }
    if (seen.has(part)) { errors.push(`Line ${number}: Part ${part} is listed more than once.`); continue }
    seen.add(part)
    const name = value('polling_station_name') ?? null
    const address = value('polling_station_address') ?? null
    if ((name?.length ?? 0) > 300 || (address?.length ?? 0) > 500) { errors.push(`Line ${number}: polling station text is too long.`); continue }
    rows.push({ part_number: part, expected_voter_total: total, expected_serial_start: start, expected_serial_end: end, polling_station_name: name, polling_station_address: address })
  }
  return { rows: errors.length ? [] : rows, errors }
}
