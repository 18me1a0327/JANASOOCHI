'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, CircleAlert, Filter, LoaderCircle, RefreshCw } from 'lucide-react'

import { EXPECTED_LOGICAL_TOTAL, safePercent } from '../lib/data-insights/metrics'
import { createClient } from '../lib/supabase/client'
import { useLanguage, type UiLanguage } from './language-provider'
import { EmptyState, MetricCard, PageHeader, Panel } from './ui-shell'

type View = 'overview' | 'parts' | 'gender' | 'age' | 'households' | 'indicators' | 'revisions'
type CountValue = number | string | null
type PartRow = {
  part: number
  expected: CountValue
  available: CountValue
  male: CountValue
  female: CountValue
  other_unknown: CountValue
  average_age: CountValue
  youngest_age: CountValue
  oldest_age: CountValue
  house_groups: CountValue
  verified: CountValue
  needs_review: CountValue
}
type Bucket = { key: string; label: string; count: CountValue }
type InsightsRow = {
  expected_total: CountValue
  available_total: CountValue
  male_total: CountValue
  female_total: CountValue
  other_total: CountValue
  unknown_gender_total: CountValue
  valid_age_count: CountValue
  missing_age_count: CountValue
  invalid_age_count: CountValue
  average_age: CountValue
  median_age: CountValue
  youngest_age: CountValue
  oldest_age: CountValue
  house_group_count: CountValue
  single_house_groups: CountValue
  two_house_groups: CountValue
  three_four_house_groups: CountValue
  five_six_house_groups: CountValue
  seven_plus_house_groups: CountValue
  largest_house_group: CountValue
  average_voters_per_house: CountValue
  verified_total: CountValue
  needs_review_total: CountValue
  unverified_total: CountValue
  critical_issue_count: CountValue
  duplicate_epic_groups: CountValue
  missing_gender_count: CountValue
  missing_house_count: CountValue
  missing_epic_count: CountValue
  missing_serial_count: CountValue
  unexpected_serial_count: CountValue
  duplicate_part_serial_groups: CountValue
  parts: PartRow[] | null
  age_groups: Bucket[] | null
  house_groups: Bucket[] | null
  revision_count: CountValue
}

