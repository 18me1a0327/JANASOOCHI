'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  normalizeReconciliationSearch,
  reconciliationCursorFromRows,
  summarizeRevisionRows,
  type EvidenceResult,
  type ReconciliationCursor,
  type ReconciliationEvidenceRow,
  type ReconciliationStatus,
  type RevisionReconciliationSummary,
} from '../lib/data-quality/reconciliation'
import { createClient } from '../lib/supabase/client'
import { useLanguage } from './language-provider'
import { MetricCard, Panel } from './ui-shell'

type RpcResult = { data: unknown; error: { message: string } | null }

const COPY = {
  en: {
    title: 'Current revision reconciliation', lead: 'Part + Serial links English and Telugu source editions. Names are supporting evidence only.',
    expected: 'Logical voters', paired: 'EN + TE paired', reconciled: 'Reconciled', unlinked: 'Unlinked sources',
    revision: 'Revision', documents: 'Documents', english: 'English linked', telugu: 'Telugu linked', missing: 'Missing EN / TE', conflicts: 'Review / duplicate / EPIC', verified: 'Verified',
    evidence: 'Reconciliation evidence', search: 'Search Part, serial, name, house or EPIC', status: 'Status', all: 'All evidence', rows: 'Rows', page: 'Page', of: 'of', previous: 'Previous', next: 'Next',
    identity: 'Identity', result: 'Result', structured: 'Structured evidence', sourceEn: 'English source', sourceTe: 'Telugu source', action: 'Source', none: 'Not available in source PDF', noRows: 'No reconciliation evidence matches these filters.', unavailable: 'Unable to load reconciliation evidence.', mixed: 'Multiple revision identifiers', current: 'Current uploaded revision',
  },
  te: {
    title: 'ప్రస్తుత రివిజన్ సమన్వయం', lead: 'భాగం + క్రమ సంఖ్య ఇంగ్లీష్, తెలుగు మూలాలను అనుసంధానిస్తుంది. పేర్లు సహాయక ఆధారాలు మాత్రమే.',
    expected: 'తార్కిక ఓటర్లు', paired: 'EN + TE జత', reconciled: 'సమన్వయమైనవి', unlinked: 'అనుసంధానం కాని మూలాలు',
    revision: 'రివిజన్', documents: 'పత్రాలు', english: 'ఇంగ్లీష్ అనుసంధానం', telugu: 'తెలుగు అనుసంధానం', missing: 'లేని EN / TE', conflicts: 'సమీక్ష / నకిలీ / EPIC', verified: 'ధృవీకరించినవి',
    evidence: 'సమన్వయ ఆధారాలు', search: 'భాగం, క్రమ సంఖ్య, పేరు, ఇల్లు లేదా EPIC వెతకండి', status: 'స్థితి', all: 'అన్ని ఆధారాలు', rows: 'వరుసలు', page: 'పేజీ', of: '/', previous: 'మునుపటి', next: 'తదుపరి',
    identity: 'గుర్తింపు', result: 'ఫలితం', structured: 'నిర్మిత ఆధారాలు', sourceEn: 'ఇంగ్లీష్ మూలం', sourceTe: 'తెలుగు మూలం', action: 'మూలం', none: 'మూల PDFలో అందుబాటులో లేదు', noRows: 'ఈ ఫిల్టర్లకు సరిపోయే సమన్వయ ఆధారాలు లేవు.', unavailable: 'సమన్వయ ఆధారాలను లోడ్ చేయలేకపోయాం.', mixed: 'అనేక రివిజన్ గుర్తింపులు', current: 'ప్రస్తుత అప్‌లోడ్ రివిజన్',
  },
  ur: {
    title: 'موجودہ نظرثانی مفاہمت', lead: 'پارٹ + سیریل انگریزی اور تلگو ماخذ کو جوڑتے ہیں۔ نام صرف معاون ثبوت ہیں۔',
    expected: 'منطقی ووٹر', paired: 'EN + TE جوڑا', reconciled: 'مصالحت شدہ', unlinked: 'غیر منسلک ذرائع',
    revision: 'نظرثانی', documents: 'دستاویزات', english: 'انگریزی منسلک', telugu: 'تلگو منسلک', missing: 'غائب EN / TE', conflicts: 'جائزہ / نقل / EPIC', verified: 'تصدیق شدہ',
    evidence: 'مصالحتی ثبوت', search: 'پارٹ، سیریل، نام، مکان یا EPIC تلاش کریں', status: 'حالت', all: 'تمام ثبوت', rows: 'قطاریں', page: 'صفحہ', of: 'از', previous: 'پچھلا', next: 'اگلا',
    identity: 'شناخت', result: 'نتیجہ', structured: 'ساختی ثبوت', sourceEn: 'انگریزی ماخذ', sourceTe: 'تلگو ماخذ', action: 'ماخذ', none: 'ماخذ PDF میں دستیاب نہیں', noRows: 'ان فلٹرز سے کوئی مصالحتی ثبوت نہیں ملا۔', unavailable: 'مصالحتی ثبوت لوڈ نہیں ہو سکے۔', mixed: 'متعدد نظرثانی شناختیں', current: 'موجودہ اپ لوڈ نظرثانی',
  },
} as const

