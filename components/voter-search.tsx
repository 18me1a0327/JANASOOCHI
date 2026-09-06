'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'

import { createClient } from '../lib/supabase/client'
import { useLanguage } from './language-provider'

const PAGE_SIZE = 25

type Filters = {
  part: string
  name: string
  relationName: string
  relationType: string
  house: string
  age: string
  gender: string
  epic: string
  serial: string
  fuzzy: boolean
}

const EMPTY_FILTERS: Filters = {
  part: '', name: '', relationName: '', relationType: '', house: '', age: '',
  gender: '', epic: '', serial: '', fuzzy: true,
}

type SearchRow = {
  id: string
  logical_voter_id: string | null
  document_id: string
  part_number: number
  serial_number: string | null
  voter_name: string | null
  relation_type: string | null
  relation_name: string | null
  house_number: string | null
  age: number | null
  gender: string | null
  epic_number: string | null
  physical_page_number: number
  printed_page_number: number | null
  source_language: 'en' | 'te' | 'ur'
  verification_status: 'verified' | 'requires_review' | 'unverified'
  ocr_confidence: number | null
  match_score: number | null
  total_count: number | string
}

type RpcResult = { data: unknown; error: { message: string; code?: string } | null }

export function VoterSearch() {
  const { language, t } = useLanguage()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<Filters | null>(null)
  const [rows, setRows] = useState<SearchRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== 'fuzzy' && Boolean(value)).length,
    [filters],
  )
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  async function runSearch(nextFilters: Filters, nextPage = 1) {
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const response = await supabase.rpc(
        'search_source_records_page' as never,
        {
          p_part: nextFilters.part ? Number(nextFilters.part) : null,
          p_language: language,
          p_name: nextFilters.name.trim() || null,
          p_relation_name: nextFilters.relationName.trim() || null,
          p_relation_type: nextFilters.relationType || null,
          p_house_number: nextFilters.house.trim() || null,
          p_age: nextFilters.age ? Number(nextFilters.age) : null,
          p_gender: nextFilters.gender || null,
          p_epic: nextFilters.epic.trim().toUpperCase() || null,
          p_serial: nextFilters.serial.trim() || null,
          p_fuzzy: nextFilters.fuzzy,
          p_limit: PAGE_SIZE,
          p_offset: (nextPage - 1) * PAGE_SIZE,
        } as never,
      ) as RpcResult
      if (response.error) throw response.error
      const result = (response.data ?? []) as SearchRow[]
      setRows(result)
      setTotal(Number(result[0]?.total_count ?? 0))
      setApplied(nextFilters)
      setPage(nextPage)
    } catch (searchError) {
      console.error('Voter search failed', searchError)
      setRows([])
      setTotal(0)
      setError(t('searchFailed'))
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runSearch(filters, 1)
  }

  function clear() {
    setFilters(EMPTY_FILTERS)
    setApplied(null)
    setRows([])
    setPage(1)
    setTotal(0)
    setError('')
  }

  const display = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? t('notAvailable') : String(value)

  return (
    <>
      <section className="surface-panel">
        <form className="search-form" onSubmit={submit}>
          <div className="filter-heading">
            <span><SlidersHorizontal aria-hidden="true" />{activeCount} active</span>
            <div className="search-help"><span>{t('exactMatchHelp')}</span><span>{t('fuzzyMatchHelp')}</span></div>
          </div>
          <div className="filter-grid">
            <label><span>{t('sourceLanguage')}</span><select value={language} disabled><option value={language}>{language === 'en' ? t('englishSource') : language === 'te' ? t('teluguSource') : t('urduSource')}</option></select></label>
            <label><span>{t('part')}</span><select value={filters.part} onChange={(event) => update('part', event.target.value)}><option value="">{t('allSupportedParts')}</option><option>227</option><option>228</option><option>229</option><option>230</option></select></label>
            <label className="span-two"><span>{t('name')}</span><input value={filters.name} onChange={(event) => update('name', event.target.value)} autoComplete="off" /></label>
            <label className="span-two"><span>{t('relationName')}</span><input value={filters.relationName} onChange={(event) => update('relationName', event.target.value)} autoComplete="off" /></label>
            <label><span>{t('relationType')}</span><select value={filters.relationType} onChange={(event) => update('relationType', event.target.value)}><option value="">{t('allRelationTypes')}</option><option value="Father">{t('father')}</option><option value="Mother">{t('mother')}</option><option value="Husband">{t('husband')}</option><option value="Guardian">{t('guardian')}</option><option value="Other">{t('other')}</option><option value="Unknown">{t('unknown')}</option></select></label>
            <label><span>{t('houseNumber')}</span><input value={filters.house} onChange={(event) => update('house', event.target.value)} autoComplete="off" /></label>
            <label><span>{t('age')}</span><input type="number" min="18" max="125" value={filters.age} onChange={(event) => update('age', event.target.value)} /></label>
            <label><span>{t('gender')}</span><select value={filters.gender} onChange={(event) => update('gender', event.target.value)}><option value="">{t('allGenders')}</option><option value="Male">{t('male')}</option><option value="Female">{t('female')}</option><option value="Third Gender">{t('thirdGender')}</option></select></label>
            <label><span>{t('epic')}</span><input value={filters.epic} onChange={(event) => update('epic', event.target.value.toUpperCase())} autoCapitalize="characters" /></label>
            <label><span>{t('serial')}</span><input inputMode="numeric" value={filters.serial} onChange={(event) => update('serial', event.target.value.replace(/\D/g, ''))} /></label>
          </div>
          <label className="fuzzy-toggle"><input type="checkbox" checked={filters.fuzzy} onChange={(event) => update('fuzzy', event.target.checked)} /><span>{t('fuzzyMatchHelp')}</span></label>
          <div className="form-actions">
            <button className="button secondary" type="button" onClick={clear}><RotateCcw aria-hidden="true" />{t('clearFilters')}</button>
            <button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Search aria-hidden="true" />}{t('searchButton')}</button>
          </div>
        </form>
      </section>

      {applied?.house && !applied.name && !applied.relationName && !applied.age && !applied.gender && !applied.epic && !applied.serial && (
        <p className="inline-notice house-results-heading">{t('houseResults')} {applied.house}</p>
      )}
      {error && <p className="error-notice" role="alert">{error}</p>}

      <section className="surface-panel">
        <div className="panel-header"><div><h2>{t('searchResults')}</h2><p>{t('resultLanguageRule')}</p></div><span className="panel-meta">{total.toLocaleString('en-IN')}</span></div>
        {busy ? <div className="loading-state"><LoaderCircle className="spin" aria-hidden="true" /><span>{t('loading')}</span></div> : rows.length ? (
          <>
            <div className="data-table-wrap">
              <table className="results-table">
                <thead><tr><th>{t('serial')}</th><th>{t('name')}</th><th>{t('relationName')}</th><th>{t('houseNumber')}</th><th>{t('age')}</th><th>{t('gender')}</th><th>{t('epic')}</th><th>{t('part')}</th><th>{t('pdfPage')}</th><th>{t('printedPage')}</th><th>{t('verification')}</th><th>{t('matchScore')}</th><th>{t('action')}</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.id}>
                    <td>{display(row.serial_number)}</td>
                    <td><strong>{display(row.voter_name)}</strong></td>
                    <td><span className="relation-value">{row.relation_type ? `${row.relation_type}: ` : ''}{display(row.relation_name)}</span></td>
                    <td>{display(row.house_number)}</td><td>{display(row.age)}</td><td>{display(row.gender)}</td><td>{display(row.epic_number)}</td><td>{row.part_number}</td><td>{row.physical_page_number}</td><td>{display(row.printed_page_number)}</td>
                    <td><span className={`status-badge ${row.verification_status}`}>{row.verification_status === 'requires_review' ? t('requiresVerification') : row.verification_status}</span></td>
                    <td>{row.match_score === null ? '—' : `${Math.round(Number(row.match_score))}%`}</td>
                    <td><Link className="button secondary small" href={`/source/${row.document_id}?page=${row.physical_page_number}&voterId=${row.id}`}><ExternalLink aria-hidden="true" />{t('viewOriginalPage')}</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <nav className="table-pagination" aria-label="Search result pages">
              <button className="button secondary small" type="button" disabled={page <= 1 || busy} onClick={() => applied && void runSearch(applied, page - 1)}><ChevronLeft aria-hidden="true" />{t('previous')}</button>
              <span>{t('page')} {page.toLocaleString('en-IN')} {t('of')} {pageCount.toLocaleString('en-IN')}</span>
              <button className="button secondary small" type="button" disabled={page >= pageCount || busy} onClick={() => applied && void runSearch(applied, page + 1)}>{t('next')}<ChevronRight aria-hidden="true" /></button>
            </nav>
          </>
        ) : applied ? <div className="empty-state"><h3>{t('noMatching')}</h3></div> : <div className="empty-state"><h3>{t('noResultsTitle')}</h3><p>{t('noResultsText')}</p></div>}
      </section>
    </>
  )
}