const COPY = {
  en: {
    eyebrow: 'CURRENT ELECTORAL ROLL · PARTS 227–230', title: 'Voter analytics', lead: 'Demographic and register insights from canonical logical voters. English and Telugu source editions are never counted as additional people.',
    tabs: ['Overview', 'Parts', 'Gender', 'Age', 'Households', 'Data indicators', 'Revision comparison'], currentRevision: 'Current revision', revision: 'Revision', allParts: 'All Parts', allGenders: 'All genders', male: 'Male', female: 'Female', otherUnknown: 'Other / Unknown', allAges: 'All ages', refresh: 'Refresh analytics', loading: 'Loading voter analytics…', unverified: 'unverified', filtersAria: 'Voter analytics filters',
    expected: 'Expected logical voters', available: 'Available canonical records', averageAge: 'Average age', houseGroups: 'House-number groups', verified: 'Verified voters', needsReview: 'Needs review', critical: 'Unresolved critical', youngestOldest: 'Youngest / oldest',
    partTitle: 'Voters by Part', partHelp: 'Expected is the official register structure. Available is the filtered canonical source population.', genderTitle: 'Gender distribution', genderHelp: 'Unknown values remain visible and are never reassigned to Male or Female.', ageTitle: 'Age distribution', ageHelp: 'Average and median use valid recorded ages from 18 through 125 only.', houseTitle: 'Voters per house-number group', houseHelp: 'Matching house numbers are aggregate groups only; no family relationship is inferred.', summaryTitle: 'Part summary',
    expectedLabel: 'Expected', availableLabel: 'Available', otherUnknownShort: 'Other / unknown', medianAge: 'Median age', validAges: 'Known valid ages', missingInvalid: 'Missing / invalid age', largestGroup: 'Largest group', voters: 'voters', averagePerGroup: 'Average voters per group',
    indicatorsTitle: 'Voter-data indicators', indicatorsHelp: 'Indicators identify records requiring attention; they are not findings of fraud or invalid registration.', missingGender: 'Missing / unknown gender', missingAge: 'Missing age', invalidAge: 'Invalid / out-of-range age', missingHouse: 'Missing house number', missingEpic: 'Missing EPIC', duplicateEpic: 'Duplicate EPIC indicators', missingSerial: 'Missing canonical source slots', unexpectedSerial: 'Unexpected source serials', duplicateSerial: 'Duplicate Part + Serial indicators',
    revisionsTitle: 'Revision comparison', revisionEmpty: 'Another electoral-roll revision is required for comparison.', revisionHelp: 'Import a later or earlier electoral-roll revision to view added, removed, changed and unchanged voter records.',
    noData: 'No voter records available for this filter.', noAge: 'No known age values for this selection.', error: 'Unable to load voter analytics. Please try again.', actualData: 'Real canonical database values', expectedGlobal: 'Official structural target', part: 'Part', unknown: 'Unknown', total: 'Total', filtersNote: 'Expected register totals remain structural; demographic filters apply to available canonical records.',
  },
  te: {
    eyebrow: 'ప్రస్తుత ఓటరు జాబితా · భాగాలు 227–230', title: 'ఓటరు విశ్లేషణలు', lead: 'ప్రామాణిక తార్కిక ఓటర్ల నుంచి జనాభా మరియు రిజిస్టర్ గణాంకాలు. ఇంగ్లీష్, తెలుగు మూల సంచికలు అదనపు వ్యక్తులుగా లెక్కించబడవు.',
    tabs: ['సమగ్ర వీక్షణ', 'భాగాలు', 'లింగం', 'వయస్సు', 'ఇంటి నంబర్లు', 'డేటా సూచికలు', 'రివిజన్ పోలిక'], currentRevision: 'ప్రస్తుత రివిజన్', revision: 'రివిజన్', allParts: 'అన్ని భాగాలు', allGenders: 'అన్ని లింగాలు', male: 'పురుషులు', female: 'స్త్రీలు', otherUnknown: 'ఇతర / తెలియదు', allAges: 'అన్ని వయస్సులు', refresh: 'విశ్లేషణలను రిఫ్రెష్ చేయండి', loading: 'ఓటరు విశ్లేషణలు లోడ్ అవుతున్నాయి…', unverified: 'ధృవీకరించనివి', filtersAria: 'ఓటరు విశ్లేషణ ఫిల్టర్లు',
    expected: 'అంచనా తార్కిక ఓటర్లు', available: 'అందుబాటులోని ప్రామాణిక రికార్డులు', averageAge: 'సగటు వయస్సు', houseGroups: 'ఇంటి నంబర్ సమూహాలు', verified: 'ధృవీకరించిన ఓటర్లు', needsReview: 'సమీక్ష అవసరం', critical: 'పరిష్కరించని కీలక సమస్యలు', youngestOldest: 'కనిష్ఠ / గరిష్ఠ వయస్సు',
    partTitle: 'భాగం వారీ ఓటర్లు', partHelp: 'అంచనా అధికారిక రిజిస్టర్ నిర్మాణం. అందుబాటులో ఉన్నది ఫిల్టర్ చేసిన ప్రామాణిక మూల జనాభా.', genderTitle: 'లింగ పంపిణీ', genderHelp: 'తెలియని విలువలు కనిపిస్తాయి; వాటిని పురుషులు లేదా స్త్రీలుగా మార్చము.', ageTitle: 'వయస్సు పంపిణీ', ageHelp: 'సగటు, మధ్య విలువ 18 నుంచి 125 వరకు చెల్లుబాటు అయ్యే వయస్సులను మాత్రమే ఉపయోగిస్తాయి.', houseTitle: 'ఇంటి నంబర్ సమూహానికి ఓటర్లు', houseHelp: 'ఒకే ఇంటి నంబర్ కేవలం గణాంక సమూహం; కుటుంబ బంధం ఊహించబడదు.', summaryTitle: 'భాగం సారాంశం',
    expectedLabel: 'అంచనా', availableLabel: 'అందుబాటులో', otherUnknownShort: 'ఇతర / తెలియదు', medianAge: 'మధ్య వయస్సు', validAges: 'తెలిసిన చెల్లుబాటు వయస్సులు', missingInvalid: 'లేని / చెల్లని వయస్సు', largestGroup: 'అతి పెద్ద సమూహం', voters: 'ఓటర్లు', averagePerGroup: 'సమూహానికి సగటు ఓటర్లు',
    indicatorsTitle: 'ఓటరు డేటా సూచికలు', indicatorsHelp: 'సూచికలు సమీక్ష అవసరమైన రికార్డులను చూపుతాయి; అవి మోసం లేదా చెల్లని నమోదు నిర్ధారణలు కావు.', missingGender: 'లేని / తెలియని లింగం', missingAge: 'లేని వయస్సు', invalidAge: 'చెల్లని వయస్సు', missingHouse: 'లేని ఇంటి నంబర్', missingEpic: 'లేని EPIC', duplicateEpic: 'నకలు EPIC సూచికలు', missingSerial: 'లేని ప్రామాణిక మూల స్థానాలు', unexpectedSerial: 'అనుకోని మూల క్రమ సంఖ్యలు', duplicateSerial: 'నకలు భాగం + క్రమ సంఖ్య సూచికలు',
    revisionsTitle: 'రివిజన్ పోలిక', revisionEmpty: 'పోలిక కోసం మరో ఓటరు జాబితా రివిజన్ అవసరం.', revisionHelp: 'జోడించిన, తొలగించిన, మార్చిన మరియు మారని ఓటర్లను చూడటానికి తరువాతి లేదా మునుపటి రివిజన్‌ను దిగుమతి చేయండి.',
    noData: 'ఈ ఫిల్టర్‌కు ఓటరు రికార్డులు లేవు.', noAge: 'ఈ ఎంపికకు తెలిసిన వయస్సు విలువలు లేవు.', error: 'ఓటరు విశ్లేషణలను లోడ్ చేయలేకపోయాం. మళ్లీ ప్రయత్నించండి.', actualData: 'నిజమైన ప్రామాణిక డేటాబేస్ విలువలు', expectedGlobal: 'అధికారిక నిర్మాణ లక్ష్యం', part: 'భాగం', unknown: 'తెలియదు', total: 'మొత్తం', filtersNote: 'రిజిస్టర్ అంచనా నిర్మాణాత్మకం; జనాభా ఫిల్టర్లు అందుబాటులోని ప్రామాణిక రికార్డులకు వర్తిస్తాయి.',
  },
  ur: {
    eyebrow: 'موجودہ انتخابی فہرست · حصے ۲۲۷–۲۳۰', title: 'ووٹر تجزیات', lead: 'کینونیکل منطقی ووٹرز سے آبادی اور رجسٹر کے اعداد۔ انگریزی اور تلگو ماخذ نسخے اضافی افراد کے طور پر شمار نہیں ہوتے۔',
    tabs: ['مجموعی جائزہ', 'حصے', 'جنس', 'عمر', 'مکان نمبر', 'ڈیٹا اشارے', 'نظرثانی موازنہ'], currentRevision: 'موجودہ نظرثانی', revision: 'نظرثانی', allParts: 'تمام حصے', allGenders: 'تمام اجناس', male: 'مرد', female: 'خواتین', otherUnknown: 'دیگر / نامعلوم', allAges: 'تمام عمریں', refresh: 'تجزیات تازہ کریں', loading: 'ووٹر تجزیات لوڈ ہو رہے ہیں…', unverified: 'غیر تصدیق شدہ', filtersAria: 'ووٹر تجزیات فلٹر',
    expected: 'متوقع منطقی ووٹرز', available: 'دستیاب کینونیکل ریکارڈ', averageAge: 'اوسط عمر', houseGroups: 'مکان نمبر گروپ', verified: 'تصدیق شدہ ووٹرز', needsReview: 'جائزہ درکار', critical: 'غیر حل شدہ سنگین', youngestOldest: 'کم ترین / زیادہ ترین عمر',
    partTitle: 'حصہ وار ووٹرز', partHelp: 'متوقع سرکاری رجسٹر ساخت ہے۔ دستیاب فلٹر شدہ کینونیکل ماخذ آبادی ہے۔', genderTitle: 'جنس کی تقسیم', genderHelp: 'نامعلوم قدریں نظر آتی ہیں اور مرد یا عورت میں شامل نہیں کی جاتیں۔', ageTitle: 'عمر کی تقسیم', ageHelp: 'اوسط اور میڈین صرف 18 سے 125 تک درست درج عمر استعمال کرتے ہیں۔', houseTitle: 'مکان نمبر گروپ میں ووٹرز', houseHelp: 'مشترک مکان نمبر صرف مجموعی گروپ ہیں؛ خاندانی تعلق اخذ نہیں کیا جاتا۔', summaryTitle: 'حصہ خلاصہ',
    expectedLabel: 'متوقع', availableLabel: 'دستیاب', otherUnknownShort: 'دیگر / نامعلوم', medianAge: 'درمیانی عمر', validAges: 'معلوم درست عمریں', missingInvalid: 'غائب / غلط عمر', largestGroup: 'سب سے بڑا گروپ', voters: 'ووٹرز', averagePerGroup: 'فی گروپ اوسط ووٹرز',
    indicatorsTitle: 'ووٹر ڈیٹا اشارے', indicatorsHelp: 'اشارے جائزے کے قابل ریکارڈ دکھاتے ہیں؛ یہ دھوکہ یا غلط رجسٹریشن کا فیصلہ نہیں۔', missingGender: 'غائب / نامعلوم جنس', missingAge: 'غائب عمر', invalidAge: 'غلط عمر', missingHouse: 'غائب مکان نمبر', missingEpic: 'غائب EPIC', duplicateEpic: 'نقل EPIC اشارے', missingSerial: 'غائب کینونیکل ماخذ سلاٹس', unexpectedSerial: 'غیر متوقع ماخذ سیریل', duplicateSerial: 'نقل حصہ + سیریل اشارے',
    revisionsTitle: 'نظرثانی موازنہ', revisionEmpty: 'موازنہ کے لیے ایک اور انتخابی فہرست نظرثانی درکار ہے۔', revisionHelp: 'شامل، ہٹائے، تبدیل اور غیر تبدیل شدہ ووٹر دیکھنے کے لیے نئی یا پرانی نظرثانی درآمد کریں۔',
    noData: 'اس فلٹر کے لیے ووٹر ریکارڈ دستیاب نہیں۔', noAge: 'اس انتخاب کے لیے معلوم عمر دستیاب نہیں۔', error: 'ووٹر تجزیات لوڈ نہیں ہو سکے۔ دوبارہ کوشش کریں۔', actualData: 'حقیقی کینونیکل ڈیٹابیس قدریں', expectedGlobal: 'سرکاری ساختی ہدف', part: 'حصہ', unknown: 'نامعلوم', total: 'کل', filtersNote: 'متوقع رجسٹر اعداد ساختی رہتے ہیں؛ آبادی فلٹر دستیاب کینونیکل ریکارڈ پر لاگو ہوتے ہیں۔',
  },
} as const

