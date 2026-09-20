'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertOctagon, BarChart3, CheckCircle2, CircleDashed, Filter, LoaderCircle, RefreshCw, ShieldAlert } from 'lucide-react'

import { buildQualityAnalytics, count, percent, type CountValue, type PartLanguageQualityInput, type QualitySummaryInput } from '../lib/data-quality/metrics'
import { createClient } from '../lib/supabase/client'
import { useLanguage } from './language-provider'
import { ReconciliationDrilldown } from './reconciliation-drilldown'
import { MetricCard, Panel } from './ui-shell'

type Summary = QualitySummaryInput
type PartQuality = PartLanguageQualityInput
type QualityView = 'overview' | 'extraction' | 'accuracy' | 'languages' | 'reconciliation' | 'revisions'

type RpcResult = { data: unknown; error: { message: string } | null }
const PART_TOTALS: Record<number, number> = { 227: 1014, 228: 973, 229: 888, 230: 579 }

const BLOCKER_LABELS = {
  en: { logical_structure_incomplete: 'Logical-voter structure incomplete', en_source_incomplete: 'English source coverage incomplete', te_source_incomplete: 'Telugu source coverage incomplete', missing_serials: 'Missing serials', duplicate_serials: 'Duplicate serials', unexpected_serials: 'Unexpected serials', duplicate_epics: 'Duplicate or suspicious EPICs', failed_pages: 'Failed pages', partial_pages: 'Partially extracted pages', reconciliation_conflicts: 'Reconciliation conflicts', critical_issues: 'Open critical issues', verification_incomplete: 'Human verification incomplete' },
  te: { logical_structure_incomplete: 'తార్కిక ఓటర్ల నిర్మాణం అసంపూర్ణం', en_source_incomplete: 'ఇంగ్లీష్ మూల కవరేజ్ అసంపూర్ణం', te_source_incomplete: 'తెలుగు మూల కవరేజ్ అసంపూర్ణం', missing_serials: 'లేని క్రమ సంఖ్యలు', duplicate_serials: 'నకిలీ క్రమ సంఖ్యలు', unexpected_serials: 'అనుకోని క్రమ సంఖ్యలు', duplicate_epics: 'నకిలీ లేదా అనుమానాస్పద EPICలు', failed_pages: 'విఫలమైన పేజీలు', partial_pages: 'పాక్షికంగా వెలికితీసిన పేజీలు', reconciliation_conflicts: 'సమన్వయ విభేదాలు', critical_issues: 'తెరిచి ఉన్న కీలక సమస్యలు', verification_incomplete: 'మానవ ధృవీకరణ అసంపూర్ణం' },
  ur: { logical_structure_incomplete: 'منطقی ووٹر ساخت نامکمل', en_source_incomplete: 'انگریزی ماخذ کوریج نامکمل', te_source_incomplete: 'تلگو ماخذ کوریج نامکمل', missing_serials: 'سیریل غائب', duplicate_serials: 'نقل سیریل', unexpected_serials: 'غیر متوقع سیریل', duplicate_epics: 'نقل یا مشتبہ EPIC', failed_pages: 'ناکام صفحات', partial_pages: 'جزوی طور پر اخذ شدہ صفحات', reconciliation_conflicts: 'مصالحتی تضادات', critical_issues: 'کھلے سنگین مسائل', verification_incomplete: 'انسانی تصدیق نامکمل' },
} as const

