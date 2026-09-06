'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertOctagon, CheckCircle2, CircleDashed, Filter, LoaderCircle, RefreshCw } from 'lucide-react'

import { createClient } from '../lib/supabase/client'
import { useLanguage } from './language-provider'
import { MetricCard, Panel } from './ui-shell'

type Summary = {
  expected_slots: number | string
  active_logical_voters: number | string
  extracted_source_records: number | string
  linked_source_records: number | string
  missing_serials: number | string
  duplicate_serial_groups: number | string
  unexpected_serials: number | string
  duplicate_epic_groups: number | string
  expected_voter_cards: number | string
  extracted_voter_cards: number | string
  failed_pages: number | string
  partial_pages: number | string
  null_name_records: number | string
  null_relation_records: number | string
  null_house_records: number | string
  null_age_records: number | string
  null_epic_records: number | string
  reconciliation_conflicts: number | string
  critical_issues: number | string
  needs_review_issues: number | string
  informational_issues: number | string
  verified_logical_voters: number | string
  unverified_logical_voters: number | string
}

type PartQuality = {
  part_number: number
  source_language: 'en' | 'te' | 'ur'
  expected_slots: number | string
  source_record_count: number | string
  linked_slot_count: number | string
  missing_slot_count: number | string
  unlinked_source_count: number | string
}

type RpcResult = { data: unknown; error: { message: string } | null }
const PART_TOTALS: Record<number, number> = { 227: 1014, 228: 973, 229: 888, 230: 579 }

const COPY = {
  en: { unexpected: 'Unexpected serials', partial: 'Partially extracted pages', nullName: 'Missing names', nullRelation: 'Missing relations', nullHouse: 'Missing house numbers', nullAge: 'Missing ages', nullEpic: 'Missing EPICs', linked: 'Linked canonical slots', unlinked: 'Unlinked source rows', cards: 'Cards extracted / detected', reload: 'Reload quality data', unavailable: 'Unable to load data-quality metrics.' },
  te: { unexpected: 'అనుకోని క్రమ సంఖ్యలు', partial: 'పాక్షికంగా వెలికితీసిన పేజీలు', nullName: 'పేర్లు లేవు', nullRelation: 'బంధాలు లేవు', nullHouse: 'ఇంటి నంబర్లు లేవు', nullAge: 'వయస్సులు లేవు', nullEpic: 'EPICలు లేవు', linked: 'అనుసంధానమైన ప్రామాణిక స్థానాలు', unlinked: 'అనుసంధానం కాని మూల రికార్డులు', cards: 'వెలికితీసిన / గుర్తించిన కార్డులు', reload: 'నాణ్యత డేటాను మళ్లీ లోడ్ చేయండి', unavailable: 'డేటా నాణ్యత గణాంకాలను లోడ్ చేయలేకపోయాం.' },
  ur: { unexpected: 'غیر متوقع سیریل', partial: 'جزوی طور پر اخذ شدہ صفحات', nullName: 'نام غائب', nullRelation: 'رشتے غائب', nullHouse: 'مکان نمبر غائب', nullAge: 'عمر غائب', nullEpic: 'EPIC غائب', linked: 'منسلک کینونیکل سلاٹس', unlinked: 'غیر منسلک ماخذ قطاریں', cards: 'اخذ شدہ / شناخت شدہ کارڈ', reload: 'معیار ڈیٹا دوبارہ لوڈ کریں', unavailable: 'ڈیٹا معیار میٹرکس لوڈ نہیں ہو سکے۔' },
} as const