const VIEW_KEYS: View[] = ['overview', 'parts', 'gender', 'age', 'households', 'indicators', 'revisions']

function numeric(value: CountValue | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function format(value: CountValue) {
  return numeric(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

export function DataInsightsDashboard() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const [view, setView] = useState<View>('overview')
  const [part, setPart] = useState('')
  const [gender, setGender] = useState('')
  const [age, setAge] = useState('')
  const [data, setData] = useState<InsightsRow | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const result = await createClient().rpc('get_voter_insights_v1' as never, {
        p_part: part ? Number(part) : null,
        p_gender: gender || null,
        p_age_group: age || null,
      } as never) as unknown as { data: InsightsRow[] | null; error: { message: string } | null }
      if (result.error) throw result.error
      setData(result.data?.[0] ?? null)
    } catch (loadError) {
      console.error('Voter analytics query failed', loadError)
      setData(null)
      setError(copy.error)
    } finally {
      setBusy(false)
    }
  }, [age, copy.error, gender, part])

  useEffect(() => { void load() }, [load])

  const parts = Array.isArray(data?.parts) ? data.parts : []
  const ages = Array.isArray(data?.age_groups) ? data.age_groups : []
  const houses = Array.isArray(data?.house_groups) ? data.house_groups : []
  const expected = numeric(data?.expected_total) || (part ? ({ 227: 1014, 228: 973, 229: 888, 230: 579 } as Record<string, number>)[part] : EXPECTED_LOGICAL_TOTAL)
  const available = numeric(data?.available_total)
  const knownGender = numeric(data?.male_total) + numeric(data?.female_total) + numeric(data?.other_total) + numeric(data?.unknown_gender_total)
  const maxPart = Math.max(1, ...parts.map((row) => Math.max(numeric(row.expected), numeric(row.available))))
  const maxAge = Math.max(1, ...ages.map((row) => numeric(row.count)))
  const maxHouse = Math.max(1, ...houses.map((row) => numeric(row.count)))
  const filterActive = Boolean(part || gender || age)

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.lead} />
      <nav className="insights-tabs" aria-label={copy.title}>
        {VIEW_KEYS.map((key, index) => <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => setView(key)}>{copy.tabs[index]}</button>)}
      </nav>
      <section className="analytics-filter-bar" aria-label={copy.filtersAria}>
        <Filter aria-hidden="true" />
        <label><span>{copy.revision}</span><select disabled><option>{copy.currentRevision}</option></select></label>
        <label><span>{copy.part}</span><select value={part} onChange={(event) => setPart(event.target.value)}><option value="">{copy.allParts}</option><option>227</option><option>228</option><option>229</option><option>230</option></select></label>
        <label><span>{copy.tabs[2]}</span><select value={gender} onChange={(event) => setGender(event.target.value)}><option value="">{copy.allGenders}</option><option value="male">{copy.male}</option><option value="female">{copy.female}</option><option value="other_unknown">{copy.otherUnknown}</option></select></label>
        <label><span>{copy.tabs[3]}</span><select value={age} onChange={(event) => setAge(event.target.value)}><option value="">{copy.allAges}</option>{[['18_25','18–25'],['26_35','26–35'],['36_45','36–45'],['46_60','46–60'],['61_75','61–75'],['76_plus','76+'],['unknown_invalid',copy.missingInvalid]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="button secondary small" type="button" onClick={() => void load()} disabled={busy}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}{copy.refresh}</button>
        <p>{copy.filtersNote}{filterActive ? ` · ${copy.actualData}` : ''}</p>
      </section>

      {error && <p className="error-notice" role="alert">{error}</p>}
      {busy && <EmptyState title={copy.title} description={copy.loading} loading />}
      {!busy && !error && !data && <EmptyState title={copy.noData} description={copy.actualData} />}
      {!busy && data && <>
        {(view === 'overview' || view === 'parts') && <>
          <div className="analytics-kpi-grid">
            <MetricCard label={copy.expected} value={format(expected)} note={copy.expectedGlobal} />
            <MetricCard label={copy.available} value={format(available)} note={`${safePercent(available, expected)}% ${copy.availableLabel.toLocaleLowerCase()}`} tone={available === expected ? 'positive' : 'warning'} />
            <MetricCard label={copy.averageAge} value={data.average_age == null ? '—' : format(data.average_age)} note={`${format(data.valid_age_count)} ${copy.validAges.toLocaleLowerCase()}`} />
            <MetricCard label={copy.houseGroups} value={format(data.house_group_count)} note={copy.houseHelp} />
            <MetricCard label={copy.verified} value={format(data.verified_total)} note={`${format(data.unverified_total)} ${copy.unverified}`} tone={numeric(data.verified_total) === available && available > 0 ? 'positive' : 'warning'} />
            <MetricCard label={copy.needsReview} value={format(data.needs_review_total)} note={copy.actualData} tone={numeric(data.needs_review_total) ? 'warning' : 'positive'} />
            <MetricCard label={copy.critical} value={format(data.critical_issue_count)} note={copy.actualData} tone={numeric(data.critical_issue_count) ? 'warning' : 'positive'} />
            <MetricCard label={copy.youngestOldest} value={data.youngest_age == null ? '—' : `${format(data.youngest_age)} / ${format(data.oldest_age)}`} note={copy.ageHelp} />
          </div>
          <div className="analytics-two-column">
            <Panel title={copy.partTitle} description={copy.partHelp}>
              <div className="comparison-chart">
                {parts.map((row) => <div className="comparison-row" key={row.part} title={`${copy.part} ${row.part} · ${copy.expectedLabel}: ${format(row.expected)} · ${copy.availableLabel}: ${format(row.available)}`}>
                  <strong>{copy.part} {row.part}</strong><span><i className="expected" style={{ width: `${numeric(row.expected) / maxPart * 100}%` }} /><i className="available" style={{ width: `${numeric(row.available) / maxPart * 100}%` }} /></span><small>{format(row.available)} / {format(row.expected)}</small>
                </div>)}
              </div>
              {!parts.length && <EmptyState title={copy.noData} description={copy.actualData} />}
            </Panel>
            <Panel title={copy.genderTitle} description={copy.genderHelp}>
              <DonutChart label={copy.genderTitle} rows={[
                [copy.male, numeric(data.male_total), 'male'], [copy.female, numeric(data.female_total), 'female'], [copy.otherUnknownShort, numeric(data.other_total), 'other'], [copy.unknown, numeric(data.unknown_gender_total), 'unknown'],
              ]} total={knownGender} totalLabel={copy.total} />
            </Panel>
          </div>
          <PartSummary parts={parts} copy={copy} />
        </>}

        {view === 'gender' && <div className="analytics-two-column">
          <Panel title={copy.genderTitle} description={copy.genderHelp}><DonutChart label={copy.genderTitle} rows={[[copy.male,numeric(data.male_total),'male'],[copy.female,numeric(data.female_total),'female'],[copy.otherUnknownShort,numeric(data.other_total),'other'],[copy.unknown,numeric(data.unknown_gender_total),'unknown']]} total={knownGender} totalLabel={copy.total} /></Panel>
          <Panel title={`${copy.genderTitle} · ${copy.part}`} description={copy.actualData}><div className="gender-by-part">{parts.map((row) => <div key={row.part}><strong>{copy.part} {row.part}</strong><span title={`${copy.male}: ${format(row.male)}`}><i className="male" style={{ width: `${safePercent(numeric(row.male), Math.max(1,numeric(row.available)))}%` }} /></span><span title={`${copy.female}: ${format(row.female)}`}><i className="female" style={{ width: `${safePercent(numeric(row.female), Math.max(1,numeric(row.available)))}%` }} /></span><span title={`${copy.otherUnknownShort}: ${format(row.other_unknown)}`}><i className="unknown" style={{ width: `${safePercent(numeric(row.other_unknown), Math.max(1,numeric(row.available)))}%` }} /></span></div>)}</div></Panel>
          <PartSummary parts={parts} copy={copy} />
        </div>}

        {view === 'age' && <div className="analytics-two-column">
          <Panel title={copy.ageTitle} description={copy.ageHelp}>{numeric(data.valid_age_count) || numeric(data.missing_age_count) || numeric(data.invalid_age_count) ? <ColumnChart label={copy.ageTitle} rows={ages.map((row) => [row.label, numeric(row.count), row.key])} max={maxAge} denominator={available} /> : <EmptyState title={copy.noAge} description={copy.ageHelp} />}</Panel>
          <Panel title={copy.ageTitle} description={copy.actualData}><div className="analytics-stat-list"><Stat label={copy.averageAge} value={data.average_age == null ? '—' : format(data.average_age)} /><Stat label={copy.medianAge} value={data.median_age == null ? '—' : format(data.median_age)} /><Stat label={copy.youngestOldest} value={data.youngest_age == null ? '—' : `${format(data.youngest_age)} / ${format(data.oldest_age)}`} /><Stat label={copy.validAges} value={format(data.valid_age_count)} /><Stat label={copy.missingInvalid} value={format(numeric(data.missing_age_count) + numeric(data.invalid_age_count))} /></div></Panel>
        </div>}

        {view === 'households' && <div className="analytics-two-column">
          <Panel title={copy.houseTitle} description={copy.houseHelp}><BarList max={maxHouse} rows={houses.map((row) => [row.label, numeric(row.count), row.key])} denominator={numeric(data.house_group_count)} /></Panel>
          <Panel title={copy.houseGroups} description={copy.actualData}><div className="analytics-stat-list"><Stat label={copy.houseGroups} value={format(data.house_group_count)} /><Stat label={copy.averagePerGroup} value={data.average_voters_per_house == null ? '—' : format(data.average_voters_per_house)} /><Stat label={copy.largestGroup} value={`${format(data.largest_house_group)} ${copy.voters}`} /><Stat label={copy.missingHouse} value={format(data.missing_house_count)} /></div></Panel>
        </div>}

        {view === 'indicators' && <Panel title={copy.indicatorsTitle} description={copy.indicatorsHelp}><div className="indicator-grid">
          <Indicator label={copy.missingGender} value={data.missing_gender_count} /><Indicator label={copy.missingAge} value={data.missing_age_count} /><Indicator label={copy.invalidAge} value={data.invalid_age_count} /><Indicator label={copy.missingHouse} value={data.missing_house_count} /><Indicator label={copy.missingEpic} value={data.missing_epic_count} /><Indicator label={copy.duplicateEpic} value={data.duplicate_epic_groups} /><Indicator label={copy.missingSerial} value={data.missing_serial_count} /><Indicator label={copy.unexpectedSerial} value={data.unexpected_serial_count} /><Indicator label={copy.duplicateSerial} value={data.duplicate_part_serial_groups} />
        </div></Panel>}

        {view === 'revisions' && <Panel title={copy.revisionsTitle} description={copy.revisionHelp}><div className="revision-empty"><BarChart3 aria-hidden="true" /><h3>{copy.revisionEmpty}</h3><p>{copy.revisionHelp}</p><span>{copy.currentRevision} · {format(data.revision_count)}</span></div></Panel>}
      </>}
    </>
  )
}