const COPY = {
  en: { unexpected: 'Unexpected serials', partial: 'Partially extracted pages', nullName: 'Missing names', nullRelation: 'Missing relations', nullHouse: 'Missing house numbers', nullAge: 'Missing ages', nullEpic: 'Missing EPICs', linked: 'Linked canonical slots', unlinked: 'Unlinked source rows', unverified: 'unverified', cards: 'Cards extracted / detected', reload: 'Reload quality data', unavailable: 'Unable to load data-quality metrics.', allViews: 'Overview', coverageView: 'Language coverage', issuesView: 'Review backlog', fieldsView: 'Missing fields', goldenTitle: 'Golden Revision readiness', goldenReady: 'All deterministic release gates are satisfied.', goldenBlocked: 'Release remains blocked by the checks shown below.', blockers: 'open gate(s)', ocrTitle: 'Measured OCR accuracy', ocrUnavailable: 'No real OCR accuracy is displayed because the authorized human-verified GOLD benchmark is not available.', sourceRepresentations: 'Source representations', notExtraVoters: 'English and Telugu rows are linked representations; they do not increase the logical voter total.' },
  te: { unexpected: 'అనుకోని క్రమ సంఖ్యలు', partial: 'పాక్షికంగా వెలికితీసిన పేజీలు', nullName: 'పేర్లు లేవు', nullRelation: 'బంధాలు లేవు', nullHouse: 'ఇంటి నంబర్లు లేవు', nullAge: 'వయస్సులు లేవు', nullEpic: 'EPICలు లేవు', linked: 'అనుసంధానమైన ప్రామాణిక స్థానాలు', unlinked: 'అనుసంధానం కాని మూల రికార్డులు', unverified: 'ధృవీకరించనివి', cards: 'వెలికితీసిన / గుర్తించిన కార్డులు', reload: 'నాణ్యత డేటాను మళ్లీ లోడ్ చేయండి', unavailable: 'డేటా నాణ్యత గణాంకాలను లోడ్ చేయలేకపోయాం.', allViews: 'సమగ్ర వీక్షణ', coverageView: 'భాషా కవరేజ్', issuesView: 'సమీక్ష పెండింగ్', fieldsView: 'లేని ఫీల్డులు', goldenTitle: 'గోల్డెన్ రివిజన్ సిద్ధత', goldenReady: 'అన్ని నిర్ణీత విడుదల తనిఖీలు పూర్తయ్యాయి.', goldenBlocked: 'క్రింద చూపిన తనిఖీల వల్ల విడుదల ఇంకా నిలిపివేయబడింది.', blockers: 'తెరిచి ఉన్న తనిఖీలు', ocrTitle: 'కొలిచిన OCR ఖచ్చితత్వం', ocrUnavailable: 'అధీకృత మానవ-ధృవీకరించిన GOLD బెంచ్‌మార్క్ లేకపోవడం వల్ల నిజమైన OCR ఖచ్చితత్వం చూపబడదు.', sourceRepresentations: 'మూల భాషా ప్రతినిధ్యాలు', notExtraVoters: 'ఇంగ్లీష్, తెలుగు వరుసలు అనుసంధానమైన ప్రతినిధ్యాలు మాత్రమే; అవి ప్రత్యేక ఓటర్ల సంఖ్యను పెంచవు.' },
  ur: { unexpected: 'غیر متوقع سیریل', partial: 'جزوی طور پر اخذ شدہ صفحات', nullName: 'نام غائب', nullRelation: 'رشتے غائب', nullHouse: 'مکان نمبر غائب', nullAge: 'عمر غائب', nullEpic: 'EPIC غائب', linked: 'منسلک کینونیکل سلاٹس', unlinked: 'غیر منسلک ماخذ قطاریں', unverified: 'غیر تصدیق شدہ', cards: 'اخذ شدہ / شناخت شدہ کارڈ', reload: 'معیار ڈیٹا دوبارہ لوڈ کریں', unavailable: 'ڈیٹا معیار میٹرکس لوڈ نہیں ہو سکے۔', allViews: 'مجموعی جائزہ', coverageView: 'زبان کوریج', issuesView: 'جائزہ بیک لاگ', fieldsView: 'غائب فیلڈز', goldenTitle: 'گولڈن ریویژن تیاری', goldenReady: 'تمام مقررہ ریلیز جانچ مکمل ہیں۔', goldenBlocked: 'ذیل کی کھلی جانچوں کی وجہ سے ریلیز ابھی مسدود ہے۔', blockers: 'کھلی جانچ', ocrTitle: 'پیمائش شدہ OCR درستگی', ocrUnavailable: 'مجاز انسانی تصدیق شدہ GOLD بینچ مارک نہ ہونے کی وجہ سے حقیقی OCR درستگی نہیں دکھائی جاتی۔', sourceRepresentations: 'ماخذ زبان نمائندگی', notExtraVoters: 'انگریزی اور تلگو قطاریں منسلک نمائندگی ہیں؛ یہ منطقی ووٹرز کی تعداد نہیں بڑھاتیں۔' },
} as const