export function DataQualityDashboard() {
  const { language, t } = useLanguage()
  const copy = COPY[language]
  const [part, setPart] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('all')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [parts, setParts] = useState<PartQuality[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const [summaryResult, partsResult] = await Promise.all([
        supabase.rpc('get_data_quality_summary' as never, {
          p_part: part ? Number(part) : null,
          p_language: sourceLanguage === 'all' ? null : sourceLanguage,
        } as never),
        supabase.rpc('get_part_language_quality' as never, {} as never),
      ])
      const summaryResponse = summaryResult as unknown as RpcResult
      const partsResponse = partsResult as unknown as RpcResult
      if (summaryResponse.error) throw summaryResponse.error
      if (partsResponse.error) throw partsResponse.error
      setSummary(((summaryResponse.data ?? []) as Summary[])[0] ?? null)
      setParts((partsResponse.data ?? []) as PartQuality[])
    } catch (loadError) {
      console.error('Data-quality query failed', loadError)
      setSummary(null)
      setParts([])
      setError(copy.unavailable)
    } finally {
      setBusy(false)
    }
  }, [copy.unavailable, part, sourceLanguage])

  useEffect(() => { void load() }, [load])

  const shownParts = useMemo(() => parts.filter((row) =>
    (!part || row.part_number === Number(part)) &&
    (sourceLanguage === 'all' || row.source_language === sourceLanguage),
  ), [part, parts, sourceLanguage])

  const number = (value: number | string | undefined) => Number(value ?? 0).toLocaleString('en-IN')
  const expected = Number(summary?.expected_slots ?? (part ? PART_TOTALS[Number(part)] : 3454))
  const extracted = Number(summary?.extracted_source_records ?? 0)
  const verified = Number(summary?.verified_logical_voters ?? 0)
  const nullTotal = Number(summary?.null_name_records ?? 0) + Number(summary?.null_relation_records ?? 0) + Number(summary?.null_house_records ?? 0) + Number(summary?.null_age_records ?? 0) + Number(summary?.null_epic_records ?? 0)

  return (
    <>
      <div className="quality-toolbar">
        <div className="quality-filter"><Filter aria-hidden="true" /><select aria-label={t('part')} value={part} onChange={(event) => setPart(event.target.value)}><option value="">{t('allSupportedParts')}</option><option>227</option><option>228</option><option>229</option><option>230</option></select><select aria-label={t('sourceLanguage')} value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}><option value="all">{t('allLanguages')}</option><option value="en">{t('englishSource')}</option><option value="te">{t('teluguSource')}</option><option value="ur">{t('urduSource')}</option></select></div>
        <button className="button secondary small" type="button" onClick={() => void load()} disabled={busy}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}{copy.reload}</button>
      </div>
      {error && <p className="error-notice" role="alert">{error}</p>}
      <div className="metric-grid">
        <MetricCard label={t('expected')} value={expected.toLocaleString('en-IN')} note={t('expectedSourceCount')} tone="positive" />
        <MetricCard label={t('extracted')} value={busy ? '—' : number(extracted)} note={sourceLanguage === 'all' ? t('allLanguages') : sourceLanguage.toUpperCase()} />
        <MetricCard label={t('verifiedMetric')} value={busy ? '—' : number(verified)} note={`${number(summary?.unverified_logical_voters)} unverified`} />
        <MetricCard label={t('reconciliationConflicts')} value={busy ? '—' : number(summary?.reconciliation_conflicts)} note={copy.unlinked} tone={Number(summary?.reconciliation_conflicts ?? 0) ? 'warning' : 'positive'} />
      </div>
      <div className="quality-layout">
        <Panel title={t('completenessByPart')} description={t('actualValuesLive')} className="part-completeness">
          <div className="part-total-list">
            {shownParts.map((row) => {
              const linked = Number(row.linked_slot_count)
              const rowExpected = Number(row.expected_slots)
              return <div key={`${row.part_number}-${row.source_language}`}><span><b>Part {row.part_number} · {row.source_language.toUpperCase()}</b><small>{linked.toLocaleString('en-IN')} / {rowExpected.toLocaleString('en-IN')}</small></span><div className="reference-bar"><i style={{ width: `${Math.min(100, rowExpected ? linked / rowExpected * 100 : 0)}%` }} /></div><span className="part-quality-detail"><small>{copy.unlinked}: {number(row.unlinked_source_count)}</small><small>{t('missingSerials')}: {number(row.missing_slot_count)}</small></span></div>
            })}
            {!busy && !shownParts.length && <p>{t('awaitingLiveData')}</p>}
          </div>
        </Panel>
        <Panel title={t('dataQualityChecks')} description={t('actualValuesLive')} className="quality-checks">
          <ul>
            <QualityLine label={t('missingSerials')} value={number(summary?.missing_serials)} warning={Number(summary?.missing_serials ?? 0) > 0} />
            <QualityLine label={t('duplicateSerials')} value={number(summary?.duplicate_serial_groups)} warning={Number(summary?.duplicate_serial_groups ?? 0) > 0} />
            <QualityLine label={copy.unexpected} value={number(summary?.unexpected_serials)} warning={Number(summary?.unexpected_serials ?? 0) > 0} />
            <QualityLine label={t('suspiciousEpics')} value={number(summary?.duplicate_epic_groups)} warning={Number(summary?.duplicate_epic_groups ?? 0) > 0} />
            <QualityLine label={t('failedPages')} value={number(summary?.failed_pages)} warning={Number(summary?.failed_pages ?? 0) > 0} />
            <QualityLine label={copy.partial} value={number(summary?.partial_pages)} warning={Number(summary?.partial_pages ?? 0) > 0} />
            <QualityLine label={t('nullRates')} value={number(nullTotal)} warning={nullTotal > 0} />
          </ul>
        </Panel>
      </div>
      <div className="quality-detail-grid">
        <Panel title={t('nullRates')}><ul className="quality-list"><li>{copy.nullName}<b>{number(summary?.null_name_records)}</b></li><li>{copy.nullRelation}<b>{number(summary?.null_relation_records)}</b></li><li>{copy.nullHouse}<b>{number(summary?.null_house_records)}</b></li><li>{copy.nullAge}<b>{number(summary?.null_age_records)}</b></li><li>{copy.nullEpic}<b>{number(summary?.null_epic_records)}</b></li></ul></Panel>
        <Panel title={t('reviewItems')}><ul className="quality-list"><li>{t('critical')}<b>{number(summary?.critical_issues)}</b></li><li>{t('needsReview')}<b>{number(summary?.needs_review_issues)}</b></li><li>{t('informational')}<b>{number(summary?.informational_issues)}</b></li><li>{copy.cards}<b>{number(summary?.extracted_voter_cards)} / {number(summary?.expected_voter_cards)}</b></li></ul></Panel>
      </div>
    </>
  )
}

function QualityLine({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return <li>{warning ? <AlertOctagon aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<span>{label}</span><b>{value}</b>{!warning && <CircleDashed className="visually-hidden" />}</li>
}