function BarList({ rows, max, denominator }: { rows: Array<[string, number, string]>; max: number; denominator: number }) {
  return <div className="analytics-bar-list">{rows.map(([label,value,key]) => <div key={key} className={`analytics-bar ${key}`} title={`${label}: ${value.toLocaleString('en-IN')} (${safePercent(value, denominator)}%)`}><span><b>{label}</b><small>{value.toLocaleString('en-IN')} · {safePercent(value, denominator)}%</small></span><div><i style={{ width: `${Math.max(value ? 2 : 0, value / max * 100)}%` }} /></div></div>)}</div>
}

function DonutChart({ rows, total, label, totalLabel }: { rows: Array<[string, number, string]>; total: number; label: string; totalLabel: string }) {
  let offset = 0
  const segments = rows.map(([segmentLabel, value, key]) => {
    const percent = safePercent(value, total)
    const segment = { segmentLabel, value, key, percent, offset }
    offset += percent
    return segment
  })

  return <div className="analytics-donut-layout">
    <div className="analytics-donut" role="img" aria-label={`${label}: ${rows.map(([name, value]) => `${name} ${value}`).join(', ')}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="donut-track" cx="60" cy="60" r="48" pathLength="100" />
        {segments.filter((segment) => segment.value > 0).map((segment) => <circle key={segment.key} className={`donut-segment ${segment.key}`} cx="60" cy="60" r="48" pathLength="100" strokeDasharray={`${segment.percent} ${100 - segment.percent}`} strokeDashoffset={-segment.offset}><title>{segment.segmentLabel}: {segment.value.toLocaleString('en-IN')} ({segment.percent}%)</title></circle>)}
      </svg>
      <span><strong>{total.toLocaleString('en-IN')}</strong><small>{totalLabel}</small></span>
    </div>
    <div className="analytics-donut-legend">{segments.map((segment) => <div key={segment.key} className={segment.key}><i aria-hidden="true" /><span>{segment.segmentLabel}</span><strong>{segment.value.toLocaleString('en-IN')}</strong><small>{segment.percent}%</small></div>)}</div>
  </div>
}

function ColumnChart({ rows, max, denominator, label }: { rows: Array<[string, number, string]>; max: number; denominator: number; label: string }) {
  return <div className="analytics-column-chart" role="img" aria-label={`${label}: ${rows.map(([name, value]) => `${name} ${value}`).join(', ')}`}>
    {rows.map(([columnLabel, value, key]) => <div key={key} className={`analytics-column ${key}`} title={`${columnLabel}: ${value.toLocaleString('en-IN')} (${safePercent(value, denominator)}%)`}>
      <strong>{value.toLocaleString('en-IN')}</strong>
      <div><i style={{ height: `${Math.max(value ? 4 : 0, value / max * 100)}%` }} /></div>
      <span>{columnLabel}</span>
      <small>{safePercent(value, denominator)}%</small>
    </div>)}
  </div>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function Indicator({ label, value }: { label: string; value: CountValue }) {
  const count = numeric(value)
  return <article className={count ? 'warning' : ''}><CircleAlert aria-hidden="true" /><span>{label}</span><strong>{format(count)}</strong></article>
}

function PartSummary({ parts, copy }: { parts: PartRow[]; copy: typeof COPY[UiLanguage] }) {
  return <Panel title={copy.summaryTitle} description={copy.partHelp} className="part-summary-panel"><div className="data-table-wrap"><table className="analytics-table"><thead><tr><th>{copy.part}</th><th>{copy.expectedLabel}</th><th>{copy.availableLabel}</th><th>{copy.male}</th><th>{copy.female}</th><th>{copy.otherUnknownShort}</th><th>{copy.averageAge}</th><th>{copy.houseGroups}</th><th>{copy.verified}</th><th>{copy.needsReview}</th></tr></thead><tbody>{parts.map((row) => <tr key={row.part}><td><strong>{row.part}</strong></td><td>{format(row.expected)}</td><td>{format(row.available)}</td><td>{format(row.male)}</td><td>{format(row.female)}</td><td>{format(row.other_unknown)}</td><td>{row.average_age == null ? '—' : format(row.average_age)}</td><td>{format(row.house_groups)}</td><td>{format(row.verified)}</td><td>{format(row.needs_review)}</td></tr>)}</tbody></table></div></Panel>
}