export function DataQualityDashboard() {
  const { language, t } = useLanguage()
  const copy = COPY[language]
  const revisionViewLabel = { en: 'Revision & reconciliation', te: 'రివిజన్ & సమన్వయం', ur: 'نظرثانی اور مفاہمت' }[language]
  const blockerLabels = BLOCKER_LABELS[language]
  const [part, setPart] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('all')
  const [qualityView, setQualityView] = useState<QualityView>('overview')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [overallSummary, setOverallSummary] = useState<Summary | null>(null)
  const [parts, setParts] = useState<PartQuality[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const [summaryResult, overallResult, partsResult] = await Promise.all([
        supabase.rpc('get_data_quality_summary' as never, {
          p_part: part ? Number(part) : null,
          p_language: sourceLanguage === 'all' ? null : sourceLanguage,
        } as never),
        supabase.rpc('get_data_quality_summary' as never, {
          p_part: part ? Number(part) : null,
          p_language: null,
        } as never),
        supabase.rpc('get_part_language_quality' as never, {} as never),
      ])
      const summaryResponse = summaryResult as unknown as RpcResult
      const overallResponse = overallResult as unknown as RpcResult
      const partsResponse = partsResult as unknown as RpcResult
      if (summaryResponse.error) throw summaryResponse.error
      if (overallResponse.error) throw overallResponse.error
      if (partsResponse.error) throw partsResponse.error
      setSummary(((summaryResponse.data ?? []) as Summary[])[0] ?? null)
      setOverallSummary(((overallResponse.data ?? []) as Summary[])[0] ?? null)
      setParts((partsResponse.data ?? []) as PartQuality[])
    } catch (loadError) {
      console.error('Data-quality query failed', loadError)
      setSummary(null)
      setOverallSummary(null)
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
  const readinessParts = useMemo(
    () => parts.filter((row) => !part || row.part_number === Number(part)),
    [part, parts],
  )
  const analytics = useMemo(
    () => buildQualityAnalytics(overallSummary, readinessParts),
    [overallSummary, readinessParts],
  )
  const scopedAnalytics = useMemo(
    () => buildQualityAnalytics(summary, shownParts),
    [shownParts, summary],
  )

  const number = (value: CountValue) => Number(value ?? 0).toLocaleString('en-IN')
  const expected = Number(overallSummary?.expected_slots ?? (part ? PART_TOTALS[Number(part)] : 3454))
  const extracted = count(summary?.extracted_source_records)
  const verified = count(overallSummary?.verified_logical_voters)
  const nullTotal = scopedAnalytics.missingFieldRates.reduce((total, row) => total + row.value, 0)
  const showCoverage = qualityView === 'overview' || qualityView === 'languages'
  const showIssues = qualityView === 'overview' || qualityView === 'extraction'
  const showFields = qualityView === 'overview' || qualityView === 'accuracy'
  const extractionCoverage = percent(overallSummary?.active_logical_voters, expected)
  const languageCoverage = analytics.sourceCoverage.length ? Math.min(...analytics.sourceCoverage.map((row) => row.percent)) : 0

  return (
    <>
      <nav className="insights-tabs" aria-label="Data insights sections">{(['overview', 'extraction', 'accuracy', 'languages', 'reconciliation', 'revisions'] as QualityView[]).map((view) => <button key={view} type="button" className={qualityView === view ? 'active' : ''} onClick={() => setQualityView(view)}>{view[0].toUpperCase() + view.slice(1)}</button>)}</nav>
      <div className="quality-toolbar">
        <div className="quality-filter"><Filter aria-hidden="true" /><select aria-label="Revision" disabled><option>Current revision</option></select><select aria-label={t('part')} value={part} onChange={(event) => setPart(event.target.value)}><option value="">{t('allSupportedParts')}</option><option>227</option><option>228</option><option>229</option><option>230</option></select><select aria-label={t('sourceLanguage')} value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}><option value="all">{t('allLanguages')}</option><option value="en">{t('englishSource')}</option><option value="te">{t('teluguSource')}</option><option value="ur">{t('urduSource')}</option></select></div>
        <button className="button secondary small" type="button" onClick={() => void load()} disabled={busy}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}{copy.reload}</button>
      </div>
      {error && <p className="error-notice" role="alert">{error}</p>}
      <div className="metric-grid">
        <MetricCard label="Total logical voters" value={busy ? '—' : number(overallSummary?.active_logical_voters)} note={`${expected.toLocaleString('en-IN')} expected`} tone={count(overallSummary?.active_logical_voters) === expected ? 'positive' : 'warning'} />
        <MetricCard label={t('verifiedMetric')} value={busy ? '—' : number(verified)} note={`${number(overallSummary?.unverified_logical_voters)} ${copy.unverified}`} />
        <MetricCard label="Needs review" value={busy ? '—' : number(overallSummary?.needs_review_issues)} note="Open structured Review issues" tone={count(overallSummary?.needs_review_issues) ? 'warning' : 'positive'} />
        <MetricCard label="Unresolved critical" value={busy ? '—' : number(overallSummary?.critical_issues)} note="Golden Revision blocker" tone={count(overallSummary?.critical_issues) ? 'warning' : 'positive'} />
        <MetricCard label="Extraction coverage" value={busy ? '—' : `${extractionCoverage}%`} note={`${number(overallSummary?.active_logical_voters)} / ${expected.toLocaleString('en-IN')} logical slots`} />
        <MetricCard label="Language coverage" value={busy ? '—' : `${languageCoverage}%`} note="Minimum of EN and TE linked coverage" />
      </div>
      {!busy && <section className={`quality-readiness ${analytics.goldenRevisionBlockers.length ? 'blocked' : 'ready'}`} role="status">
        {analytics.goldenRevisionBlockers.length ? <ShieldAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
        <div><h2>{copy.goldenTitle}</h2><p>{analytics.goldenRevisionBlockers.length ? copy.goldenBlocked : copy.goldenReady}</p><strong>{number(analytics.verifiedLogicalVoters)} / {number(analytics.expectedLogicalVoters)} · {analytics.verifiedPercent}%</strong>{!!analytics.goldenRevisionBlockers.length && <ul className="quality-blockers">{analytics.goldenRevisionBlockers.map((blocker) => <li key={blocker}>{blockerLabels[blocker as keyof typeof blockerLabels] ?? blocker.replaceAll('_', ' ')}</li>)}</ul>}</div>
        {!!analytics.goldenRevisionBlockers.length && <span>{analytics.goldenRevisionBlockers.length} {copy.blockers}</span>}
      </section>}
      {showCoverage && <div className="quality-layout">
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
        <Panel title={copy.sourceRepresentations} description={copy.notExtraVoters}>
          <div className="quality-bars">
            {analytics.sourceCoverage.map((row) => <QualityBarRow key={row.key} label={row.key.toUpperCase()} value={`${number(row.value)} / ${number(row.total)}`} percent={row.percent} />)}
          </div>
        </Panel>
      </div>}
      {showIssues && <div className="quality-layout">
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
        <Panel title={t('reviewItems')}>
          <div className="quality-bars">
            {scopedAnalytics.issueDistribution.map((row) => <QualityBarRow key={row.key} label={row.key === 'critical' ? t('critical') : row.key === 'needs_review' ? t('needsReview') : t('informational')} value={number(row.value)} percent={row.percent} tone={row.key === 'critical' ? 'danger' : row.key === 'needs_review' ? 'warning' : 'default'} />)}
          </div>
          <p className="quality-card-count">{copy.cards}<b>{number(summary?.extracted_voter_cards)} / {number(summary?.expected_voter_cards)}</b></p>
        </Panel>
      </div>}
      {showFields && <div className="quality-detail-grid">
        <Panel title={t('nullRates')}>
          <div className="quality-bars">{scopedAnalytics.missingFieldRates.map((row) => <QualityBarRow key={row.key} label={row.key === 'name' ? copy.nullName : row.key === 'relation' ? copy.nullRelation : row.key === 'house' ? copy.nullHouse : row.key === 'age' ? copy.nullAge : copy.nullEpic} value={number(row.value)} percent={row.percent} tone={row.value ? 'warning' : 'default'} />)}</div>
        </Panel>
        <Panel title={copy.ocrTitle}><div className="quality-evidence-note"><BarChart3 aria-hidden="true" /><p>{copy.ocrUnavailable}</p></div></Panel>
      </div>}
      {qualityView === 'extraction' && <Panel title="Extraction pipeline" description="Live database counts; no OCR accuracy is inferred."><div className="quality-bars"><QualityBarRow label="Source records extracted" value={number(extracted)} percent={100} /><QualityBarRow label="Cards extracted / detected" value={`${number(summary?.extracted_voter_cards)} / ${number(summary?.expected_voter_cards)}`} percent={Number(summary?.expected_voter_cards) ? Math.round(Number(summary?.extracted_voter_cards) / Number(summary?.expected_voter_cards) * 1000) / 10 : 0} /><QualityBarRow label="Source records reconciled" value={number(summary?.linked_source_records)} percent={Number(extracted) ? Math.round(Number(summary?.linked_source_records) / Number(extracted) * 1000) / 10 : 0} /><QualityBarRow label="Verified logical voters" value={number(verified)} percent={expected ? Math.round(verified / expected * 1000) / 10 : 0} /></div></Panel>}
      {(qualityView === 'overview' || qualityView === 'reconciliation') && <ReconciliationDrilldown part={part} />}
      {qualityView === 'revisions' && <Panel title={revisionViewLabel} description="Added, removed, changed and unchanged counts require two valid revisions."><div className="quality-evidence-note"><CircleDashed aria-hidden="true" /><p>Revision comparison will be available when another electoral roll revision is imported.</p></div></Panel>}
    </>
  )
}

function QualityBarRow({ label, value, percent, tone = 'default' }: { label: string; value: string; percent: number; tone?: 'default' | 'warning' | 'danger' }) {
  return <div className="quality-bar-row"><span><b>{label}</b><small>{value} · {percent}%</small></span><div className={`reference-bar ${tone}`} aria-label={`${label}: ${percent}%`}><i style={{ width: `${percent}%` }} /></div></div>
}

function QualityLine({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return <li>{warning ? <AlertOctagon aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<span>{label}</span><b>{value}</b>{!warning && <CircleDashed className="visually-hidden" />}</li>
}