const STATUS_OPTIONS: Exclude<ReconciliationStatus, 'all'>[] = [
  'reconciled', 'needs_review', 'missing_en', 'missing_te',
  'duplicate_source', 'epic_conflict', 'unlinked_source',
]

export function ReconciliationDrilldown({ part }: Readonly<{ part: string }>) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = COPY[language]
  const [summary, setSummary] = useState<RevisionReconciliationSummary[]>([])
  const [rows, setRows] = useState<ReconciliationEvidenceRow[]>([])
  const [status, setStatus] = useState<ReconciliationStatus>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [cursors, setCursors] = useState<Record<number, ReconciliationCursor | null>>({ 1: null })
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const cursor = cursors[page] ?? null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const resetPage = useCallback(() => {
    setPage(1)
    setCursors({ 1: null })
  }, [])

  const loadSummary = useCallback(async () => {
    try {
      const result = await createClient().rpc('get_revision_reconciliation_summary_v1' as never, {
        p_part: part ? Number(part) : null,
      } as never) as unknown as RpcResult
      if (result.error) throw result.error
      setSummary((result.data ?? []) as RevisionReconciliationSummary[])
    } catch (loadError) {
      console.error('Revision reconciliation summary failed', loadError)
      setSummary([])
      setError(copy.unavailable)
    }
  }, [copy.unavailable, part])

  const loadRows = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const result = await createClient().rpc('get_reconciliation_evidence_page_v1' as never, {
        p_part: part ? Number(part) : null,
        p_status: status,
        p_search: search || null,
        p_limit: pageSize,
        p_after_part: cursor?.part ?? null,
        p_after_serial: cursor?.serial ?? null,
        p_after_row_key: cursor?.rowKey ?? null,
      } as never) as unknown as RpcResult
      if (result.error) throw result.error
      const nextRows = (result.data ?? []) as ReconciliationEvidenceRow[]
      setRows(nextRows)
      setTotal((current) => Number(nextRows[0]?.total_count ?? (page === 1 ? 0 : current)))
    } catch (loadError) {
      console.error('Reconciliation evidence query failed', loadError)
      setRows([])
      setError(copy.unavailable)
    } finally {
      setBusy(false)
    }
  }, [copy.unavailable, cursor?.part, cursor?.rowKey, cursor?.serial, page, pageSize, part, search, status])

  useEffect(() => { void loadSummary() }, [loadSummary])
  useEffect(() => { void loadRows() }, [loadRows])
  useEffect(() => { resetPage() }, [part, resetPage])

  const totals = useMemo(() => summarizeRevisionRows(summary), [summary])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearch(normalizeReconciliationSearch(searchDraft))
    resetPage()
  }

  function nextPage() {
    const nextCursor = reconciliationCursorFromRows(rows)
    if (!nextCursor || page >= pageCount) return
    setCursors((current) => ({ ...current, [page + 1]: nextCursor }))
    setPage((current) => current + 1)
  }

  function openSource(documentId: string | null, recordId: string | null, physicalPage: number | null) {
    if (!documentId || !recordId) return
    router.push(`/source/${documentId}?page=${physicalPage ?? 1}&voter=${recordId}`)
  }

  return <section className="reconciliation-section">
    <div className="section-heading"><div><h2>{copy.title}</h2><p>{copy.lead}</p></div></div>
    <div className="metric-grid reconciliation-metrics">
      <MetricCard label={copy.expected} value={totals.expectedLogicalVoters.toLocaleString('en-IN')} note="Parts 227–230" />
      <MetricCard label={copy.paired} value={totals.pairedSlots.toLocaleString('en-IN')} note="Part + Serial" />
      <MetricCard label={copy.reconciled} value={totals.reconciledSlots.toLocaleString('en-IN')} note={copy.lead} tone="positive" />
      <MetricCard label={copy.unlinked} value={totals.unlinkedSourceRecords.toLocaleString('en-IN')} note={copy.evidence} tone={totals.unlinkedSourceRecords ? 'warning' : 'positive'} />
    </div>
    <Panel title={copy.revision} description={copy.lead}>
      <div className="data-table-wrap"><table><thead><tr><th>Part</th><th>{copy.revision}</th><th>{copy.documents}</th><th>{copy.english}</th><th>{copy.telugu}</th><th>{copy.paired}</th><th>{copy.missing}</th><th>{copy.conflicts}</th><th>{copy.verified}</th></tr></thead><tbody>
        {summary.map((row) => <tr key={row.part_number}><td><strong>{row.part_number}</strong></td><td>{row.revision_identifiers.length ? row.revision_identifiers.join(', ') : copy.current}{row.revision_identifiers.length > 1 && <small>{copy.mixed}</small>}</td><td>{Number(row.active_documents).toLocaleString('en-IN')}</td><td>{Number(row.english_linked_slots).toLocaleString('en-IN')} / {Number(row.expected_slots).toLocaleString('en-IN')}</td><td>{Number(row.telugu_linked_slots).toLocaleString('en-IN')} / {Number(row.expected_slots).toLocaleString('en-IN')}</td><td>{Number(row.paired_slots).toLocaleString('en-IN')}</td><td>{Number(row.missing_english_slots).toLocaleString('en-IN')} / {Number(row.missing_telugu_slots).toLocaleString('en-IN')}</td><td>{(Number(row.needs_review_slots) + Number(row.duplicate_source_slots) + Number(row.epic_conflict_slots)).toLocaleString('en-IN')}</td><td>{Number(row.verified_slots).toLocaleString('en-IN')}</td></tr>)}
      </tbody></table></div>
    </Panel>
    <Panel title={copy.evidence} description={copy.lead}>
      <form className="reconciliation-toolbar" onSubmit={submitSearch}>
        <label><span className="visually-hidden">{copy.search}</span><div className="reconciliation-search"><Search aria-hidden="true" /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} maxLength={120} placeholder={copy.search} /></div></label>
        <label>{copy.status}<select value={status} onChange={(event) => { setStatus(event.target.value as ReconciliationStatus); resetPage() }}><option value="all">{copy.all}</option>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        <label>{copy.rows}<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage() }}>{[25, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></label>
        <button className="primary compact" type="submit" disabled={busy}>{copy.search}</button>
      </form>
      {error && <p className="error-notice" role="alert">{error}</p>}
      <div className="data-table-wrap reconciliation-table"><table><thead><tr><th>{copy.identity}</th><th>{copy.result}</th><th>{copy.structured}</th><th>{copy.sourceEn}</th><th>{copy.sourceTe}</th><th>{copy.action}</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.row_key}><td><strong>Part {row.part_number} · {row.serial_number ?? '—'}</strong><small>{row.logical_verification_status.replaceAll('_', ' ')}</small></td><td><span className={`status ${row.reconciliation_status === 'reconciled' ? 'verified' : 'requires_review'}`}>{row.reconciliation_status.replaceAll('_', ' ')}</span><small>EN {row.english_source_count} · TE {row.telugu_source_count}</small></td><td><Evidence label="EPIC" value={row.epic_evidence} /><Evidence label="House" value={row.house_evidence} /><Evidence label="Age" value={row.age_evidence} /><Evidence label="Gender" value={row.gender_evidence} /></td><td><SourceSummary name={row.english_voter_name} relation={row.english_relation_name} house={row.english_house_number} age={row.english_age} gender={row.english_gender} epic={row.english_epic} page={row.english_physical_page} missing={copy.none} /></td><td><SourceSummary name={row.telugu_voter_name} relation={row.telugu_relation_name} house={row.telugu_house_number} age={row.telugu_age} gender={row.telugu_gender} epic={row.telugu_epic} page={row.telugu_physical_page} missing={copy.none} /></td><td><div className="row-actions">{row.english_source_record_id && <button className="secondary compact" type="button" onClick={() => openSource(row.english_document_id, row.english_source_record_id, row.english_physical_page)}><ExternalLink />EN</button>}{row.telugu_source_record_id && <button className="secondary compact" type="button" onClick={() => openSource(row.telugu_document_id, row.telugu_source_record_id, row.telugu_physical_page)}><ExternalLink />TE</button>}</div></td></tr>)}
      </tbody></table>{!busy && !rows.length && <p className="empty-row">{copy.noRows}</p>}</div>
      <div className="pagination reconciliation-pagination"><button className="secondary compact" type="button" disabled={busy || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft />{copy.previous}</button><span>{copy.page} {page} {copy.of} {pageCount}</span><button className="secondary compact" type="button" disabled={busy || page >= pageCount || !rows.length} onClick={nextPage}>{copy.next}<ChevronRight /></button></div>
    </Panel>
  </section>
}

function Evidence({ label, value }: Readonly<{ label: string; value: EvidenceResult }>) {
  return <span className={`evidence-chip ${value}`}>{label}: {value}</span>
}

function SourceSummary({ name, relation, house, age, gender, epic, page, missing }: Readonly<{ name: string | null; relation: string | null; house: string | null; age: number | null; gender: string | null; epic: string | null; page: number | null; missing: string }>) {
  if (!name && !epic && !house) return <span className="source-missing">{missing}</span>
  return <span className="source-summary"><b>{name ?? missing}</b><small>{relation ?? missing}</small><small>{house ?? missing} · {age ?? '—'} · {gender ?? '—'}</small><small>{epic ?? missing}{page ? ` · PDF ${page}` : ''}</small></span>
}

