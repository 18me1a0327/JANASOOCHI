'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { invalidateDataCache } from './data'
import { supabase } from './lib'
import { classifyReviewError, reviewErrorContext, reviewPageOffset } from './review'
import type { ReviewCategory, ReviewPageRow } from './review'

type Lang = 'en' | 'te' | 'ur'
const missing = { en: 'Not available in source PDF', te: 'మూల PDFలో అందుబాటులో లేదు', ur: 'ماخذ پی ڈی ایف میں دستیاب نہیں' }
const show = (value: unknown, lang: Lang) => value === null || value === undefined || value === '' ? missing[lang] : String(value)
const categories: { value: ReviewCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'pages', label: 'Pages' },
  { value: 'records', label: 'Records' },
  { value: 'low_confidence', label: 'Low Confidence' },
  { value: 'serial_gaps', label: 'Serial Gaps' },
  { value: 'house_number', label: 'House Number' },
  { value: 'possible_duplicate', label: 'Possible Duplicate' },
  { value: 'language', label: 'Language' },
]

export default function AdvancedReviewPage({ lang }: { lang: Lang }) {
  const router = useRouter()
  const [rows, setRows] = useState<ReviewPageRow[]>([])
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState<ReviewCategory>('all')
  const [part, setPart] = useState('all')
  const [sourceLanguage, setSourceLanguage] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [edit, setEdit] = useState<ReviewPageRow | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const expireSession = useCallback(async () => {
    sessionStorage.setItem('pv-auth-message', 'Your session has expired. Please sign in again.')
    sessionStorage.setItem('pv-return-to', '/review')
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/login')
  }, [router])

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    const queryContext = { page, pageSize, category, part, sourceLanguage }
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) throw { status: 401, code: 'AUTH_SESSION_MISSING', message: sessionError?.message ?? 'Not authenticated' }
      const { data, error: queryError } = await supabase.rpc('get_review_issues_page', {
        p_status: 'open', p_category: category,
        p_language: sourceLanguage === 'all' ? undefined : sourceLanguage,
        p_part: part === 'all' ? undefined : Number(part),
        p_limit: pageSize, p_offset: reviewPageOffset(page, pageSize),
      })
      if (queryError) throw queryError
      const nextRows = (data ?? []) as ReviewPageRow[]
      const nextTotal = Number(nextRows[0]?.total_count ?? 0)
      setRows(nextRows)
      setTotal(nextTotal)
      const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize))
      if (page > lastPage) setPage(lastPage)
    } catch (loadError) {
      const classified = classifyReviewError(loadError)
      console.error('Review page query failed', reviewErrorContext(loadError, queryContext))
      if (classified.kind === 'session') await expireSession()
      else setError(classified.message)
    } finally { setBusy(false) }
  }, [category, expireSession, page, pageSize, part, sourceLanguage])

  useEffect(() => { void load() }, [load])
  function selectCategory(next: ReviewCategory) { setCategory(next); setPage(1) }
  function openEditor(row: ReviewPageRow) {
    setEdit(row)
    setFields({
      original_name: row.corrected_value?.original_name || row.voter_name || '',
      original_relation_name: row.corrected_value?.original_relation_name || row.relation_name || '',
      original_house_number: row.corrected_value?.original_house_number || row.house_number || '',
      age: row.corrected_value?.age || String(row.age ?? ''), gender: row.corrected_value?.gender || row.gender || '',
      epic_number: row.corrected_value?.epic_number || row.epic_number || '',
    })
  }

  async function save(verified: boolean) {
    if (!edit?.voter_id) return
    setBusy(true); setError('')
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw { status: 401, code: 'AUTH_SESSION_MISSING', message: userError?.message ?? 'Not authenticated' }
      const original = { original_name: edit.voter_name, original_relation_name: edit.relation_name, original_house_number: edit.house_number, age: edit.age, gender: edit.gender, epic_number: edit.epic_number }
      const history = await supabase.from('ocr_corrections').insert({ voter_id: edit.voter_id, original_value: original, corrected_value: fields, corrected_by: user.id })
      if (history.error) throw history.error
      const update = await supabase.from('voter_records').update({ corrected_value: fields, corrected_by: user.id, corrected_at: new Date().toISOString(), verification_status: verified ? 'verified' : edit.verification_status ?? 'unverified' }).eq('id', edit.voter_id)
      if (update.error) throw update.error
      const audit = await supabase.from('audit_log').insert({ action: verified ? 'voter_corrected_and_verified' : 'voter_corrected', entity_type: 'voter_record', entity_id: edit.voter_id, metadata: { part_number: edit.part_number, pdf_page_number: edit.voter_pdf_page_number } })
      if (audit.error) throw audit.error
      if (verified) {
        const resolved = await supabase.from('review_issues').update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('voter_id', edit.voter_id).eq('status', 'open')
        if (resolved.error) throw resolved.error
      }
      invalidateDataCache(); setEdit(null); await load()
    } catch (saveError) {
      const classified = classifyReviewError(saveError)
      console.error('Review correction failed', reviewErrorContext(saveError, { voterId: edit.voter_id, verified }))
      if (classified.kind === 'session') await expireSession()
      else setError(classified.kind === 'unknown' ? 'Unable to save correction.' : classified.message)
    } finally { setBusy(false) }
  }

  function source(row: ReviewPageRow) {
    const physicalPage = row.voter_pdf_page_number ?? row.page_pdf_page_number ?? 1
    router.push(`/source/${row.pdf_id}?page=${physicalPage}${row.voter_id ? `&voter=${row.voter_id}` : ''}`)
  }
  const pageOptions = useMemo(() => Array.from({ length: pageCount }, (_, index) => index + 1), [pageCount])

  return <section className="standalone-page">
    <div className="page-title"><div><span className="eyebrow">జనసూచి — JANASOOCHI</span><h1>OCR review queue</h1><p>Page failures, uncertain fields, low-confidence records, source gaps and possible duplicates.</p></div><button className="secondary" disabled={busy} onClick={() => void load()}><RefreshCw />Refresh</button></div>
    <div className="summary-strip"><span>{busy && !rows.length ? 'Loading…' : `${total.toLocaleString()} open issues`}</span><span>Original OCR and source values are always retained.</span></div>
    <div className="review-filters">{categories.map(item => <button key={item.value} className={category === item.value ? 'active' : ''} onClick={() => selectCategory(item.value)}>{item.label}</button>)}</div>
    <div className="review-toolbar">
      <label>Part<select value={part} onChange={event => { setPart(event.target.value); setPage(1) }}><option value="all">All 227–230</option>{[227, 228, 229, 230].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Source language<select value={sourceLanguage} onChange={event => { setSourceLanguage(event.target.value); setPage(1) }}><option value="all">All languages</option><option value="en">English</option><option value="te">తెలుగు</option><option value="ur">اردو</option></select></label>
      <label>Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>{[25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label>
      <span>Page {page} of {pageCount}</span>
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="data-table review-table"><table><thead><tr><th>Issue</th><th>Part</th><th>PDF Page</th><th>Voter</th><th>Confidence</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row => {
      const confidence = row.voter_ocr_confidence ?? row.page_ocr_confidence
      return <tr key={row.issue_id}><td><b>{row.issue_type.replaceAll('_', ' ')}</b><small>{row.issue_detail}</small></td><td>{row.part_number ?? '—'}</td><td>{row.voter_pdf_page_number ?? row.page_pdf_page_number ?? '—'}{(row.voter_printed_page_number ?? row.page_printed_page_number) && <small>Printed {row.voter_printed_page_number ?? row.page_printed_page_number}</small>}</td><td>{show(row.voter_name, lang)}{row.serial_number && <small>Serial {row.serial_number}</small>}</td><td>{confidence === null ? 'Text / unavailable' : `${Number(confidence).toFixed(0)}%`}</td><td><span className="status requires_review">Requires review</span></td><td><div className="row-actions"><button className="secondary compact" onClick={() => source(row)}><ExternalLink />Source</button>{row.voter_id && <button className="primary compact" onClick={() => openEditor(row)}>Review</button>}</div></td></tr>
    })}</tbody></table>{!busy && !rows.length && <p className="empty-row">No open issues in this filter.</p>}</div>
    <div className="pagination review-pagination"><button className="secondary compact" disabled={busy || page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft />Previous</button><label>Page <select value={page} onChange={event => setPage(Number(event.target.value))}>{pageOptions.map(value => <option key={value}>{value}</option>)}</select> of {pageCount}</label><button className="secondary compact" disabled={busy || page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>Next<ChevronRight /></button></div>
    {edit && <div className="modal-backdrop"><section className="review-modal"><header><div><small>Original values remain unchanged</small><h2>Correct OCR fields</h2></div><button className="icon-button" onClick={() => setEdit(null)}><X /></button></header><pre>{edit.original_text}</pre><div className="field-confidence-grid">{Object.entries(edit.field_confidence ?? {}).map(([field, confidence]) => <span key={field}>{field.replaceAll('_', ' ')} <b>{confidence}%</b></span>)}</div><div className="review-grid">{Object.entries({ original_name: 'Name', original_relation_name: 'Relation name', original_house_number: 'House number', age: 'Age', gender: 'Gender', epic_number: 'EPIC' }).map(([key, label]) => <label key={key}>{label}<small>Original: {show(({ original_name: edit.voter_name, original_relation_name: edit.relation_name, original_house_number: edit.house_number, age: edit.age, gender: edit.gender, epic_number: edit.epic_number } as Record<string, unknown>)[key], lang)}</small><input value={fields[key] ?? ''} onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} /></label>)}</div><footer><button className="secondary" disabled={busy} onClick={() => void save(false)}>Save correction</button><button className="primary" disabled={busy} onClick={() => void save(true)}><CheckCircle2 />Save &amp; mark verified</button></footer></section></div>}
  </section>
}
