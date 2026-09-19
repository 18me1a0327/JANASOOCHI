'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Archive, CheckCircle2, ExternalLink, FileCheck2, LoaderCircle, Play, RefreshCw, UploadCloud, X } from 'lucide-react'

import { useAuth } from '../lib/providers/auth-provider'
import { createClient } from '../lib/supabase/client'
import { detectLanguage, UNSUPPORTED } from '../src/core'
import { inspectPdf, processPdf, sha256, type ProcessedPage } from '../src/lib'
import type { DocumentRow } from '../src/types'
import { useLanguage } from './language-provider'

const PAGE_SIZE = 25

type Progress = { page: number; total: number; records: number; reviews: number }

const COPY = {
  en: { choose: 'Select or drop an authorized PDF', validate: 'Validate and process', processing: 'Processing page', duplicate: 'This PDF has already been processed.', unsupported: 'Unsupported electoral roll. This application supports only Pallerlamudi Parts 227, 228, 229 and 230.', invalid: 'Unable to open PDF', database: 'Database temporarily unavailable', uploaded: 'PDF processed and saved.', stored: 'PDF safely stored. Page processing is continuing.', warning: 'PDF completed with review warnings.', refresh: 'Refresh documents', source: 'Open source', archive: 'Archive', activate: 'Make active', confirmArchive: 'Archive this source version? Its source records and audit history will be retained.', adminOnly: 'Only an administrator can upload or change source documents.', noDocs: 'No uploaded source documents were found.', failed: 'Unable to process this document. The PDF remains safely stored and saved page progress can be resumed.', retry: 'Retry / resume with selected PDF' },
  te: { choose: 'అధీకృత PDFను ఎంచుకోండి లేదా వదలండి', validate: 'ధృవీకరించి ప్రాసెస్ చేయండి', processing: 'ప్రాసెస్ అవుతున్న పేజీ', duplicate: 'ఈ PDF ఇప్పటికే ప్రాసెస్ చేయబడింది.', unsupported: 'మద్దతు లేని ఓటరు జాబితా. ఈ అప్లికేషన్ పల్లెర్లమూడి భాగాలు 227, 228, 229 మరియు 230కి మాత్రమే మద్దతు ఇస్తుంది.', invalid: 'PDF తెరవలేకపోయాం', database: 'డేటాబేస్ తాత్కాలికంగా అందుబాటులో లేదు', uploaded: 'PDF ప్రాసెస్ చేసి సేవ్ చేయబడింది.', stored: 'PDF సురక్షితంగా నిల్వైంది. పేజీ ప్రాసెసింగ్ కొనసాగుతోంది.', warning: 'PDF సమీక్ష హెచ్చరికలతో పూర్తయింది.', refresh: 'పత్రాలను రిఫ్రెష్ చేయండి', source: 'మూలం తెరవండి', archive: 'ఆర్కైవ్', activate: 'సక్రియం చేయండి', confirmArchive: 'ఈ మూల సంచికను ఆర్కైవ్ చేయాలా? మూల రికార్డులు, ఆడిట్ చరిత్ర నిల్వ ఉంటాయి.', adminOnly: 'అడ్మిన్ మాత్రమే మూల పత్రాలను అప్‌లోడ్ చేయగలరు లేదా మార్చగలరు.', noDocs: 'అప్‌లోడ్ చేసిన మూల పత్రాలు లేవు.', failed: 'ఈ పత్రాన్ని ప్రాసెస్ చేయలేకపోయాం. PDF సురక్షితంగా నిల్వ ఉంటుంది; సేవ్ చేసిన పేజీ పురోగతిని కొనసాగించవచ్చు.', retry: 'ఎంచుకున్న PDFతో మళ్లీ ప్రయత్నించండి / కొనసాగించండి' },
  ur: { choose: 'مجاز PDF منتخب کریں یا یہاں چھوڑیں', validate: 'توثیق اور پراسیس کریں', processing: 'صفحہ پراسیس ہو رہا ہے', duplicate: 'یہ PDF پہلے ہی پراسیس ہو چکی ہے۔', unsupported: 'غیر معاون انتخابی فہرست۔ یہ ایپ صرف پالرلامودی حصوں 227، 228، 229 اور 230 کی معاونت کرتی ہے۔', invalid: 'PDF نہیں کھولی جا سکی', database: 'ڈیٹابیس عارضی طور پر دستیاب نہیں', uploaded: 'PDF پراسیس اور محفوظ ہو گئی۔', stored: 'PDF محفوظ اسٹوریج میں ہے۔ صفحہ پراسیسنگ جاری ہے۔', warning: 'PDF جائزہ انتباہات کے ساتھ مکمل ہوئی۔', refresh: 'دستاویزات تازہ کریں', source: 'ماخذ کھولیں', archive: 'آرکائیو', activate: 'فعال کریں', confirmArchive: 'اس ماخذ ورژن کو آرکائیو کریں؟ ماخذ ریکارڈ اور آڈٹ تاریخ برقرار رہے گی۔', adminOnly: 'صرف ایڈمن ماخذ دستاویزات اپ لوڈ یا تبدیل کر سکتا ہے۔', noDocs: 'کوئی اپ لوڈ شدہ ماخذ دستاویز نہیں ملی۔', failed: 'دستاویز پراسیس نہیں ہو سکی۔ PDF محفوظ ہے اور محفوظ شدہ پیش رفت دوبارہ شروع کی جا سکتی ہے۔', retry: 'منتخب PDF سے دوبارہ کوشش / بحال کریں' },
} as const

