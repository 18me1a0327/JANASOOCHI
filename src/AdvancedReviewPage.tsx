'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { invalidateDataCache } from './data'
import { supabase } from './lib'
import { classifyReviewError, normalizeReviewSearch, reviewCursorFromRows, reviewErrorContext } from './review'
import type { ReviewCategory, ReviewCursor, ReviewPageRow } from './review'

type Lang = 'en' | 'te' | 'ur'
type ReviewStatus = 'all' | 'open' | 'resolved' | 'dismissed'
type ReviewSeverity = 'all' | 'critical' | 'needs_review' | 'informational'

const missing = { en: 'Not available in source PDF', te: 'మూల PDFలో అందుబాటులో లేదు', ur: 'ماخذ پی ڈی ایف میں دستیاب نہیں' }
const show = (value: unknown, lang: Lang) => value === null || value === undefined || value === '' ? missing[lang] : String(value)

const COPY = {
  en: { title: 'OCR review queue', lead: 'Page failures, uncertain fields, source gaps and structural conflicts.', refresh: 'Refresh', issues: 'issues', retained: 'Original OCR and source values are always retained.', search: 'Search Review issues', searchHint: 'Name, relation, house, EPIC, serial, issue or filename', clear: 'Clear', part: 'Part', source: 'Source language', status: 'Status', severity: 'Severity', rows: 'Rows per page', page: 'Page', of: 'of', previous: 'Previous', next: 'Next', noRows: 'No Review issues match these filters.', issue: 'Issue', pdfPage: 'PDF Page', voter: 'Voter', confidence: 'Confidence', action: 'Action', openSource: 'Source', review: 'Review', original: 'Original values remain unchanged', correct: 'Correct OCR fields', reason: 'Correction reason', reasonHint: 'Describe what was checked against the source page', save: 'Save correction', verify: 'Save & mark verified', reasonRequired: 'Enter a correction reason before saving.', all: 'All', languages: 'All languages' },
  te: { title: 'OCR సమీక్ష వరుస', lead: 'పేజీ వైఫల్యాలు, అనిశ్చిత ఫీల్డులు, మూల లోపాలు మరియు నిర్మాణ విభేదాలు.', refresh: 'రిఫ్రెష్', issues: 'సమస్యలు', retained: 'మూల OCR మరియు మూల విలువలు ఎల్లప్పుడూ భద్రపరచబడతాయి.', search: 'సమీక్ష సమస్యలను వెతకండి', searchHint: 'పేరు, బంధం, ఇల్లు, EPIC, క్రమ సంఖ్య, సమస్య లేదా ఫైల్', clear: 'తొలగించు', part: 'భాగం', source: 'మూల భాష', status: 'స్థితి', severity: 'తీవ్రత', rows: 'పేజీకి వరుసలు', page: 'పేజీ', of: '/', previous: 'మునుపటి', next: 'తదుపరి', noRows: 'ఈ ఫిల్టర్లకు సరిపోయే సమీక్ష సమస్యలు లేవు.', issue: 'సమస్య', pdfPage: 'PDF పేజీ', voter: 'ఓటరు', confidence: 'నమ్మకం', action: 'చర్య', openSource: 'మూలం', review: 'సమీక్ష', original: 'మూల విలువలు మారవు', correct: 'OCR ఫీల్డులను సరిచేయండి', reason: 'సవరణ కారణం', reasonHint: 'మూల పేజీతో ఏది తనిఖీ చేశారో వివరించండి', save: 'సవరణ సేవ్', verify: 'సేవ్ చేసి ధృవీకరించు', reasonRequired: 'సేవ్ చేసే ముందు సవరణ కారణాన్ని నమోదు చేయండి.', all: 'అన్నీ', languages: 'అన్ని భాషలు' },
  ur: { title: 'OCR جائزہ قطار', lead: 'صفحہ ناکامیاں، غیر یقینی فیلڈز، ماخذ خلا اور ساختی تضادات۔', refresh: 'تازہ کریں', issues: 'مسائل', retained: 'اصل OCR اور ماخذ اقدار ہمیشہ محفوظ رہتی ہیں۔', search: 'جائزہ مسائل تلاش کریں', searchHint: 'نام، رشتہ، مکان، EPIC، سیریل، مسئلہ یا فائل', clear: 'صاف کریں', part: 'حصہ', source: 'ماخذ زبان', status: 'حالت', severity: 'شدت', rows: 'فی صفحہ قطاریں', page: 'صفحہ', of: 'از', previous: 'پچھلا', next: 'اگلا', noRows: 'ان فلٹرز سے کوئی جائزہ مسئلہ نہیں ملا۔', issue: 'مسئلہ', pdfPage: 'PDF صفحہ', voter: 'ووٹر', confidence: 'اعتماد', action: 'عمل', openSource: 'ماخذ', review: 'جائزہ', original: 'اصل اقدار تبدیل نہیں ہوتیں', correct: 'OCR فیلڈ درست کریں', reason: 'تصحیح کی وجہ', reasonHint: 'وضاحت کریں کہ ماخذ صفحہ سے کیا جانچا گیا', save: 'تصحیح محفوظ کریں', verify: 'محفوظ اور تصدیق کریں', reasonRequired: 'محفوظ کرنے سے پہلے تصحیح کی وجہ درج کریں۔', all: 'سب', languages: 'تمام زبانیں' },
} as const

