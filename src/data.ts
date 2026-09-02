import { normalizeHouse, rankVoter } from './core'
import { supabase } from './lib'
import type { DocumentRow, Filters, LanguageCoverage, PageRow, RecordLanguage, SearchHit, Voter } from './types'

const PAGE_SIZE = 1000
const voterCache=new Map<string,{records:Voter[];at:number}>()
const voterInFlight=new Map<string,Promise<Voter[]>>()
export function invalidateDataCache(){voterCache.clear();voterInFlight.clear()}

function safeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export async function searchVoters(filters: Filters) {
  const activeDocuments = await fetchDocuments(undefined, { activeOnly: true })
  const activeIds = activeDocuments
    .filter((document) => filters.part === 'all' || document.part_number === Number(filters.part))
    .map((document) => document.id)
  if (!activeIds.length) return []
  const records: Voter[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('voter_records')
      .select('*')
      .in('part_number', [227, 228, 229, 230])
      .in('pdf_id', activeIds)
      .in('original_language', ['en', 'te', 'ur'])
      .order('part_number')
      .order('serial_number', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1)

    if (filters.part !== 'all') query = query.eq('part_number', Number(filters.part))
    if (filters.selectedLanguageOnly) query = query.eq('original_language', filters.recordLanguage)
    if (filters.house) query = query.eq('normalized_house_number', normalizeHouse(filters.house))
    if (filters.age) query = query.gte('age', Number(filters.age) - filters.ageTolerance).lte('age', Number(filters.age) + filters.ageTolerance)
    if (filters.gender) query = query.ilike('gender', safeLike(filters.gender))
    if (filters.epic) query = query.ilike('epic_number', safeLike(filters.epic))
    if (filters.serial) query = query.eq('serial_number', filters.serial.trim())

    const { data, error } = await query
    if (error) throw error
    records.push(...(data as Voter[]))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }

  const hasCriteria=Boolean(filters.name||filters.father||filters.husband||filters.mother||filters.house||filters.age||filters.gender||filters.epic||filters.serial)
  return records
    .map((record):SearchHit|null=>{const ranked=rankVoter(record,filters);return ranked?{record,matchScore:hasCriteria?ranked.score:null,matchType:hasCriteria?ranked.matchType:null,explanation:ranked.explanation}:null})
    .filter((result):result is SearchHit=>Boolean(result))
    .sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0))
}

export async function fetchDocuments(ids?: string[], options:{activeOnly?:boolean}={}) {
  if (ids && ids.length === 0) return []
  let query = supabase
    .from('uploaded_pdfs')
    .select('*')
    .in('part_number', [227, 228, 229, 230])
    .order('part_number')

  if (ids) query = query.in('id', ids)
  if (options.activeOnly) query = query.eq('active_version', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as DocumentRow[]
}

export async function fetchAllVoters(part: string = 'all', recordLanguage?: RecordLanguage) {
  const key=`${part}:${recordLanguage ?? 'all'}`
  const cached=voterCache.get(key);if(cached&&Date.now()-cached.at<300000)return cached.records
  const active=voterInFlight.get(key);if(active)return active
  const request=searchVoters({
    part,
    name: '',
    father: '',
    husband: '',
    mother: '',
    house: '',
    age: '',
    gender: '',
    epic: '',
    serial: '',
    fuzzy: false,
    ageTolerance: 0,
    recordLanguage: recordLanguage ?? 'en',
    selectedLanguageOnly: Boolean(recordLanguage),
  }).then(results=>{const records=results.map(({record})=>record);voterCache.set(key,{records,at:Date.now()});return records}).finally(()=>voterInFlight.delete(key))
  voterInFlight.set(key,request);return request
}

export async function fetchLanguageCoverage(part: string = 'all') {
  const { data, error } = await supabase.rpc('voter_language_coverage', {
    p_part: part === 'all' ? undefined : Number(part),
  })
  if (error) throw error
  return ((data ?? []) as LanguageCoverage[]).map((row) => ({
    ...row,
    logical_total: Number(row.logical_total),
    source_records: Number(row.source_records),
    linked_records: Number(row.linked_records),
    unlinked_records: Number(row.unlinked_records),
    unavailable_records: Number(row.unavailable_records),
  }))
}

export async function fetchLogicalSources(logicalVoterId: string) {
  const activeDocuments = await fetchDocuments(undefined, { activeOnly: true })
  const activeIds = activeDocuments.map((document) => document.id)
  if (!activeIds.length) return { records: [] as Voter[], documents: activeDocuments }
  const { data, error } = await supabase
    .from('voter_records')
    .select('*')
    .eq('logical_voter_id', logicalVoterId)
    .in('pdf_id', activeIds)
    .in('original_language', ['en', 'te', 'ur'])
  if (error) throw error
  return { records: (data ?? []) as Voter[], documents: activeDocuments }
}

export async function fetchProcessingPages(){
 const rows:PageRow[]=[]
 for(let from=0;;from+=PAGE_SIZE){const{data,error}=await supabase.from('page_processing').select('*').order('pdf_id').order('pdf_page_number').range(from,from+PAGE_SIZE-1);if(error)throw error;rows.push(...((data??[])as PageRow[]));if((data?.length??0)<PAGE_SIZE)break}
 return rows
}
