import { describe, expect, it } from 'vitest'

import { parsePartImportCsv } from './part-import'

describe('parsePartImportCsv', () => {
  it('parses verified Part rows and derives the serial range', () => {
    const result = parsePartImportCsv('part_number,expected_voter_total,polling_station_name\r\n517,812,"Z.P.H. School, Room 2"\n518,90,\n')
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { part_number: 517, expected_voter_total: 812, expected_serial_start: 1, expected_serial_end: 812, polling_station_name: 'Z.P.H. School, Room 2', polling_station_address: null },
      { part_number: 518, expected_voter_total: 90, expected_serial_start: 1, expected_serial_end: 90, polling_station_name: null, polling_station_address: null },
    ])
  })

  it('rejects missing columns, duplicates and inconsistent serial ranges', () => {
    expect(parsePartImportCsv('part_number\n1').errors[0]).toContain('expected_voter_total')
    const result = parsePartImportCsv('part_number,expected_voter_total,expected_serial_end\n10,5,5\n10,5,5\n11,5,9')
    expect(result.rows).toEqual([])
    expect(result.errors).toEqual([
      'Line 3: Part 10 is listed more than once.',
      'Line 4: serial end 9 does not match 5 voters starting at 1 (expected 5).',
    ])
  })

  it('rejects non-numeric and out-of-range Part numbers', () => {
    expect(parsePartImportCsv('part_number,expected_voter_total\nabc,5').errors).toEqual(['Line 2: Part number must be between 1 and 9999.'])
    expect(parsePartImportCsv('part_number,expected_voter_total\n10000,5').errors).toEqual(['Line 2: Part number must be between 1 and 9999.'])
    expect(parsePartImportCsv('part_number,expected_voter_total\n5,0').errors).toEqual(['Line 2: expected voter total must be a positive whole number.'])
  })

  it('rejects unknown columns', () => {
    expect(parsePartImportCsv('part_number,expected_voter_total,voter_name\n1,1,x').errors).toEqual(['Unknown column(s): voter_name.'])
  })
})