const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  all: 'All', critical: 'Critical', pages: 'Pages', records: 'Records',
  low_confidence: 'Low Confidence', serial_gaps: 'Serial Gaps',
  house_number: 'House Number', possible_duplicate: 'Possible Duplicate', language: 'Language',
}
const categories = Object.keys(CATEGORY_LABELS) as ReviewCategory[]

export default function AdvancedReviewPage({ lang }: { lang: Lang }) {
  const router = useRouter()
  const copy = COPY[lang]
  const [rows, setRows] = useState<ReviewPageRow[]>([])
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState<ReviewCategory>('all')
  const [part, setPart] = useState('all')
  const [sourceLanguage, setSourceLanguage] = useState('all')
  const [status, setStatus] = useState<ReviewStatus>('open')
  const [severity, setSeverity] = useState<ReviewSeverity>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [cursors, setCursors] = useState<Record<number, ReviewCursor | null>>({ 1: null })
  const [edit, setEdit] = useState<ReviewPageRow | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const cursor = cursors[page] ?? null

  const expireSession = useCallback(async () => {
    sessionStorage.setItem('pv-auth-message', 'Your session has expired. Please sign in again.')
    sessionStorage.setItem('pv-return-to', '/review')
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/login')
  }, [router])

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    const queryContext = { page, pageSize, category, part, sourceLanguage, status, severity, searchTerm }
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) throw { status: 401, code: 'AUTH_SESSION_MISSING', message: sessionError?.message ?? 'Not authenticated' }
      const response = await supabase.rpc('get_review_issues_page_v2' as never, {
        p_status: status,
        p_severity: severity,
        p_category: category,
        p_language: sourceLanguage === 'all' ? null : sourceLanguage,
        p_part: part === 'all' ? null : Number(part),
        p_search: searchTerm || null,
        p_limit: pageSize,
        p_after_created_at: cursor?.createdAt ?? null,
        p_after_id: cursor?.issueId ?? null,
      } as never) as { data: unknown; error: unknown }
      if (response.error) throw response.error
      const nextRows = (response.data ?? []) as ReviewPageRow[]
      setRows(nextRows)
      setTotal((current) => Number(nextRows[0]?.total_count ?? (page === 1 ? 0 : current)))
    } catch (loadError) {
      const classified = classifyReviewError(loadError)
      console.error('Review page query failed', reviewErrorContext(loadError, queryContext))
      if (classified.kind === 'session') await expireSession()
      else setError(classified.message)
    } finally { setBusy(false) }
  }, [category, cursor?.createdAt, cursor?.issueId, expireSession, page, pageSize, part, searchTerm, severity, sourceLanguage, status])

  useEffect(() => { void load() }, [load])

  function resetQueue() {
    setPage(1)
    setCursors({ 1: null })
  }
  function selectCategory(next: ReviewCategory) { setCategory(next); resetQueue() }
  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchTerm(normalizeReviewSearch(searchDraft))
    resetQueue()
  }
  function clearSearch() { setSearchDraft(''); setSearchTerm(''); resetQueue() }
  function nextPage() {
    const nextCursor = reviewCursorFromRows(rows)
    if (!nextCursor || page >= pageCount) return
    setCursors((current) => ({ ...current, [page + 1]: nextCursor }))
    setPage((current) => current + 1)
  }
  function openEditor(row: ReviewPageRow) {
    setEdit(row)
    setReason('')
    setFields({
      original_name: row.corrected_value?.original_name || row.voter_name || '',
      original_relation_name: row.corrected_value?.original_relation_name || row.relation_name || '',
      original_house_number: row.corrected_value?.original_house_number || row.house_number || '',
      age: row.corrected_value?.age || String(row.age ?? ''),
      gender: row.corrected_value?.gender || row.gender || '',
      epic_number: row.corrected_value?.epic_number || row.epic_number || '',
    })
  }

  async function save(verified: boolean) {
    if (!edit?.voter_id) return
    if (!reason.trim()) { setError(copy.reasonRequired); return }
    setBusy(true); setError('')
    try {
      const response = await supabase.rpc('save_review_correction_v1' as never, {
        p_issue_id: edit.issue_id,
        p_corrected_value: fields,
        p_mark_verified: verified,
        p_reason: reason.trim(),
      } as never) as { error: unknown }
      if (response.error) throw response.error
      invalidateDataCache()
      setEdit(null)
      resetQueue()
    } catch (saveError) {
      const classified = classifyReviewError(saveError)
      console.error('Review correction failed', reviewErrorContext(saveError, { issueId: edit.issue_id, voterId: edit.voter_id, verified }))
      if (classified.kind === 'session') await expireSession()
      else setError(classified.kind === 'unknown' ? 'Unable to save correction.' : classified.message)
    } finally { setBusy(false) }
  }

  function source(row: ReviewPageRow) {
    const physicalPage = row.voter_pdf_page_number ?? row.page_pdf_page_number ?? 1
    router.push(`/source/${row.pdf_id}?page=${physicalPage}${row.voter_id ? `&voter=${row.voter_id}` : ''}`)
  }

  return <section className="standalone-page">
    <div className="page-title"><div><span className="eyebrow">జనసూచి — JANASOOCHI</span><h1>{copy.title}</h1><p>{copy.lead}</p></div><button className="secondary" disabled={busy} onClick={() => void load()}><RefreshCw />{copy.refresh}</button></div>
    <div className="summary-strip"><span>{busy && !rows.length ? 'Loading…' : `${total.toLocaleString()} ${copy.issues}`}</span><span>{copy.retained}</span></div>
    <form className="review-search" onSubmit={applySearch}><label><span>{copy.search}</span><div><Search aria-hidden="true" /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} maxLength={120} placeholder={copy.searchHint} /></div></label><button className="primary compact" type="submit" disabled={busy}>{copy.search}</button>{(searchDraft || searchTerm) && <button className="secondary compact" type="button" onClick={clearSearch}>{copy.clear}</button>}</form>
    <div className="review-filters">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => selectCategory(item)}>{CATEGORY_LABELS[item]}</button>)}</div>
    <div className="review-toolbar">
      <label>{copy.part}<select value={part} onChange={(event) => { setPart(event.target.value); resetQueue() }}><option value="all">{copy.all} 227–230</option>{[227, 228, 229, 230].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>{copy.source}<select value={sourceLanguage} onChange={(event) => { setSourceLanguage(event.target.value); resetQueue() }}><option value="all">{copy.languages}</option><option value="en">English</option><option value="te">తెలుగు</option><option value="ur">اردو</option></select></label>
      <label>{copy.status}<select value={status} onChange={(event) => { setStatus(event.target.value as ReviewStatus); resetQueue() }}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">{copy.all}</option></select></label>
      <label>{copy.severity}<select value={severity} onChange={(event) => { setSeverity(event.target.value as ReviewSeverity); resetQueue() }}><option value="all">{copy.all}</option><option value="critical">Critical</option><option value="needs_review">Needs Review</option><option value="informational">Informational</option></select></label>
      <label>{copy.rows}<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetQueue() }}>{[25, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></label>
      <span>{copy.page} {page} {copy.of} {pageCount}</span>
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="data-table review-table"><table><thead><tr><th>{copy.issue}</th><th>{copy.part}</th><th>{copy.pdfPage}</th><th>{copy.voter}</th><th>{copy.confidence}</th><th>{copy.status}</th><th>{copy.action}</th></tr></thead><tbody>{rows.map((row) => {
      const confidence = row.voter_ocr_confidence ?? row.page_ocr_confidence
      return <tr key={row.issue_id}><td><span className={`severity ${row.issue_severity}`}>{row.issue_severity.replaceAll('_', ' ')}</span><b>{row.issue_type.replaceAll('_', ' ')}</b><small>{row.issue_detail}</small></td><td>{row.part_number ?? '—'}</td><td>{row.voter_pdf_page_number ?? row.page_pdf_page_number ?? '—'}{(row.voter_printed_page_number ?? row.page_printed_page_number) && <small>Printed {row.voter_printed_page_number ?? row.page_printed_page_number}</small>}</td><td>{show(row.voter_name, lang)}{row.serial_number && <small>Serial {row.serial_number}</small>}</td><td>{confidence === null || confidence === undefined ? 'Text / unavailable' : `${Number(confidence).toFixed(0)}%`}</td><td><span className={`status ${row.issue_status === 'open' ? 'requires_review' : row.issue_status}`}>{row.issue_status.replaceAll('_', ' ')}</span></td><td><div className="row-actions"><button className="secondary compact" onClick={() => source(row)}><ExternalLink />{copy.openSource}</button>{row.voter_id && row.issue_status === 'open' && <button className="primary compact" onClick={() => openEditor(row)}>{copy.review}</button>}</div></td></tr>
    })}</tbody></table>{!busy && !rows.length && <p className="empty-row">{copy.noRows}</p>}</div>
    <div className="pagination review-pagination"><button className="secondary compact" disabled={busy || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft />{copy.previous}</button><span>{copy.page} {page} {copy.of} {pageCount}</span><button className="secondary compact" disabled={busy || page >= pageCount || !rows.length} onClick={nextPage}>{copy.next}<ChevronRight /></button></div>
    {edit && <div className="modal-backdrop"><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title"><header><div><small>{copy.original}</small><h2 id="review-dialog-title">{copy.correct}</h2></div><button className="icon-button" aria-label="Close" onClick={() => setEdit(null)}><X /></button></header><pre>{edit.original_text}</pre><div className="field-confidence-grid">{Object.entries(edit.field_confidence ?? {}).map(([field, confidence]) => <span key={field}>{field.replaceAll('_', ' ')} <b>{confidence}%</b></span>)}</div><div className="review-grid">{Object.entries({ original_name: 'Name', original_relation_name: 'Relation name', original_house_number: 'House number', age: 'Age', gender: 'Gender', epic_number: 'EPIC' }).map(([key, label]) => <label key={key}>{label}<small>Original: {show(({ original_name: edit.voter_name, original_relation_name: edit.relation_name, original_house_number: edit.house_number, age: edit.age, gender: edit.gender, epic_number: edit.epic_number } as Record<string, unknown>)[key], lang)}</small><input type={key === 'age' ? 'number' : 'text'} min={key === 'age' ? 18 : undefined} max={key === 'age' ? 125 : undefined} value={fields[key] ?? ''} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><label className="review-reason">{copy.reason}<textarea value={reason} maxLength={500} placeholder={copy.reasonHint} onChange={(event) => setReason(event.target.value)} required /></label><footer><button className="secondary" disabled={busy} onClick={() => void save(false)}>{copy.save}</button><button className="primary" disabled={busy} onClick={() => void save(true)}><CheckCircle2 />{copy.verify}</button></footer></section></div>}
  </section>
}