export function DocumentsManager() {
  const { role, user } = useAuth()
  const { language, t } = useLanguage()
  const copy = COPY[language]
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const isAdmin = role === 'admin'

  const load = useCallback(async (nextPage: number) => {
    setLoading(true)
    setError('')
    try {
      const from = (nextPage - 1) * PAGE_SIZE
      const { data, error: queryError } = await createClient()
        .from('uploaded_pdfs')
        .select('*')
        .in('part_number', [227, 228, 229, 230])
        .order('uploaded_at', { ascending: false })
        .range(from, from + PAGE_SIZE)
      if (queryError) throw queryError
      const rows = (data ?? []) as DocumentRow[]
      setDocuments(rows.slice(0, PAGE_SIZE))
      setHasMore(rows.length > PAGE_SIZE)
      setPage(nextPage)
    } catch (loadError) {
      console.error('Document list failed', loadError)
      setError(copy.database)
    } finally {
      setLoading(false)
    }
  }, [copy.database])

  useEffect(() => { void load(1) }, [load])

  async function savePage(pdfId: string, part: number, processed: ProcessedPage) {
    const supabase = createClient()
    const state = processed.state
    const { data: pageRow, error: pageError } = await supabase
      .from('page_processing')
      .upsert({
        pdf_id: pdfId,
        pdf_page_number: state.page,
        printed_page_number: state.printed,
        status: state.status,
        page_type: state.pageType,
        ocr_confidence: state.confidence,
        records_detected: state.detected,
        records_extracted: state.extracted,
        review_records: state.reviewRecords,
        dropped_records: state.droppedRecords,
        issue_detail: state.issue,
        error_type: state.errorType,
        error_message: state.errorMessage,
        detected_language: state.detectedLanguage,
        language_confidence: state.languageConfidence,
        retry_count: Math.max(0, state.attempts - 1),
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'pdf_id,pdf_page_number' })
      .select('id')
      .single()
    if (pageError) throw pageError

    if (state.status === 'processed') {
      const resolved = await supabase.from('review_issues').update({
        status: 'resolved',
        resolved_by: user?.id ?? null,
        resolved_at: new Date().toISOString(),
        resolution_type: 'deterministic_reprocess',
        resolution_reason: 'The source page was successfully reprocessed.',
        auto_resolved: true,
        updated_at: new Date().toISOString(),
      } as never).eq('page_id', pageRow.id).eq('status', 'open').in('issue_type', ['page_failure', 'malformed_record'])
      if (resolved.error) throw resolved.error
    }

    let inserted: Array<{ id: string; verification_status: string }> = []
    if (processed.records.length) {
      const payload = processed.records.map((record) => ({ ...record, pdf_id: pdfId, part_number: part }))
      const { data, error: recordError } = await supabase
        .from('voter_records')
        .upsert(payload as never, { onConflict: 'pdf_id,part_number,serial_number,pdf_page_number', ignoreDuplicates: true })
        .select('id,verification_status')
      if (recordError) throw recordError
      inserted = (data ?? []) as Array<{ id: string; verification_status: string }>
    }

    const issues: Array<{ pdf_id: string; page_id: number; voter_id?: string; issue_type: string; issue_detail: string }> = []
    if (state.status === 'requires_review') {
      const issueType = state.errorType ? 'page_failure' : 'malformed_record'
      const existingIssue = await supabase.from('review_issues').select('id').eq('page_id', pageRow.id).eq('status', 'open').eq('issue_type', issueType).limit(1).maybeSingle()
      if (existingIssue.error) throw existingIssue.error
      if (!existingIssue.data) issues.push({ pdf_id: pdfId, page_id: pageRow.id, issue_type: issueType, issue_detail: state.issue ?? state.errorMessage ?? 'Page requires review' })
    }
    inserted.filter((record) => record.verification_status === 'requires_review').forEach((record) => issues.push({ pdf_id: pdfId, page_id: pageRow.id, voter_id: record.id, issue_type: 'low_confidence', issue_detail: 'One or more extracted fields require verification.' }))
    if (issues.length) {
      const { error: issueError } = await supabase.from('review_issues').insert(issues as never)
      if (issueError) throw issueError
    }
  }

  async function finalizeDocument(document: DocumentRow, expectedVoterTotal: number | null) {
    const supabase = createClient()
    const [{ count: records, error: recordsError }, { count: reviewRecords, error: reviewError }, { data: savedPages, error: pagesError }] = await Promise.all([
      supabase.from('voter_records').select('id', { count: 'exact', head: true }).eq('pdf_id', document.id),
      supabase.from('voter_records').select('id', { count: 'exact', head: true }).eq('pdf_id', document.id).eq('verification_status', 'requires_review'),
      supabase.from('page_processing').select('status,error_type').eq('pdf_id', document.id),
    ])
    if (recordsError) throw recordsError
    if (reviewError) throw reviewError
    if (pagesError) throw pagesError

    const pages = savedPages ?? []
    const processedPages = pages.filter((saved) => ['processed', 'requires_review'].includes(saved.status)).length
    const failedPages = pages.filter((saved) => saved.status === 'requires_review').length
    const persistenceFailures = pages.filter((saved) => ['page_processing_failed', 'page_persistence_failed'].includes(saved.error_type ?? '')).length
    const interrupted = persistenceFailures > 0 || processedPages < document.total_pdf_pages
    const finalStatus = interrupted ? 'interrupted' : failedPages || (reviewRecords ?? 0) ? 'completed_with_warnings' : 'completed'
    const now = new Date().toISOString()

    const final = await supabase.from('uploaded_pdfs').update({
      processed_pages: processedPages,
      failed_pages: failedPages,
      records_count: records ?? 0,
      review_records: reviewRecords ?? 0,
      processing_status: finalStatus,
      expected_voter_total: expectedVoterTotal,
      completed_at: interrupted ? null : now,
      updated_at: now,
    }).eq('id', document.id)
    if (final.error) throw final.error

    if (!interrupted) {
      const deactivate = await supabase.from('uploaded_pdfs').update({ active_version: false, updated_at: now }).eq('part_number', document.part_number).eq('source_language', document.source_language).neq('id', document.id)
      if (deactivate.error) throw deactivate.error
      const activate = await supabase.from('uploaded_pdfs').update({ active_version: true, updated_at: now }).eq('id', document.id)
      if (activate.error) throw activate.error
      const reconciliation = await supabase.rpc('reconcile_logical_voters_for_part', { p_part: document.part_number })
      if (reconciliation.error) throw reconciliation.error
    }

    const audit = await supabase.from('audit_log').insert({
      action: interrupted ? 'document.processing_interrupted' : 'document.processed',
      entity_type: 'uploaded_pdf',
      entity_id: document.id,
      metadata: { part_number: document.part_number, source_language: document.source_language, records: records ?? 0, failed_pages: failedPages, processing_status: finalStatus },
    })
    if (audit.error) throw audit.error
    return { failedPages, interrupted }
  }

  async function processSelected() {
    if (!file || !isAdmin || !user) return
    setBusy(true)
    setError('')
    setNotice('')
    setProgress(null)
    let storagePath = ''
    let documentId = ''
    try {
      const info = await inspectPdf(file)
      const checksum = await sha256(file)
      const supabase = createClient()
      const duplicate = await supabase.from('uploaded_pdfs').select('*').eq('checksum', checksum).maybeSingle()
      if (duplicate.error) throw duplicate.error
      if (duplicate.data) {
        const existing = duplicate.data as DocumentRow
        const saved = await supabase.from('page_processing').select('pdf_page_number,printed_page_number,status,error_type').eq('pdf_id', existing.id)
        if (saved.error) throw saved.error
        const retryableErrors = new Set(['page_processing_failed', 'page_persistence_failed'])
        const retryable = (saved.data ?? []).filter((savedPage) => savedPage.status === 'requires_review' && retryableErrors.has(savedPage.error_type ?? ''))
        if (!retryable.length) {
          setError(copy.duplicate)
          return
        }
        documentId = existing.id
        storagePath = existing.storage_path
        const skipPages = new Set((saved.data ?? []).filter((savedPage) => savedPage.status === 'processed' || (savedPage.status === 'requires_review' && !retryableErrors.has(savedPage.error_type ?? ''))).map((savedPage) => savedPage.pdf_page_number))
        const started = await supabase.from('uploaded_pdfs').update({ processing_status: 'processing', updated_at: new Date().toISOString() }).eq('id', existing.id)
        if (started.error) throw started.error
        await processPdf(file, (currentPage, total, records, reviews) => setProgress({ page: currentPage, total, records, reviews }), {
          part: existing.part_number,
          skipPages,
          priorPrintedPages: (saved.data ?? []).map((savedPage) => savedPage.printed_page_number).filter((value): value is number => value !== null),
          expectedVoterTotal: existing.expected_voter_total,
          onPage: (processed) => savePage(existing.id, existing.part_number, processed),
        })
        const resumed = await finalizeDocument(existing, existing.expected_voter_total)
        setNotice(resumed.interrupted ? copy.failed : resumed.failedPages ? copy.warning : copy.uploaded)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ''
        await load(1)
        return
      }
      const detected = detectLanguage(info.sample, info.language)
      const sourceLanguage = detected.confidence >= 60 ? detected.language : info.language
      const previous = await supabase.from('uploaded_pdfs').select('id').eq('part_number', info.part).eq('source_language', sourceLanguage).eq('active_version', true).order('uploaded_at', { ascending: false }).limit(1).maybeSingle()
      if (previous.error) throw previous.error
      storagePath = `${info.part}/${sourceLanguage}/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`
      const upload = await supabase.storage.from('voter-pdfs').upload(storagePath, file, { contentType: 'application/pdf', upsert: false })
      if (upload.error) throw upload.error
      const created = await supabase.from('uploaded_pdfs').insert({
        filename: file.name,
        part_number: info.part,
        total_pdf_pages: info.totalPages,
        processing_status: 'processing',
        storage_path: storagePath,
        checksum,
        source_language: sourceLanguage,
        detected_language: detected.language,
        language_confidence: detected.confidence,
        expected_voter_total: info.expectedVoterTotal,
        active_version: !previous.data,
        supersedes_id: previous.data?.id ?? null,
      }).select('id').single()
      if (created.error) throw created.error
      documentId = created.data.id
      setNotice(copy.stored)
      await load(1)

      await processPdf(file, (currentPage, total, records, reviews) => {
        setProgress({ page: currentPage, total, records, reviews })
      }, {
        part: info.part,
        expectedVoterTotal: info.expectedVoterTotal,
        onPage: async (processed) => {
          await savePage(documentId, info.part, processed)
          await supabase.from('uploaded_pdfs').update({
            processed_pages: processed.state.page,
            updated_at: new Date().toISOString(),
          }).eq('id', documentId)
        },
      })

      const completed = await finalizeDocument({ ...created.data, filename: file.name, part_number: info.part, total_pdf_pages: info.totalPages, processed_pages: 0, failed_pages: 0, records_count: 0, processing_status: 'processing', uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null, storage_path: storagePath, checksum, source_language: sourceLanguage, detected_language: detected.language, language_confidence: detected.confidence, expected_voter_total: info.expectedVoterTotal, review_records: 0, revision_identifier: null, active_version: !previous.data, supersedes_id: previous.data?.id ?? null }, info.expectedVoterTotal)
      setNotice(completed.interrupted ? copy.failed : completed.failedPages ? copy.warning : copy.uploaded)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      await load(1)
    } catch (processError) {
      console.error('Document processing failed', processError)
      if (documentId) await createClient().from('uploaded_pdfs').update({ processing_status: 'failed', updated_at: new Date().toISOString() }).eq('id', documentId)
      else if (storagePath) await createClient().storage.from('voter-pdfs').remove([storagePath])
      const message = processError instanceof Error ? processError.message : ''
      setError(message === UNSUPPORTED ? copy.unsupported : message.includes('PDF') ? copy.invalid : copy.failed)
      await load(1)
    } finally {
      setBusy(false)
    }
  }

  async function setActive(document: DocumentRow, active: boolean) {
    if (!isAdmin) return
    if (!active && !window.confirm(copy.confirmArchive)) return
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      if (active) {
        const deactivate = await supabase.from('uploaded_pdfs').update({ active_version: false }).eq('part_number', document.part_number).eq('source_language', document.source_language).neq('id', document.id)
        if (deactivate.error) throw deactivate.error
      }
      const update = await supabase.from('uploaded_pdfs').update({ active_version: active, updated_at: new Date().toISOString() }).eq('id', document.id)
      if (update.error) throw update.error
      await supabase.from('audit_log').insert({ action: active ? 'document.activated' : 'document.archived', entity_type: 'uploaded_pdf', entity_id: document.id, metadata: { retained: true } })
      await load(page)
    } catch (changeError) {
      console.error('Document version change failed', changeError)
      setError(copy.database)
    } finally { setBusy(false) }
  }

  return (
    <>
      {isAdmin ? <section className="surface-panel upload-panel">
        <div className="panel-header"><div><h2>{t('uploadPdf')}</h2><p>{t('pdfOnly')}</p></div></div>
        <div className="document-upload">
          <button className="drop-zone" type="button" disabled={busy} onClick={() => inputRef.current?.click()}><UploadCloud aria-hidden="true" /><strong>{copy.choose}</strong><span>{t('pdfOnly')}</span></button>
          <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(''); setNotice('') }} />
          <div className="selected-document"><FileCheck2 aria-hidden="true" /><span><small>{t('selectedFile')}</small><strong>{file?.name ?? t('noFileSelected')}</strong></span>{file && !busy && <button type="button" onClick={() => setFile(null)}><X aria-hidden="true" /></button>}</div>
          <button className="button primary" type="button" disabled={!file || busy} onClick={() => void processSelected()}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Play aria-hidden="true" />}{copy.validate}</button>
          {progress && <div className="processing-progress"><span>{copy.processing} {progress.page} / {progress.total}</span><progress max={progress.total} value={progress.page} /><small>{progress.records.toLocaleString('en-IN')} records · {progress.reviews} review pages</small></div>}
        </div>
      </section> : <p className="inline-notice">{copy.adminOnly}</p>}
      {notice && <p className="success-notice" role="status"><CheckCircle2 aria-hidden="true" />{notice}</p>}
      {error && <p className="error-notice" role="alert">{error}</p>}
      <section className="surface-panel">
        <div className="panel-header"><div><h2>{t('uploadedDocuments')}</h2><p>{t('duplicateProtectionHelp')}</p></div><button className="button secondary small" type="button" disabled={loading} onClick={() => void load(page)}>{loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}{copy.refresh}</button></div>
        <div className="data-table-wrap"><table className="documents-table"><thead><tr><th>{t('part')}</th><th>{t('filename')}</th><th>{t('sourceLanguage')}</th><th>{t('pages')}</th><th>{t('records')}</th><th>{t('status')}</th><th>{t('uploaded')}</th><th>{t('actions')}</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><strong>{document.part_number}</strong></td><td><span>{document.filename}</span><small>{document.active_version ? 'Active version' : 'Archived version'}</small></td><td>{document.source_language.toUpperCase()}</td><td>{document.processed_pages} / {document.total_pdf_pages}{document.failed_pages > 0 && <small>{document.failed_pages} review</small>}</td><td>{document.records_count.toLocaleString('en-IN')}</td><td><span className={`status-badge ${document.processing_status}`}>{document.processing_status.replaceAll('_', ' ')}</span></td><td>{new Date(document.uploaded_at).toLocaleString()}</td><td><div className="row-actions"><Link className="button secondary small" href={`/source/${document.id}?page=1`}><ExternalLink aria-hidden="true" />{copy.source}</Link>{isAdmin && (document.active_version ? <button className="button secondary small" type="button" disabled={busy} onClick={() => void setActive(document, false)}><Archive aria-hidden="true" />{copy.archive}</button> : <button className="button secondary small" type="button" disabled={busy} onClick={() => void setActive(document, true)}><CheckCircle2 aria-hidden="true" />{copy.activate}</button>)}</div></td></tr>)}</tbody></table></div>
        {!loading && !documents.length && <div className="empty-state"><p>{copy.noDocs}</p></div>}
        <nav className="table-pagination"><button className="button secondary small" type="button" disabled={loading || page === 1} onClick={() => void load(page - 1)}>Previous</button><span>{t('page')} {page}</span><button className="button secondary small" type="button" disabled={loading || !hasMore} onClick={() => void load(page + 1)}>Next</button></nav>
      </section>
    </>
  )
}

