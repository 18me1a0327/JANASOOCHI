import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileSearch, Files, Grid2X2, Home, KeyRound, Languages, List, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Printer, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trash2, Upload, UserRound, X } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { fetchAllVoters, fetchDocuments, fetchLanguageCoverage, fetchLogicalSources, fetchProcessingPages, invalidateDataCache, searchVoters } from './data';
import { normalize, UNSUPPORTED, validatePasswordChange } from './core';
import { configured, inspectPdf, openSource, processPdf, sha256, supabase } from './lib';
import SourceViewer from './SourceViewer';
import AdvancedReviewPage from './AdvancedReviewPage';
import type { DocumentRow, Filters, LanguageCoverage, PageRow, RecordLanguage, Role, SearchHit, Voter } from './types';
type Lang = 'en' | 'te' | 'ur';
type ManagedUser = {
    id: string;
    email: string | null;
    role: Role;
    created_at: string;
    last_sign_in_at: string | null;
    is_current: boolean;
};
type UserEditor = {
    mode: 'create' | 'edit';
    id?: string;
    email: string;
    password: string;
    role: Role;
    isCurrent?: boolean;
};
const parts = [227, 228, 229, 230];
const empty: Filters = { part: 'all', name: '', father: '', husband: '', mother: '', house: '', age: '', ageTolerance: 0, gender: '', epic: '', serial: '', fuzzy: false, recordLanguage: 'en', selectedLanguageOnly: true };
const words = {
    en: { dashboard: 'Dashboard', roll: 'Voter Roll', houses: 'Household View', upload: 'PDF Ingestion & OCR', insights: 'Data Insights', review: 'Review Issues', documents: 'Documents', admin: 'Admin', profile: 'Profile', logout: 'Logout', original: 'View Original Page', missing: 'Not available in source PDF', verify: 'Requires verification', none: 'No matching voter found', clear: 'Clear Filters', find: 'Search', name: 'Name', father: 'Father Name', husband: 'Husband Name', mother: 'Mother Name', house: 'House Number', age: 'Age', gender: 'Gender', epic: 'EPIC', serial: 'Serial Number', voters: 'voters', sourceRecords: 'source records', logicalVoters: 'logical voters', sourceCoverage: 'Source-language coverage', coverageNote: 'Part + serial number identify one voter; translated PDF copies are not added to this total.', linked: 'linked', unavailable: 'unavailable', reviewLink: 'link requires review', page: 'Page', of: 'of', previous: 'Previous', next: 'Next', perPage: 'Rows per page', allParts: 'All 227–230' },
    te: { dashboard: 'డ్యాష్‌బోర్డ్', roll: 'ఓటరు జాబితా', houses: 'ఇంటి వారీ వీక్షణ', upload: 'PDF ప్రాసెసింగ్ & OCR', insights: 'డేటా అంతర్దృష్టులు', review: 'సమస్యల సమీక్ష', documents: 'పత్రాలు', admin: 'అడ్మిన్', profile: 'ప్రొఫైల్', logout: 'లాగ్ అవుట్', original: 'అసలు పేజీ చూడండి', missing: 'మూల PDFలో అందుబాటులో లేదు', verify: 'ధృవీకరణ అవసరం', none: 'సరిపోలే ఓటరు కనుగొనబడలేదు', clear: 'ఫిల్టర్లు తొలగించండి', find: 'శోధించండి', name: 'పేరు', father: 'తండ్రి పేరు', husband: 'భర్త పేరు', mother: 'తల్లి పేరు', house: 'ఇంటి నంబర్', age: 'వయస్సు', gender: 'లింగం', epic: 'EPIC', serial: 'క్రమ సంఖ్య', voters: 'ఓటర్లు', sourceRecords: 'మూల రికార్డులు', logicalVoters: 'ప్రత్యేక ఓటర్లు', sourceCoverage: 'భాషా మూలాల లభ్యత', coverageNote: 'పార్ట్ + క్రమ సంఖ్య ఒక ఓటరును గుర్తిస్తాయి; అనువాద PDF ప్రతులు మొత్తానికి కలపబడవు.', linked: 'అనుసంధానించబడ్డాయి', unavailable: 'అందుబాటులో లేవు', reviewLink: 'అనుసంధానం సమీక్ష అవసరం', page: 'పేజీ', of: 'లో', previous: 'మునుపటి', next: 'తదుపరి', perPage: 'పేజీకి వరుసలు', allParts: 'అన్ని 227–230' },
    ur: { dashboard: 'ڈیش بورڈ', roll: 'ووٹر فہرست', houses: 'گھر تلاش', upload: 'PDF پروسیسنگ اور OCR', insights: 'ڈیٹا جائزہ', review: 'مسائل کا جائزہ', documents: 'دستاویزات', admin: 'منتظم', profile: 'پروفائل', logout: 'لاگ آؤٹ', original: 'اصل صفحہ دیکھیں', missing: 'ماخذ PDF میں دستیاب نہیں', verify: 'تصدیق درکار', none: 'کوئی مماثل ووٹر نہیں ملا', clear: 'فلٹر صاف کریں', find: 'تلاش کریں', name: 'نام', father: 'والد کا نام', husband: 'شوہر کا نام', mother: 'والدہ کا نام', house: 'مکان نمبر', age: 'عمر', gender: 'جنس', epic: 'EPIC', serial: 'سلسلہ نمبر', voters: 'ووٹرز', sourceRecords: 'ماخذ ریکارڈز', logicalVoters: 'منفرد ووٹرز', sourceCoverage: 'زبان کے ماخذ کی دستیابی', coverageNote: 'پارٹ + سلسلہ نمبر ایک ووٹر کی شناخت کرتے ہیں؛ ترجمہ شدہ PDF نقول کل تعداد میں شامل نہیں ہوتیں۔', linked: 'منسلک', unavailable: 'دستیاب نہیں', reviewLink: 'لنک کا جائزہ درکار', page: 'صفحہ', of: 'از', previous: 'پچھلا', next: 'اگلا', perPage: 'فی صفحہ قطاریں', allParts: 'تمام 227–230' },
} as const;
function friendly(error: unknown, fallback = 'Something went wrong. Please try again.') { console.error(error); return error instanceof Error && /PDF|processed|Unsupported|already/.test(error.message) ? error.message : fallback; }
function show(value: string | number | null | undefined, lang: Lang) { return value === null || value === undefined || value === '' ? words[lang].missing : String(value); }
function formatNumber(value: number, lang: Lang) { return new Intl.NumberFormat(lang === 'te' ? 'te-IN' : lang === 'ur' ? 'ur-PK' : 'en-IN').format(value); }
const sourceLanguageNames: Record<RecordLanguage, string> = { en: 'English', te: 'తెలుగు', ur: 'اردو' };
function LanguageCoveragePanel({ coverage, lang, busy = false }: { coverage: LanguageCoverage[]; lang: Lang; busy?: boolean }) {
    const t = words[lang];
    const logicalTotal = coverage[0]?.logical_total ?? 0;
    return <section className="language-coverage" aria-label={t.sourceCoverage}>
<header>
<div>
<span>{t.sourceCoverage}</span>
<strong>{busy ? '—' : formatNumber(logicalTotal, lang)} {t.logicalVoters}</strong>
</div>
<small>{t.coverageNote}</small>
</header>
<div>{(['en', 'te', 'ur'] as RecordLanguage[]).map(sourceLanguage => { const item = coverage.find(row => row.source_language === sourceLanguage); return <article key={sourceLanguage} className={item?.unlinked_records ? 'requires-review' : ''}>
<span>{sourceLanguageNames[sourceLanguage]}</span>
<strong>{busy || !item ? '—' : `${formatNumber(item.source_records, lang)} / ${formatNumber(item.logical_total, lang)}`}</strong>
<small>{item ? `${formatNumber(item.linked_records, lang)} ${t.linked} · ${formatNumber(item.unavailable_records, lang)} ${t.unavailable}` : '—'}</small>{Boolean(item?.unlinked_records) && <em>{formatNumber(item?.unlinked_records ?? 0, lang)} {t.reviewLink}</em>}
</article>; })}</div>
</section>;
}
function documentLanguage(document: DocumentRow | string) {
    if (typeof document !== 'string')
        return document.source_language;
    const code = document.match(/-(ENG|TEL|URD|URDU)-/i)?.[1]?.toUpperCase();
    return code === 'TEL' ? 'te' : code === 'URD' || code === 'URDU' ? 'ur' : 'en';
}
function Login() {
    const nav = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice] = useState(() => sessionStorage.getItem('pv-auth-message') ?? '');
    useEffect(() => { sessionStorage.removeItem('pv-auth-message'); }, []);
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError('');
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (authError)
            setError('Unable to sign in. Check your email and password.');
        else {
            const returnTo = sessionStorage.getItem('pv-return-to');
            sessionStorage.removeItem('pv-return-to');
            nav(returnTo?.startsWith('/') ? returnTo : '/search');
        }
    }
    return <main className="login-page">
<form className="login-card" onSubmit={submit}>
<img className="login-logo" src="/janasoochi-logo-800.png" alt="Janasoochi electoral roll search and verification"/>
<div>
<h1>జనసూచి — Janasoochi</h1>
<p>Pallerlamudi Electoral Roll Search &amp; Verification · Parts 227–230</p>
</div>{notice && <div className="notice info" role="status">{notice}</div>}{!configured && <div className="notice error">Supabase is not configured. Add the environment values before signing in.</div>}<label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}/>
</label>
<label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)}/>
</label>{error && <div className="notice error">{error}</div>}<button className="primary wide" disabled={!configured || busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
<small>Accounts are created by an administrator. Public registration is disabled.</small>
</form>
</main>;
}
function Shell({ role, lang, setLang }: {
    role: Role;
    lang: Lang;
    setLang: (lang: Lang) => void;
}) {
    const t = words[lang];
    const location = useLocation();
    const [part, setPart] = useState(() => sessionStorage.getItem('pv-part') || 'all');
    const [reviews, setReviews] = useState(0);
    const [mobile, setMobile] = useState(false);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pv-menu-collapsed') === 'true');
    const workspace = ['/search', '/households', '/upload', '/insights'].includes(location.pathname);
    useEffect(() => {
        if (role === 'admin')
            void supabase.from('review_issues').select('id', { count: 'exact', head: true }).eq('status', 'open').then(({ count }) => setReviews(count ?? 0));
    }, [role]);
    function selectPart(next: string) { setPart(next); sessionStorage.setItem('pv-part', next); window.dispatchEvent(new CustomEvent('pv-part-change', { detail: next })); }
    function toggle() { const next = !collapsed; setCollapsed(next); localStorage.setItem('pv-menu-collapsed', String(next)); }
    const menu = [{ to: '/search', label: t.roll, icon: <List /> }, { to: '/households', label: t.houses, icon: <Home /> }, ...(role === 'admin' ? [{ to: '/insights', label: t.dashboard, icon: <BarChart3 /> }, { to: '/upload', label: t.upload, icon: <Upload /> }, { to: '/review', label: t.review, icon: <AlertTriangle />, badge: reviews }] : []), { to: '/documents', label: t.documents, icon: <Files /> }, ...(role === 'admin' ? [{ to: '/admin', label: t.admin, icon: <ShieldCheck /> }] : []), { to: '/profile', label: t.profile, icon: <UserRound /> }];
    return <div className={`app-shell ${collapsed ? 'menu-collapsed' : ''}`} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
<aside className={`side-menu ${mobile ? 'open' : ''}`}>
<NavLink className="side-brand" to="/search" onClick={() => setMobile(false)}>
<img src="/janasoochi-mark-192.png" alt=""/>
<span>
<strong>జనసూచి</strong>
<small>Janasoochi</small>
</span>
</NavLink>
<nav>
<span className="menu-caption">MAIN MENU</span>{menu.map(item => <NavLink key={item.to} to={item.to} title={item.label} onClick={() => setMobile(false)}>{item.icon}<span>{item.label}</span>{item.badge !== undefined && <em>{item.badge}</em>}</NavLink>)}</nav>
<div className="side-footer">
<button title={t.logout} onClick={() => { sessionStorage.setItem('pv-manual-signout', 'true'); sessionStorage.removeItem('pv-return-to'); sessionStorage.removeItem('pv-auth-message'); void supabase.auth.signOut(); }}>
<LogOut />
<span>{t.logout}</span>
</button>
<button className="collapse-menu" onClick={toggle}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span>Collapse menu</span>
</button>
</div>
</aside>{mobile && <button className="menu-scrim" aria-label="Close menu" onClick={() => setMobile(false)}/>}<div className="app-main">
<header className="topbar">
<button className="icon-button mobile-menu" onClick={() => setMobile(true)}>
<Menu />
</button>
<div className="page-context">
<strong>{menu.find(item => item.to === location.pathname)?.label ?? 'Janasoochi'}</strong>
<small>Parts 227–230 · Authorized source PDFs</small>
</div>
<div className="top-actions">
<label className="part-select">
<span>Part</span>
<select value={part} onChange={event => selectPart(event.target.value)}>
<option value="all">{t.allParts}</option>{parts.map(item => <option key={item}>{item}</option>)}</select>
</label>
<div className="language-switch">
<Languages />{(['en', 'te', 'ur'] as Lang[]).map(item => <button key={item} className={lang === item ? 'active' : ''} onClick={() => setLang(item)}>{item === 'en' ? 'EN' : item === 'te' ? 'తెలుగు' : 'اردو'}</button>)}</div>
</div>
</header>
<main className="page-frame">{workspace && <section className="workspace-hero">
<div>
<span className="eyebrow">జనసూచి — AUTHORIZED SOURCE-PDF SEARCH</span>
<h1>Pallerlamudi Electoral Roll Search &amp; Verification</h1>
<p>Search only records extracted from authorized English, Telugu and Urdu source PDFs.</p>
</div>
<span className="engine-pill">
<CheckCircle2 />95% quality gate + source verification</span>
</section>}<div hidden={location.pathname !== '/search'}>
<SearchPage lang={lang} initialPart={part} role={role}/>
</div>
<div hidden={location.pathname !== '/households'}>
<HouseholdsPage lang={lang} initialPart={part}/>
</div>{role === 'admin' && <>
<div hidden={location.pathname !== '/upload'}>
<UploadPage />
</div>
<div hidden={location.pathname !== '/insights'}>
<InsightsPage lang={lang}/>
</div>
</>}<Routes>
<Route path="/source/:pdfId" element={<SourceViewer/>}/>
<Route path="/review" element={role === 'admin' ? <AdvancedReviewPage lang={lang}/> : <Navigate to="/search"/>}/>
<Route path="/documents" element={<DocumentsPage role={role}/>}/>
<Route path="/admin" element={role === 'admin' ? <AdminPage /> : <Navigate to="/search"/>}/>
<Route path="/profile" element={<ProfilePage role={role}/>}/>
<Route path="*" element={workspace ? null : <Navigate to="/search"/>}/>
</Routes>
</main>
</div>
</div>;
}
function usePartSync(setter: (part: string) => void) { useEffect(() => { const listener = (event: Event) => setter((event as CustomEvent<string>).detail); window.addEventListener('pv-part-change', listener); return () => window.removeEventListener('pv-part-change', listener); }, [setter]); }
function SearchPage({ lang, initialPart, role }: {
    lang: Lang;
    initialPart: string;
    role: Role;
}) {
    const nav = useNavigate();
    const t = words[lang];
    const [filters, setFilters] = useState<Filters>({ ...empty, part: initialPart, recordLanguage: lang });
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [docs, setDocs] = useState<Record<string, DocumentRow>>({});
    const [selected, setSelected] = useState<Voter | null>(null);
    const [sameHouse, setSameHouse] = useState<Voter[]>([]);
    const [logicalSources, setLogicalSources] = useState<Voter[]>([]);
    const [coverage, setCoverage] = useState<LanguageCoverage[]>([]);
    const [searched, setSearched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [view, setView] = useState<'table' | 'cards'>(() => window.matchMedia('(max-width: 800px)').matches ? 'cards' : 'table');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => Number(sessionStorage.getItem('pv-page-size')) || 50);
    usePartSync(useCallback((next: string) => setFilters((current) => ({ ...current, part: next })), []));
    useEffect(() => {
        let current = true;
        void fetchLanguageCoverage(filters.part).then(rows => { if (current)
            setCoverage(rows); }).catch(coverageError => { if (current)
            setError(friendly(coverageError, 'Database temporarily unavailable')); });
        return () => { current = false; };
    }, [filters.part]);
    const set = (key: keyof Filters, next: string | boolean) => setFilters((current) => ({ ...current, [key]: next }));
    const run = useCallback(async (next = filters) => {
        setBusy(true);
        setError('');
        setPage(1);
        try {
            const results = await searchVoters(next);
            setHits(results);
            const sourceDocs = await fetchDocuments([...new Set(results.map(({ record }) => record.pdf_id))]);
            setDocs(Object.fromEntries(sourceDocs.map((document) => [document.id, document])));
            setSearched(true);
        }
        catch (searchError) {
            setError(friendly(searchError, 'Database temporarily unavailable'));
        }
        finally {
            setBusy(false);
        }
    }, [filters]);
    useEffect(() => {
        const initial = { ...empty, part: initialPart, recordLanguage: lang };
        setFilters(initial);
        setBusy(true);
        void searchVoters(initial).then(async (results) => {
            setHits(results);
            const sourceDocs = await fetchDocuments([...new Set(results.map(({ record }) => record.pdf_id))]);
            setDocs(Object.fromEntries(sourceDocs.map((document) => [document.id, document])));
            setSearched(true);
        }).catch((searchError) => setError(friendly(searchError, 'Database temporarily unavailable'))).finally(() => setBusy(false));
    }, [initialPart, lang]);
    function quick(query: string) {
        const next = { ...empty, part: filters.part, recordLanguage: filters.recordLanguage, selectedLanguageOnly: filters.selectedLanguageOnly };
        if (/^[A-Z]{3}\d{7}$/i.test(query))
            next.epic = query;
        else if (/^\d[\dA-Za-z\/-]*$/.test(query))
            next.house = query;
        else
            next.name = query;
        setFilters(next);
        void run(next);
    }
    async function details(voter: Voter) {
        setSelected(voter);
        setSameHouse([]);
        setLogicalSources([]);
        try {
            if (voter.normalized_house_number) {
                const { data, error: houseError } = await supabase.from('voter_records').select('*').eq('pdf_id', voter.pdf_id).eq('part_number', voter.part_number).eq('normalized_house_number', voter.normalized_house_number).neq('id', voter.id).limit(20);
                if (houseError)
                    throw houseError;
                setSameHouse((data ?? []) as Voter[]);
            }
            if (voter.logical_voter_id) {
                const sourceSet = await fetchLogicalSources(voter.logical_voter_id);
                setLogicalSources(sourceSet.records);
                setDocs(current => ({ ...current, ...Object.fromEntries(sourceSet.documents.map(document => [document.id, document])) }));
            }
        }
        catch (detailError) {
            setError(friendly(detailError, 'Unable to load linked source records'));
        }
    }
    function source(voter: Voter) {
        const doc = docs[voter.pdf_id];
        if (!doc)
            return setError('Unable to open PDF');
        nav(`/source/${doc.id}?page=${voter.pdf_page_number}&voter=${voter.id}`);
    }
    function exportCsv() { const header = ['Part', 'Serial Number', 'Name', 'Relation Type', 'Relation Name', 'House Number', 'Age', 'Gender', 'EPIC', 'PDF Page', 'Printed Page', 'Status', 'Match Score']; const quote = (cell: unknown) => `"${String(cell ?? '').replaceAll('"', '""')}"`; const rows = hits.map(({ record, matchScore }) => [record.part_number, record.serial_number, record.original_name, record.relation_type, record.original_relation_name, record.original_house_number, record.age, record.gender, record.epic_number, record.pdf_page_number, record.printed_page_number, record.verification_status, matchScore].map(quote).join(',')); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([[header.map(quote).join(','), ...rows].join('\n')], { type: 'text/csv' })); link.download = 'pallerlamudi-voter-search.csv'; link.click(); URL.revokeObjectURL(link.href); }
    const visible = hits.slice((page - 1) * pageSize, page * pageSize);
    const pages = Math.max(1, Math.ceil(hits.length / pageSize));
    return <section className="workspace-body">
<GlobalSearch onSearch={quick} busy={busy}/>
<div className="action-row">
<div className="quick-chips">
<b>Quick:</b>{parts.map((part) => <button key={part} onClick={() => { const next = { ...empty, part: String(part), recordLanguage: filters.recordLanguage, selectedLanguageOnly: filters.selectedLanguageOnly }; setFilters(next); void run(next); }}>Part {part}</button>)}</div>
<div>
<button className="secondary compact" disabled={!hits.length} onClick={exportCsv}>
<Download />Export CSV</button>
<button className="dark compact" disabled={!hits.length} onClick={() => window.print()}>
<Printer />Print Results</button>
</div>
</div>
<form className="filter-panel" onSubmit={(event) => { event.preventDefault(); void run(); }}>
<div className="panel-heading">
<span>
<SlidersHorizontal />Electoral filters</span>
<div className="view-switch">
<button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
<List />
</button>
<button type="button" className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>
<Grid2X2 />
</button>
</div>
</div>
<div className="language-filter-row">
<label>Voter-data language<select value={filters.recordLanguage} onChange={event => set('recordLanguage', event.target.value)}>
<option value="en">English source</option>
<option value="te">తెలుగు source</option>
<option value="ur">اردو source</option>
</select>
</label>
<label className="check-field">
<input type="checkbox" checked={filters.selectedLanguageOnly} onChange={event => set('selectedLanguageOnly', event.target.checked)}/>Search selected language only</label>
<small>{filters.selectedLanguageOnly ? 'Only original records in the selected source language are searched.' : 'Cross-language transliteration search is enabled; source text is never changed.'}</small>
</div>
<div className="filter-grid">
<label>Part<select value={filters.part} onChange={(event) => set('part', event.target.value)}>
<option value="all">{t.allParts}</option>{parts.map((part) => <option key={part}>{part}</option>)}</select>
</label>{(['name', 'father', 'husband', 'mother', 'house'] as const).map((key) => <label key={key}>{t[key]}<input type="text" value={filters[key]} onChange={(event) => set(key, event.target.value)}/>
</label>)}<label>{t.age}<input type="number" value={filters.age} onChange={event => set('age', event.target.value)}/>
<select aria-label="Age tolerance" value={filters.ageTolerance} onChange={event => setFilters(current => ({ ...current, ageTolerance: Number(event.target.value) as Filters['ageTolerance'] }))}>
<option value="0">Exact</option>
<option value="1">±1</option>
<option value="2">±2</option>
<option value="3">±3</option>
</select>
</label>{(['epic', 'serial'] as const).map(key => <label key={key}>{t[key]}<input value={filters[key]} onChange={event => set(key, event.target.value)}/>
</label>)}<label>{t.gender}<select value={filters.gender} onChange={(event) => set('gender', event.target.value)}>
<option value="">All</option>
<option>Male</option>
<option>Female</option>
<option>Other</option>
</select>
</label>
<label className="check-field">
<input type="checkbox" checked={filters.fuzzy} onChange={(event) => set('fuzzy', event.target.checked)}/>OCR fuzzy name match</label>
</div>
<div className="filter-actions">
<button className="primary">
<Search />{t.find}</button>
<button type="button" className="secondary" onClick={() => { const next = { ...empty, part: filters.part, recordLanguage: filters.recordLanguage, selectedLanguageOnly: filters.selectedLanguageOnly }; setFilters(next); setHits([]); setSearched(false); }}>
<X />{t.clear}</button>
</div>
</form>{error && <div className="notice error">{error}</div>}<LanguageCoveragePanel coverage={coverage} lang={lang} busy={!coverage.length}/><div className="result-summary">
<b>{busy ? 'Searching uploaded PDFs…' : `${formatNumber(hits.length, lang)} ${t.sourceRecords}`}</b>{filters.house && <span>Voters listed under House Number {filters.house}</span>}<div className="page-controls">
<label>{t.perPage}<select value={pageSize} onChange={event => { const size = Number(event.target.value); setPageSize(size); setPage(1); sessionStorage.setItem('pv-page-size', String(size)); }}>{[25, 50, 100].map(size => <option key={size}>{size}</option>)}</select>
</label>
<label>{t.page}<select value={page} onChange={event => setPage(Number(event.target.value))}>{Array.from({ length: pages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select> {t.of} {formatNumber(pages, lang)}</label>
</div>
</div>{!busy && searched && !hits.length && <div className="empty-state">
<FileSearch />
<h2>{t.none}</h2>
<p>Try fewer filters or enable OCR fuzzy name matching.</p>
</div>}{view === 'table' ? <ResultTable hits={visible} lang={lang} onDetails={details} onSource={source}/> : <ResultCards hits={visible} lang={lang} onDetails={details} onSource={source}/>}{hits.length > pageSize && <div className="pagination">
<button className="secondary compact" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
<ChevronLeft />{t.previous}</button>
<span>{t.page} {formatNumber(page, lang)} {t.of} {formatNumber(pages, lang)}</span>
<button className="secondary compact" disabled={page === pages} onClick={() => setPage((current) => current + 1)}>{t.next}<ChevronRight />
</button>
</div>}{selected && <VoterModal voter={selected} sameHouse={sameHouse} logicalSources={logicalSources} lang={lang} role={role} onClose={() => setSelected(null)} onSource={source}/>}</section>;
}
function GlobalSearch({ onSearch, busy }: {
    onSearch: (query: string) => void;
    busy: boolean;
}) { const [query, setQuery] = useState(''); return <form className="global-search" onSubmit={(event) => { event.preventDefault(); onSearch(query.trim()); }}>
<Search />
<input placeholder="Search name, EPIC, or exact house number…" value={query} onChange={(event) => setQuery(event.target.value)}/>
<button className="primary compact" disabled={busy}>Search</button>
</form>; }
function Status({ value }: {
    value: string;
}) { return <span className={`status ${value}`}>{value === 'requires_review' ? 'Requires review' : value === 'verified' ? 'Verified' : 'Unverified'}</span>; }
function ResultTable({ hits, lang, onDetails, onSource }: {
    hits: SearchHit[];
    lang: Lang;
    onDetails: (voter: Voter) => void;
    onSource: (voter: Voter) => void;
}) {
    if (!hits.length)
        return null;
    return <div className="data-table results-table">
<table>
<thead>
<tr>
<th>Part / S.No</th>
<th>Elector name</th>
<th>Relation</th>
<th>House</th>
<th>Age</th>
<th>Gender</th>
<th>EPIC</th>
<th>Source</th>
<th>Status</th>
<th>Actions</th>
</tr>
</thead>
<tbody>{hits.map(({ record, matchScore, matchType, explanation }) => <tr key={record.id}>
<td>
<b>{record.part_number}</b> / {show(record.serial_number, lang)}</td>
<td>
<strong>{show(record.corrected_value?.original_name || record.original_name, lang)}</strong>{matchScore !== null && <small className="score">{matchType} · {matchScore}%</small>}{explanation.length > 0 && <small className="match-explanation">{explanation.map(item => `${item.field}: ${item.detail}`).join(' · ')}</small>}</td>
<td>
<span>{record.relation_type}</span>
<small>{show(record.corrected_value?.original_relation_name || record.original_relation_name, lang)}</small>
</td>
<td>{show(record.corrected_value?.original_house_number || record.original_house_number, lang)}</td>
<td>{show(record.corrected_value?.age || record.age, lang)}</td>
<td>{show(record.corrected_value?.gender || record.gender, lang)}</td>
<td>{show(record.corrected_value?.epic_number || record.epic_number, lang)}</td>
<td>
<span className="source-badge">{(record.original_language ?? 'en').toUpperCase()} source</span>
<span>PDF {record.pdf_page_number}</span>
<small>Printed {show(record.printed_page_number, lang)}</small>
</td>
<td>
<Status value={record.possible_duplicate ? 'requires_review' : record.verification_status}/>
</td>
<td>
<div className="row-actions">
<button className="icon-button" title="View details" onClick={() => onDetails(record)}>
<Eye />
</button>
<button className="icon-button" title="View original page" onClick={() => onSource(record)}>
<ExternalLink />
</button>
</div>
</td>
</tr>)}</tbody>
</table>
</div>;
}
function ResultCards({ hits, lang, onDetails, onSource }: {
    hits: SearchHit[];
    lang: Lang;
    onDetails: (voter: Voter) => void;
    onSource: (voter: Voter) => void;
}) { return <div className="result-cards">{hits.map(({ record, matchScore, matchType, explanation }) => <article key={record.id} className="voter-card">
<div className="card-top">
<span>Part {record.part_number} · S.No {show(record.serial_number, lang)}</span>
<Status value={record.verification_status}/>
</div>
<span className="source-badge">{(record.original_language ?? 'en').toUpperCase()} source</span>
<h3>{show(record.original_name, lang)}</h3>
<p>{record.relation_type}: <b>{show(record.original_relation_name, lang)}</b>
</p>
<dl>
<dt>House</dt>
<dd>{show(record.original_house_number, lang)}</dd>
<dt>Age / Gender</dt>
<dd>{show(record.age, lang)} · {show(record.gender, lang)}</dd>
<dt>EPIC</dt>
<dd>{show(record.epic_number, lang)}</dd>
<dt>PDF page</dt>
<dd>{record.pdf_page_number}</dd>
</dl>{matchScore !== null && <span className="score">{matchType} · {matchScore}%</span>}{explanation.length > 0 && <small className="match-explanation">{explanation.map(item => `${item.field}: ${item.detail}`).join(' · ')}</small>}<div className="card-actions">
<button className="secondary compact" onClick={() => onDetails(record)}>
<Eye />Details</button>
<button className="primary compact" onClick={() => onSource(record)}>
<ExternalLink />Original</button>
</div>
</article>)}</div>; }
function VoterModal({ voter, sameHouse, logicalSources, lang, role, onClose, onSource }: {
    voter: Voter;
    sameHouse: Voter[];
    logicalSources: Voter[];
    lang: Lang;
    role: Role;
    onClose: () => void;
    onSource: (voter: Voter) => void;
}) {
    const nav = useNavigate();
    const sources = new Map(logicalSources.map(source => [source.original_language, source]));
    return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
<section className="voter-modal" role="dialog" aria-modal="true">
<header>
<div>
<small>Election roll source record</small>
<h2>{show(voter.corrected_value?.original_name || voter.original_name, lang)}</h2>
<span>Part {voter.part_number} · Serial {show(voter.serial_number, lang)}</span>
</div>
<button className="icon-button inverse" onClick={onClose}>
<X />
</button>
</header>
<div className="modal-content">
<div className="source-card">
<div className="source-meta">
<b>EPIC: {show(voter.epic_number, lang)}</b>
<span>PDF page {voter.pdf_page_number}</span>
</div>
<dl>
<dt>Relation</dt>
<dd>{voter.relation_type}: {show(voter.original_relation_name, lang)}</dd>
<dt>House number</dt>
<dd>{show(voter.original_house_number, lang)}</dd>
<dt>Age / Gender</dt>
<dd>{show(voter.age, lang)} · {show(voter.gender, lang)}</dd>
<dt>Printed page</dt>
<dd>{show(voter.printed_page_number, lang)}</dd>
<dt>Original language</dt>
<dd>{show(voter.original_language, lang)}</dd>
</dl>
</div>
<section className="logical-source-list">
<div>
<b>Logical voter source records</b>
<span>Part {voter.part_number} · Serial {show(voter.serial_number, lang)}</span>
</div>{voter.logical_voter_id ? <ul>{(['en', 'te', 'ur'] as RecordLanguage[]).map(sourceLanguage => { const source = sources.get(sourceLanguage); return <li key={sourceLanguage}>
<span className="source-badge">{sourceLanguageNames[sourceLanguage]}</span>
<div>
<b>{source ? show(source.original_name, lang) : words[lang].missing}</b>
<small>{source ? `PDF ${source.pdf_page_number} · ${source.verification_status.replace('_', ' ')}` : words[lang].verify}</small>
</div>{source && <button className="secondary compact" onClick={() => onSource(source)}>
<ExternalLink />Open</button>}
</li>; })}</ul> : <div className="notice warning">{words[lang].reviewLink}. The source record remains unchanged.</div>}
</section>
<div className="confidence-row">
<span>OCR confidence</span>
<b>{voter.ocr_confidence === null ? 'Embedded PDF text' : `${voter.ocr_confidence.toFixed(0)}%`}</b>
<Status value={voter.verification_status}/>
</div>
<section className="same-house">
<div>
<b>Other voters at the same house</b>
<span>Grouping by source house number does not imply family relationship.</span>
</div>{sameHouse.length ? <ul>{sameHouse.map((item) => <li key={item.id}>
<span>{show(item.original_name, lang)}</span>
<small>S.No {show(item.serial_number, lang)} · {item.relation_type} {show(item.original_relation_name, lang)}</small>
</li>)}</ul> : <p>No other same-house voters found in this Part.</p>}</section>
</div>
<footer>
<button className="secondary" onClick={() => window.print()}>
<Printer />Print</button>
<button className="secondary" onClick={() => onSource(voter)}>
<ExternalLink />{words[lang].original}</button>{role === 'admin' && <button className="primary" onClick={() => nav('/review')}>
<ShieldCheck />Review records</button>}</footer>
</section>
</div>;
}
function HouseholdsPage({ lang, initialPart }: {
    lang: Lang;
    initialPart: string;
}) {
    const [part, setPart] = useState(initialPart);
    const [records, setRecords] = useState<Voter[]>([]);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [coverage, setCoverage] = useState<LanguageCoverage[]>([]);
    usePartSync(setPart);
    useEffect(() => {
        setBusy(true);
        setError('');
        Promise.all([fetchAllVoters(part, lang), fetchLanguageCoverage(part)]).then(([voters, sourceCoverage]) => {
            setRecords(voters);
            setCoverage(sourceCoverage);
        }).catch((loadError) => setError(friendly(loadError, 'Database temporarily unavailable'))).finally(() => setBusy(false));
    }, [part, lang]);
    const groups = useMemo(() => {
        const map = new Map<string, Voter[]>();
        records.forEach((record) => {
            if (!record.normalized_house_number)
                return;
            const list = map.get(record.normalized_house_number) ?? [];
            list.push(record);
            map.set(record.normalized_house_number, list);
        });
        return [...map.entries()].filter(([house]) => !query || house.includes(normalize(query))).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    }, [records, query]);
    return <section className="workspace-body">
<div className="section-toolbar">
<div>
<h2>Door-to-door same-house view</h2>
<p>Grouped only by the house number printed in the source PDF; no family relationship is inferred.</p>
</div>
<input placeholder="Filter by house number…" value={query} onChange={(event) => setQuery(event.target.value)}/>
</div>{error && <div className="notice error">{error}</div>}<LanguageCoveragePanel coverage={coverage} lang={lang} busy={busy}/><div className="result-summary">
<b>{busy ? 'Loading…' : `${groups.length.toLocaleString()} house groups`}</b>
<span>{formatNumber(records.length, lang)} {words[lang].sourceRecords} · {sourceLanguageNames[lang]}</span>
</div>
<div className="house-grid">{groups.slice(0, 200).map(([house, voters]) => <article className="house-card" key={house}>
<header>
<span className="house-icon">
<Home />
</span>
<div>
<h3>House No: {voters[0].original_house_number}</h3>
<p>{voters.length} voters in source PDF</p>
</div>
<span>{voters.filter((voter) => normalize(voter.gender).startsWith('m')).length} M · {voters.filter((voter) => normalize(voter.gender).startsWith('f')).length} F</span>
</header>
<ul>{voters.map((voter) => <li key={voter.id}>
<span className="serial-box">{show(voter.serial_number, lang)}</span>
<div>
<b>{show(voter.original_name, lang)}</b>
<small>{voter.relation_type}: {show(voter.original_relation_name, lang)} · {show(voter.age, lang)} yrs · {show(voter.gender, lang)}</small>
</div>
<Status value={voter.verification_status}/>
</li>)}</ul>
</article>)}</div>{groups.length > 200 && <div className="notice info">Showing the first 200 groups. Enter a house number to narrow the list.</div>}</section>;
}
function revisionIdentifier(filename: string) { return filename.match(/revision[-_ ]*\d+/i)?.[0] ?? new Date().toISOString().slice(0, 10); }
async function createDocument(file: File, checksum: string, inspection: Awaited<ReturnType<typeof inspectPdf>>, supersedes?: DocumentRow) {
    const path = `part-${inspection.part}/${checksum}.pdf`;
    const stored = await supabase.storage.from('voter-pdfs').upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (stored.error)
        throw stored.error;
    const created = await supabase.from('uploaded_pdfs').insert({ filename: file.name, part_number: inspection.part, total_pdf_pages: inspection.totalPages, processed_pages: 0, failed_pages: 0, records_count: 0, processing_status: 'processing', storage_path: path, checksum, source_language: inspection.language, detected_language: inspection.language, language_confidence: inspection.sample ? 100 : null, expected_voter_total: inspection.expectedVoterTotal, revision_identifier: revisionIdentifier(file.name), active_version: false, supersedes_id: supersedes?.id ?? null, updated_at: new Date().toISOString() }).select().single();
    if (created.error) {
        await supabase.storage.from('voter-pdfs').remove([path]);
        throw created.error;
    }
    const pageStates = await supabase.from('page_processing').insert(Array.from({ length: inspection.totalPages }, (_, index) => ({ pdf_id: created.data.id, pdf_page_number: index + 1, status: 'pending', page_type: 'unknown', detected_language: inspection.language, retry_count: 0, updated_at: new Date().toISOString() })));
    if (pageStates.error) {
        await supabase.from('uploaded_pdfs').delete().eq('id', created.data.id);
        await supabase.storage.from('voter-pdfs').remove([path]);
        throw pageStates.error;
    }
    return created.data as DocumentRow;
}
function issueType(issue: string | null) {
    if (!issue)
        return 'low_confidence';
    if (issue.includes('Unable to process'))
        return 'page_failure';
    if (issue.includes('Page sequence'))
        return 'page_sequence';
    if (issue.includes('Printed page'))
        return 'missing_page';
    if (issue.includes('Language'))
        return 'language';
    if (issue.includes('Detected'))
        return 'malformed_record';
    return 'low_confidence';
}
async function persistProcessedPage(document: DocumentRow, page: Awaited<ReturnType<typeof processPdf>>['pageStates'][number], records: Awaited<ReturnType<typeof processPdf>>['records']) {
    const pageResult = await supabase.from('page_processing').upsert({ pdf_id: document.id, pdf_page_number: page.page, printed_page_number: page.printed, status: page.status, page_type: page.pageType, ocr_confidence: page.confidence, records_detected: page.detected, records_extracted: page.extracted, review_records: page.reviewRecords, dropped_records: page.droppedRecords, issue_detail: page.issue, error_type: page.errorType, error_message: page.errorMessage, detected_language: page.detectedLanguage, language_confidence: page.languageConfidence, retry_count: Math.max(0, page.attempts - 1), processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'pdf_id,pdf_page_number' }).select('id').single();
    if (pageResult.error)
        throw pageResult.error;
    const cleared = await supabase.from('voter_records').delete().eq('pdf_id', document.id).eq('pdf_page_number', page.page);
    if (cleared.error)
        throw cleared.error;
    await supabase.from('review_issues').delete().eq('pdf_id', document.id).eq('page_id', pageResult.data.id).eq('status', 'open');
    let inserted: Pick<Voter, 'id' | 'verification_status' | 'possible_duplicate'>[] = [];
    if (records.length) {
        if (document.source_language !== 'en') {
            const candidates = records.filter(record => record.epic_number);
            const serials = new Map<string, Set<string>>();
            if (candidates.length) {
                const { data: parallelDocuments, error: parallelDocumentError } = await supabase.from('uploaded_pdfs').select('id').eq('part_number', document.part_number).eq('source_language', 'en').eq('active_version', true);
                if (parallelDocumentError)
                    throw parallelDocumentError;
                const parallelIds = (parallelDocuments ?? []).map(item => item.id);
                if (parallelIds.length) {
                    const epics = [...new Set(candidates.map(record => record.epic_number).filter((value): value is string => Boolean(value)))];
                    const { data: parallels, error: parallelError } = await supabase.from('voter_records').select('epic_number,serial_number').in('pdf_id', parallelIds).in('epic_number', epics);
                    if (parallelError)
                        throw parallelError;
                    (parallels ?? []).forEach(record => {
                        if (!record.epic_number || !record.serial_number)
                            return;
                        const values = serials.get(record.epic_number) ?? new Set<string>();
                        values.add(record.serial_number);
                        serials.set(record.epic_number, values);
                    });
                }
            }
            // Serial-number glyphs are especially error-prone in Telugu/Urdu OCR. Reconcile
            // only through an unambiguous EPIC match in the authorized English roll for the
            // same Part. Otherwise keep the value NULL for review instead of storing a guess.
            records.forEach(record => {
                const values = record.epic_number ? serials.get(record.epic_number) : undefined;
                if (values?.size === 1) {
                    record.serial_number = [...values][0];
                    record.field_confidence = { ...record.field_confidence, serial_number: 100 };
                }
                else {
                    record.serial_number = null;
                }
            });
        }
        const result = await supabase.from('voter_records').insert(records.map(record => ({ ...record, pdf_id: document.id }))).select('id,verification_status,possible_duplicate');
        if (result.error)
            throw result.error;
        inserted = (result.data ?? []) as typeof inserted;
    }
    const issues: {
        pdf_id: string;
        page_id: number;
        voter_id?: string;
        issue_type: string;
        issue_detail: string;
    }[] = [];
    if (page.status === 'requires_review')
        issues.push({ pdf_id: document.id, page_id: pageResult.data.id, issue_type: issueType(page.issue), issue_detail: page.issue ?? 'Page requires review' });
    inserted.forEach(record => {
        if (record.verification_status === 'requires_review')
            issues.push({ pdf_id: document.id, page_id: pageResult.data.id, voter_id: record.id, issue_type: record.possible_duplicate ? 'possible_duplicate' : 'low_confidence', issue_detail: record.possible_duplicate ? 'Possible duplicate voter' : 'One or more voter fields require verification' });
    });
    if (issues.length) {
        const review = await supabase.from('review_issues').insert(issues);
        if (review.error)
            throw review.error;
    }
}
async function persistProcessedPageWithRetry(document: DocumentRow, processed: Awaited<ReturnType<typeof processPdf>>['pageStates'][number], records: Awaited<ReturnType<typeof processPdf>>['records']) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await persistProcessedPage(document, processed, records);
            return true;
        }
        catch (error) {
            lastError = error;
            console.error('Unable to persist processed page', { pdfId: document.id, page: processed.page, attempt: attempt + 1, error });
            if (attempt < 2)
                await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
        }
    }
    const issue = 'Unable to save extracted page; retry required';
    const marked = await supabase.from('page_processing').update({ status: 'requires_review', issue_detail: issue, error_type: 'page_persistence_failed', error_message: 'Unable to save extracted voter records', retry_count: 2, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('pdf_id', document.id).eq('pdf_page_number', processed.page).select('id').maybeSingle();
    if (!marked.error && marked.data) {
        await supabase.from('review_issues').delete().eq('pdf_id', document.id).eq('page_id', marked.data.id).eq('status', 'open');
        await supabase.from('review_issues').insert({ pdf_id: document.id, page_id: marked.data.id, issue_type: 'page_failure', issue_detail: issue });
    }
    console.error('Page persistence requires a later resume', { pdfId: document.id, page: processed.page, error: lastError, markerError: marked.error });
    return false;
}
async function finalizeDocument(document: DocumentRow, expectedVoterTotal: number | null) {
    const [{ count: records, error: recordError }, { count: reviewRecords, error: reviewError }, { data: pages, error: pageError }] = await Promise.all([
        supabase.from('voter_records').select('id', { count: 'exact', head: true }).eq('pdf_id', document.id),
        supabase.from('voter_records').select('id', { count: 'exact', head: true }).eq('pdf_id', document.id).eq('verification_status', 'requires_review'),
        supabase.from('page_processing').select('id,status,error_type,detected_language,language_confidence').eq('pdf_id', document.id),
    ]);
    if (recordError)
        throw recordError;
    if (reviewError)
        throw reviewError;
    if (pageError)
        throw pageError;
    const serialRows: { serial_number: string | null }[] = [];
    for (let from = 0;; from += 1000) {
        const result = await supabase.from('voter_records').select('serial_number').eq('pdf_id', document.id).range(from, from + 999);
        if (result.error)
            throw result.error;
        serialRows.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < 1000)
            break;
    }
    await supabase.from('review_issues').delete().eq('pdf_id', document.id).eq('issue_type', 'serial_gap').eq('status', 'open');
    const serials = [...new Set(serialRows.map(row => Number(row.serial_number)).filter(value => Number.isInteger(value) && value > 0))].sort((a, b) => a - b), serialIssues: { pdf_id: string; issue_type: string; issue_detail: string }[] = [];
    for (let index = 1; index < serials.length; index++)
        if (serials[index] > serials[index - 1] + 1)
            serialIssues.push({ pdf_id: document.id, issue_type: 'serial_gap', issue_detail: `Possible missing/unreadable serial ${serials[index - 1] + 1}${serials[index] > serials[index - 1] + 2 ? `–${serials[index] - 1}` : ''}` });
    if (serialIssues.length) {
        const inserted = await supabase.from('review_issues').insert(serialIssues);
        if (inserted.error)
            throw inserted.error;
    }
    const reviewPages = (pages ?? []).filter(page => page.status === 'requires_review').length, processedPages = (pages ?? []).filter(page => ['processed', 'requires_review'].includes(page.status)).length;
    const persistenceFailures = (pages ?? []).filter(page => page.error_type === 'page_persistence_failed').length;
    const languageVotes = new Map<string, number>();
    (pages ?? []).forEach(page => { if (page.detected_language)
        languageVotes.set(page.detected_language, (languageVotes.get(page.detected_language) ?? 0) + 1); });
    const detectedLanguage = [...languageVotes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? document.source_language;
    const total = records ?? 0, mismatch = expectedVoterTotal !== null && total !== expectedVoterTotal;
    const processingStatus = persistenceFailures ? 'interrupted' : reviewPages || reviewRecords || serialIssues.length || mismatch ? 'completed_with_warnings' : 'completed';
    const now = new Date().toISOString();
    const update = await supabase.from('uploaded_pdfs').update({ processed_pages: processedPages, failed_pages: reviewPages, records_count: total, review_records: reviewRecords ?? 0, expected_voter_total: expectedVoterTotal, processing_status: processingStatus, detected_language: detectedLanguage, completed_at: now, updated_at: now }).eq('id', document.id);
    if (update.error)
        throw update.error;
    if (persistenceFailures) {
        await supabase.from('audit_log').insert({ action: 'pdf_processing_interrupted', entity_type: 'uploaded_pdf', entity_id: document.id, metadata: { part_number: document.part_number, source_language: document.source_language, records: total, persistence_failures: persistenceFailures } });
        return { records: total, reviews: reviewPages, expected: expectedVoterTotal, status: processingStatus, persistenceFailures };
    }
    if (document.supersedes_id) {
        const archived = await supabase.from('uploaded_pdfs').update({ active_version: false, updated_at: now }).eq('id', document.supersedes_id);
        if (archived.error)
            throw archived.error;
    }
    const activated = await supabase.from('uploaded_pdfs').update({ active_version: true, updated_at: now }).eq('id', document.id);
    if (activated.error) {
        if (document.supersedes_id)
            await supabase.from('uploaded_pdfs').update({ active_version: true, updated_at: now }).eq('id', document.supersedes_id);
        throw activated.error;
    }
    const reconciled = await supabase.rpc('reconcile_logical_voters_for_part', { p_part: document.part_number });
    if (reconciled.error)
        throw reconciled.error;
    await supabase.from('audit_log').insert({ action: document.supersedes_id ? 'pdf_version_activated' : 'pdf_processed', entity_type: 'uploaded_pdf', entity_id: document.id, metadata: { part_number: document.part_number, source_language: document.source_language, records: total, expected_voter_total: expectedVoterTotal, review_pages: reviewPages, serial_gaps: serialIssues.length } });
    return { records: total, reviews: reviewPages, expected: expectedVoterTotal, status: processingStatus, persistenceFailures: 0 };
}
async function processAndPersist(file: File, document: DocumentRow, onProgress: (page: number, total: number, count: number, reviews: number) => void) {
    const { data: existing, error } = await supabase.from('page_processing').select('pdf_page_number,printed_page_number,status,error_type').eq('pdf_id', document.id);
    if (error)
        throw error;
    const retryableErrors = new Set(['page_processing_failed', 'page_persistence_failed']);
    const skip = new Set((existing ?? []).filter(page => page.status === 'processed' || (page.status === 'requires_review' && !retryableErrors.has(page.error_type ?? ''))).map(page => page.pdf_page_number));
    let expectedVoterTotal = document.expected_voter_total;
    if (expectedVoterTotal === null && document.source_language !== 'en') {
        const { data: parallel } = await supabase.from('uploaded_pdfs').select('records_count').eq('part_number', document.part_number).eq('source_language', 'en').eq('active_version', true).order('uploaded_at', { ascending: false }).limit(1).maybeSingle();
        expectedVoterTotal = parallel?.records_count ?? null;
    }
    const result = await processPdf(file, onProgress, { part: document.part_number, skipPages: skip, priorPrintedPages: (existing ?? []).map(page => page.printed_page_number).filter((value): value is number => value !== null), expectedVoterTotal, onPage: async (processed) => { await persistProcessedPageWithRetry(document, processed.state, processed.records); } });
    return finalizeDocument(document, result.expectedVoterTotal);
}
async function removeDocument(document: DocumentRow) {
    const removed = await supabase.from('uploaded_pdfs').delete().eq('id', document.id);
    if (removed.error)
        throw removed.error;
    const storage = await supabase.storage.from('voter-pdfs').remove([document.storage_path]);
    if (storage.error)
        throw new Error('Document records were deleted, but source-file cleanup requires attention.');
}
function UploadPage() {
    const [files, setFiles] = useState<File[]>([]);
    const [replacement, setReplacement] = useState<DocumentRow | null>(null);
    const [replacementFile, setReplacementFile] = useState<File | null>(null);
    const [documents, setDocuments] = useState<DocumentRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const load = useCallback(() => fetchDocuments().then(setDocuments).catch(loadError => setError(friendly(loadError, 'Database temporarily unavailable'))), []);
    useEffect(() => { void load(); }, [load]);
    async function ingest(selected: File, replacing?: DocumentRow): Promise<string | null> {
        setBusy(true);
        setBusyId(replacing?.id ?? null);
        setError('');
        setStatus(replacing ? 'Validating replacement PDF…' : 'Validating PDF…');
        setProgress(0);
        try {
            const checksum = await sha256(selected);
            const { data: duplicate, error: duplicateError } = await supabase.from('uploaded_pdfs').select('*').eq('checksum', checksum).maybeSingle();
            if (duplicateError)
                throw duplicateError;
            let document: DocumentRow;
            if (duplicate) {
                document = duplicate as DocumentRow;
                if (['completed', 'completed_with_warnings'].includes(document.processing_status) && document.processed_pages >= document.total_pdf_pages)
                    throw new Error('This PDF has already been processed.');
                setStatus(`Resuming interrupted processing for Part ${document.part_number}…`);
            }
            else {
                const inspection = await inspectPdf(selected);
                if (!parts.includes(inspection.part))
                    throw new Error(UNSUPPORTED);
                if (replacing && inspection.part !== replacing.part_number)
                    throw new Error(`Replacement must remain Part ${replacing.part_number}.`);
                if (replacing && inspection.language !== replacing.source_language)
                    throw new Error(`Replacement must remain ${(replacing.source_language ?? 'en').toUpperCase()} source language.`);
                let supersedes = replacing;
                if (!supersedes) {
                    const active = documents.filter(item => item.active_version && item.part_number === inspection.part && item.source_language === inspection.language).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
                    supersedes = active;
                }
                document = await createDocument(selected, checksum, inspection, supersedes);
            }
            const result = await processAndPersist(selected, document, (page, total, count, reviews) => { setProgress(Math.round(page / total * 100)); setStatus(`Page ${page} of ${total} · ${count} newly extracted · ${reviews} review pages`); });
            invalidateDataCache();
            setProgress(100);
            setStatus(result.status === 'interrupted' ? `Processing continued, but ${result.persistenceFailures} page${result.persistenceFailures === 1 ? '' : 's'} must be retried. Select the same PDF to resume.` : `${document.supersedes_id ? 'New revision activated' : 'Completed'} · ${result.records} stored records · ${result.reviews} review pages`);
            setFiles([]);
            setReplacement(null);
            setReplacementFile(null);
            await load();
            return null;
        }
        catch (uploadError) {
            const message = friendly(uploadError, 'Unable to process PDF');
            setError(message);
            return message;
        }
        finally {
            setBusy(false);
            setBusyId(null);
        }
    }
    async function ingestMany() {
        const selected = [...files];
        const failures: string[] = [];
        for (let index = 0; index < selected.length; index++) {
            setStatus(`Document ${index + 1} of ${selected.length} · ${selected[index].name}`);
            const failure = await ingest(selected[index]);
            if (failure)
                failures.push(`${selected[index].name}: ${failure}`);
        }
        if (failures.length)
            setError(failures.join('\n'));
    }
    async function destroy(document: DocumentRow) {
        if (!window.confirm(`Delete ${document.filename} and all ${document.records_count} linked voter records? This cannot be undone.`))
            return;
        setBusyId(document.id);
        setError('');
        try {
            await removeDocument(document);
            invalidateDataCache();
            setStatus('PDF and linked records deleted.');
            await load();
        }
        catch (deleteError) {
            setError(friendly(deleteError, 'Unable to delete PDF'));
        }
        finally {
            setBusyId(null);
        }
    }
    return <section className="workspace-body">
<div className="ingestion-grid">
<div>
<form className="upload-card" onSubmit={event => {
            event.preventDefault();
            if (files.length)
                void ingestMany();
        }}>
<div className="panel-heading">
<span>
<Upload />Multi-column voter PDF extractor</span>
</div>
<p>Upload one PDF or select Parts 227–230 together. Each document is processed independently and can resume after interruption.</p>
<label className="drop-zone">
<Upload />
<b>{files.length ? `${files.length} PDF${files.length === 1 ? '' : 's'} selected` : 'Select or drop voter-list PDFs'}</b>
<span>{files.map(file => file.name).join(' · ') || 'PDF only · Parts 227, 228, 229 and 230'}</span>
<input type="file" multiple accept="application/pdf,.pdf" onChange={event => setFiles([...event.target.files ?? []])}/>
</label>{status && <div className="progress-block">
<progress value={progress} max="100"/>
<span>{status}</span>
</div>}{error && <div className="notice error">{error}</div>}<button className="primary" disabled={!files.length || busy}>{busy ? 'Processing pages…' : files.length > 1 ? `Process ${files.length} PDFs` : 'Validate & process PDF'}</button>
</form>
<DocumentList documents={documents} admin busyId={busyId} onReplace={setReplacement} onDelete={document => void destroy(document)}/>
</div>
<aside className="architecture">
<h3>
<ShieldCheck />Accuracy controls</h3>
<ol>
<li>
<b>Three-column reconstruction</b>
<span>Prevents voter cards on the same row from being merged.</span>
</li>
<li>
<b>95% review gate</b>
<span>Low-confidence records are never presented as verified.</span>
</li>
<li>
<b>Resumable pages</b>
<span>Successful pages are retained if processing is interrupted.</span>
</li>
<li>
<b>Safe versioning</b>
<span>The prior roll remains searchable until the new revision completes.</span>
</li>
<li>
<b>Source traceability</b>
<span>Every record retains its PDF and printed page reference.</span>
</li>
</ol>
</aside>
</div>{replacement && <div className="modal-backdrop">
<form className="user-modal" onSubmit={event => {
                event.preventDefault();
                if (replacementFile)
                    void ingest(replacementFile, replacement);
            }}>
<header>
<div>
<small>PART {replacement.part_number}</small>
<h2>Create a new source revision</h2>
</div>
<button type="button" className="icon-button" onClick={() => { setReplacement(null); setReplacementFile(null); }}>
<X />
</button>
</header>
<p>The previous PDF remains available as historical evidence. Search switches to the new revision only after every page finishes or is safely marked for review.</p>
<label>Replacement PDF<input type="file" accept="application/pdf,.pdf" required onChange={event => setReplacementFile(event.target.files?.[0] ?? null)}/>
</label>
<footer>
<button type="button" className="secondary" onClick={() => setReplacement(null)}>Cancel</button>
<button className="primary" disabled={!replacementFile || busy}>
<RefreshCw />Process new revision</button>
</footer>
</form>
</div>}</section>;
}
function DocumentList({ documents, admin = false, busyId, onReplace, onDelete }: {
    documents: DocumentRow[];
    admin?: boolean;
    busyId?: string | null;
    onReplace?: (document: DocumentRow) => void;
    onDelete?: (document: DocumentRow) => void;
}) { return <section className="document-list">
<div className="panel-heading">
<span>
<Files />Uploaded electoral rolls ({documents.length})</span>
<NavLink to="/documents">View all <ChevronRight />
</NavLink>
</div>{documents.map(document => <article key={document.id} className={!document.active_version ? 'historical-version' : ''}>
<div>
<b>Part {document.part_number}: {document.filename}</b>
<span>{documentLanguage(document).toUpperCase()} · {document.revision_identifier ?? 'Revision not labeled'} · {document.total_pdf_pages} pages · {document.records_count.toLocaleString()} extracted · {new Date(document.uploaded_at).toLocaleDateString()}</span>
</div>
<span className={`version-badge ${document.active_version ? 'active' : 'historical'}`}>{document.active_version ? 'Active' : 'Historical'}</span>
<Status value={document.processing_status === 'completed' ? 'verified' : 'requires_review'}/>
<button className="secondary compact" onClick={() => void openSource(document.storage_path, 1)}>Open</button>{admin && <>
<button className="secondary compact" disabled={busyId === document.id} onClick={() => onReplace?.(document)}>
<RefreshCw />New revision</button>
<button className="danger compact" disabled={busyId === document.id} onClick={() => onDelete?.(document)}>
<Trash2 />Delete</button>
</>}</article>)}</section>; }
function InsightsPage({ lang }: {
    lang: Lang;
}) {
    const [records, setRecords] = useState<Voter[]>([]);
    const [documents, setDocuments] = useState<DocumentRow[]>([]);
    const [pageRows, setPageRows] = useState<PageRow[]>([]);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [part, setPart] = useState('all');
    const [language, setLanguage] = useState<RecordLanguage>(lang);
    const [languageCoverageRows, setLanguageCoverageRows] = useState<LanguageCoverage[]>([]);
    const [status, setStatus] = useState('all');
    const [gender, setGender] = useState('all');
    const [documentId, setDocumentId] = useState('all');
    const [minAge, setMinAge] = useState('');
    const [maxAgeFilter, setMaxAgeFilter] = useState('');
    const load = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            const [voters, docs, pages] = await Promise.all([fetchAllVoters('all', language), fetchDocuments(), fetchProcessingPages()]);
            setRecords(voters);
            setDocuments(docs);
            setPageRows(pages);
        }
        catch (loadError) {
            setError(friendly(loadError, 'Database temporarily unavailable'));
        }
        finally {
            setBusy(false);
        }
    }, [language]);
    useEffect(() => { setLanguage(lang); }, [lang]);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        let current = true;
        void fetchLanguageCoverage(part).then(rows => { if (current)
            setLanguageCoverageRows(rows); }).catch(loadError => { if (current)
            setError(friendly(loadError, 'Database temporarily unavailable')); });
        return () => { current = false; };
    }, [part]);
    const filteredDocuments = useMemo(() => documents.filter(document => (part === 'all' || document.part_number === Number(part)) && documentLanguage(document) === language && (documentId === 'all' || document.id === documentId)), [documents, part, language, documentId]);
    const documentIds = useMemo(() => new Set(filteredDocuments.map(document => document.id)), [filteredDocuments]);
    const filtered = useMemo(() => records.filter(record => documentIds.has(record.pdf_id) && (status === 'all' || record.verification_status === status) && (gender === 'all' || normalize(record.gender).startsWith(gender)) && (!minAge || record.age !== null && record.age >= Number(minAge)) && (!maxAgeFilter || record.age !== null && record.age <= Number(maxAgeFilter))), [records, documentIds, status, gender, minAge, maxAgeFilter]);
    const filteredPages = useMemo(() => pageRows.filter(page => documentIds.has(page.pdf_id)), [pageRows, documentIds]);
    const counts = useMemo(() => {
        const genders = { male: 0, female: 0, other: 0, missing: 0 }, ages = [0, 0, 0, 0, 0, 0];
        filtered.forEach(record => {
            const value = normalize(record.gender);
            if (!value)
                genders.missing++;
            else if (value.startsWith('m'))
                genders.male++;
            else if (value.startsWith('f'))
                genders.female++;
            else
                genders.other++;
            const age = record.age;
            if (age === null)
                ages[5]++;
            else if (age <= 25)
                ages[0]++;
            else if (age <= 35)
                ages[1]++;
            else if (age <= 50)
                ages[2]++;
            else if (age <= 65)
                ages[3]++;
            else
                ages[4]++;
        });
        return { genders, ages, review: filtered.filter(record => record.verification_status === 'requires_review').length, verified: filtered.filter(record => record.verification_status === 'verified').length, houses: new Set(filtered.map(record => `${record.part_number}:${record.normalized_house_number}`).filter(key => !key.endsWith(':'))).size };
    }, [filtered]);
    const maxAge = Math.max(...counts.ages, 1), total = Math.max(filtered.length, 1);
    const selectedCoverage = languageCoverageRows.find(row => row.source_language === language);
    const sourceCoveragePercent = selectedCoverage?.logical_total ? Math.min(100, selectedCoverage.source_records / selectedCoverage.logical_total * 100) : 0;
    const recordCounts = useMemo(() => { const map = new Map<string, number>(); records.forEach(record => map.set(record.pdf_id, (map.get(record.pdf_id) ?? 0) + 1)); return map; }, [records]);
    return <section className="workspace-body">{error && <div className="notice error">{error}</div>}<div className="section-toolbar">
<div>
<h2>Source-data dashboard</h2>
<p>Every metric is derived only from uploaded PDFs. Filters update all metrics, documents and page details together.</p>
</div>
<button className="secondary compact" onClick={() => void load()} disabled={busy}>
<RefreshCw />Refresh data</button>
</div>
<section className="insight-filters">
<label>Part<select value={part} onChange={event => { setPart(event.target.value); setDocumentId('all'); }}>
<option value="all">All 227–230</option>{parts.map(value => <option key={value}>{value}</option>)}</select>
</label>
<label>Source language<select value={language} onChange={event => { setLanguage(event.target.value as RecordLanguage); setDocumentId('all'); }}>
<option value="en">English</option>
<option value="te">Telugu</option>
<option value="ur">Urdu</option>
</select>
</label>
<label>Document<select value={documentId} onChange={event => setDocumentId(event.target.value)}>
<option value="all">All matching PDFs</option>{documents.filter(document => (part === 'all' || document.part_number === Number(part)) && documentLanguage(document) === language).map(document => <option key={document.id} value={document.id}>Part {document.part_number} · {documentLanguage(document).toUpperCase()}</option>)}</select>
</label>
<label>Verification<select value={status} onChange={event => setStatus(event.target.value)}>
<option value="all">All statuses</option>
<option value="verified">Verified</option>
<option value="unverified">Unverified</option>
<option value="requires_review">Requires review</option>
</select>
</label>
<label>Gender<select value={gender} onChange={event => setGender(event.target.value)}>
<option value="all">All</option>
<option value="m">Male</option>
<option value="f">Female</option>
</select>
</label>
<label>Age from<input type="number" min="18" value={minAge} onChange={event => setMinAge(event.target.value)}/>
</label>
<label>Age to<input type="number" min="18" value={maxAgeFilter} onChange={event => setMaxAgeFilter(event.target.value)}/>
</label>
<button className="secondary compact" onClick={() => { setPart('all'); setLanguage(lang); setDocumentId('all'); setStatus('all'); setGender('all'); setMinAge(''); setMaxAgeFilter(''); }}>
<X />Clear</button>
</section><LanguageCoveragePanel coverage={languageCoverageRows} lang={lang} busy={busy}/>
<div className="metric-grid">
<Metric label="Logical voters" value={busy ? '—' : formatNumber(selectedCoverage?.logical_total ?? 0, lang)} sub="Language copies are not added"/>
<Metric label={`${sourceLanguageNames[language]} source records`} value={busy ? '—' : formatNumber(filtered.length, lang)} sub={`${filteredDocuments.length} selected source PDFs`}/>
<Metric label="House numbers" value={busy ? '—' : formatNumber(counts.houses, lang)} sub="Same-house groups only"/>
<Metric label="Verified records" value={busy ? '—' : formatNumber(counts.verified, lang)} sub="Admin-reviewed"/>
<Metric label="Source coverage" value={busy ? '—' : `${sourceCoveragePercent.toFixed(1)}%`} sub={`${formatNumber(selectedCoverage?.source_records ?? 0, lang)} of ${formatNumber(selectedCoverage?.logical_total ?? 0, lang)} source rows`} warning={sourceCoveragePercent < 95}/>
</div>
<div className="chart-grid">
<section className="chart-card">
<h3>Age values in source PDFs</h3>
<div className="bar-chart">{['18–25', '26–35', '36–50', '51–65', '66+', 'Missing'].map((label, index) => <div key={label}>
<span style={{ height: `${Math.max(4, counts.ages[index] / maxAge * 100)}%` }}/>
<b>{label}</b>
<small>{formatNumber(counts.ages[index], lang)}</small>
</div>)}</div>
</section>
<section className="chart-card">
<h3>Gender values in source PDFs</h3>
<div className="gender-bars">{Object.entries(counts.genders).map(([label, count]) => <div key={label}>
<span>{label}</span>
<div>
<i style={{ width: `${count / total * 100}%` }}/>
</div>
<b>{formatNumber(count, lang)}</b>
</div>)}</div>
</section>
</div>
<section className="chart-card">
<h3>Records by supported Part</h3>
<div className="part-bars">{parts.map(value => { const count = filtered.filter(record => record.part_number === value).length; return <div key={value}>
<b>Part {value}</b>
<span>
<i style={{ width: `${count / total * 100}%` }}/>
</span>
<strong>{formatNumber(count, lang)}</strong>
</div>; })}</div>
</section>
<section className="dashboard-detail">
<h3>PDF detail and stored-record integrity</h3>
<div className="data-table">
<table>
<thead>
<tr>
<th>Part</th>
<th>Language</th>
<th>Filename</th>
<th>Pages</th>
<th>Extracted</th>
<th>Stored</th>
<th>Review pages</th>
<th>Status</th>
</tr>
</thead>
<tbody>{filteredDocuments.map(document => { const stored = recordCounts.get(document.id) ?? 0; return <tr key={document.id}>
<td>{document.part_number}</td>
<td>{documentLanguage(document).toUpperCase()}</td>
<td>{document.filename}</td>
<td>{document.total_pdf_pages}</td>
<td>{document.records_count}</td>
<td className={stored !== document.records_count ? 'integrity-warning' : ''}>{stored}</td>
<td>{document.failed_pages}</td>
<td>
<Status value={stored === document.records_count && document.processing_status === 'completed' ? 'verified' : 'requires_review'}/>
</td>
</tr>; })}</tbody>
</table>
</div>
</section>
<section className="dashboard-detail">
<h3>Every processed PDF page ({filteredPages.length})</h3>
<div className="data-table page-detail-table">
<table>
<thead>
<tr>
<th>Document</th>
<th>Part</th>
<th>PDF page</th>
<th>Printed page</th>
<th>Status</th>
<th>Open source</th>
</tr>
</thead>
<tbody>{filteredPages.map(page => { const document = documents.find(item => item.id === page.pdf_id); return <tr key={page.id}>
<td>{document?.filename ?? 'Document unavailable'}</td>
<td>{document?.part_number ?? '—'}</td>
<td>{page.pdf_page_number}</td>
<td>{show(page.printed_page_number, lang)}</td>
<td>
<Status value={page.status === 'processed' ? 'verified' : 'requires_review'}/>
</td>
<td>{document && <button className="secondary compact" onClick={() => void openSource(document.storage_path, page.pdf_page_number)}>
<ExternalLink />Open page</button>}</td>
</tr>; })}</tbody>
</table>
</div>
</section>
</section>;
}
function Metric({ label, value, sub, warning }: {
    label: string;
    value: string;
    sub: string;
    warning?: boolean;
}) { return <article className={`metric-card ${warning ? 'warning' : ''}`}>
<span>{label}</span>
<strong>{value}</strong>
<small>{sub}</small>
</article>; }
export function ReviewPage({ lang }: {
    lang: Lang;
}) {
    const [rows, setRows] = useState<Voter[]>([]);
    const [docs, setDocs] = useState<Record<string, DocumentRow>>({});
    const [edit, setEdit] = useState<Voter | null>(null);
    const [fields, setFields] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        const { data, error: reviewError } = await supabase.from('voter_records').select('*').or('verification_status.eq.requires_review,ocr_confidence.lt.95').order('part_number').order('pdf_page_number');
        if (reviewError)
            return setError(friendly(reviewError, 'Database temporarily unavailable'));
        const voters = (data ?? []) as Voter[];
        setRows(voters);
        void fetchDocuments([...new Set(voters.map((voter) => voter.pdf_id))]).then((documents) => setDocs(Object.fromEntries(documents.map((document) => [document.id, document]))));
    }, []);
    useEffect(() => { void load(); }, [load]);
    function open(voter: Voter) { setEdit(voter); setFields({ original_name: voter.corrected_value?.original_name || voter.original_name || '', original_relation_name: voter.corrected_value?.original_relation_name || voter.original_relation_name || '', original_house_number: voter.corrected_value?.original_house_number || voter.original_house_number || '', age: voter.corrected_value?.age || String(voter.age ?? ''), gender: voter.corrected_value?.gender || voter.gender || '', epic_number: voter.corrected_value?.epic_number || voter.epic_number || '' }); }
    async function save(verified: boolean) {
        if (!edit)
            return;
        setBusy(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error: saveError } = await supabase.from('voter_records').update({ corrected_value: fields, corrected_by: user?.id, corrected_at: new Date().toISOString(), verification_status: verified ? 'verified' : edit.verification_status }).eq('id', edit.id);
            if (saveError)
                throw saveError;
            invalidateDataCache();
            setEdit(null);
            await load();
        }
        catch (saveError) {
            setError(friendly(saveError, 'Unable to save correction'));
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="standalone-page">
<PageTitle title="OCR review queue" description="Correct uncertain fields while preserving original OCR text and source values."/>
<div className="summary-strip">
<span>
<AlertTriangle />{rows.length} records need attention</span>
<span>Only administrators can save or verify.</span>
</div>{error && <div className="notice error">{error}</div>}<div className="data-table">
<table>
<thead>
<tr>
<th>Issue</th>
<th>Part</th>
<th>PDF page</th>
<th>Voter</th>
<th>Confidence</th>
<th>Status</th>
<th>Action</th>
</tr>
</thead>
<tbody>{rows.map((voter) => <tr key={voter.id}>
<td>Low confidence or uncertain field</td>
<td>{voter.part_number}</td>
<td>{voter.pdf_page_number}</td>
<td>{show(voter.original_name, lang)}</td>
<td>{voter.ocr_confidence === null ? 'Text PDF' : `${voter.ocr_confidence.toFixed(0)}%`}</td>
<td>
<Status value={voter.verification_status}/>
</td>
<td>
<div className="row-actions">
<button className="secondary compact" onClick={() => {
                const doc = docs[voter.pdf_id];
                if (doc)
                    void openSource(doc.storage_path, voter.pdf_page_number);
            }}>
<ExternalLink />Source</button>
<button className="primary compact" onClick={() => open(voter)}>Review</button>
</div>
</td>
</tr>)}</tbody>
</table>
</div>{edit && <div className="modal-backdrop">
<section className="review-modal">
<header>
<div>
<small>Original values remain unchanged</small>
<h2>Correct OCR fields</h2>
</div>
<button className="icon-button" onClick={() => setEdit(null)}>
<X />
</button>
</header>
<pre>{edit.original_text}</pre>
<div className="review-grid">{Object.entries({ original_name: 'Name', original_relation_name: 'Relation name', original_house_number: 'House number', age: 'Age', gender: 'Gender', epic_number: 'EPIC' }).map(([key, label]) => <label key={key}>{label}<input value={fields[key] ?? ''} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}/>
</label>)}</div>
<footer>
<button className="secondary" disabled={busy} onClick={() => void save(false)}>Save correction</button>
<button className="primary" disabled={busy} onClick={() => void save(true)}>
<CheckCircle2 />Save & mark verified</button>
</footer>
</section>
</div>}</section>;
}
function DocumentsPage({ role }: {
    role: Role;
}) { const [documents, setDocuments] = useState<DocumentRow[]>([]); const [error, setError] = useState(''); useEffect(() => { fetchDocuments().then(setDocuments).catch(loadError => setError(friendly(loadError, 'Database temporarily unavailable'))); }, []); return <section className="standalone-page">
<PageTitle title="Source documents" description="Uploaded Pallerlamudi electoral-roll PDFs and processing status." action={role === 'admin' ? <NavLink className="primary" to="/upload">
<Upload />Manage PDFs</NavLink> : undefined}/>{error && <div className="notice error">{error}</div>}<div className="data-table">
<table>
<thead>
<tr>
<th>Part</th>
<th>Language</th>
<th>Filename</th>
<th>Pages</th>
<th>Extracted records</th>
<th>Review pages</th>
<th>Status</th>
<th>Uploaded</th>
<th>Action</th>
</tr>
</thead>
<tbody>{documents.map(document => <tr key={document.id}>
<td>{document.part_number}</td>
<td>{documentLanguage(document).toUpperCase()}</td>
<td>{document.filename}</td>
<td>{document.total_pdf_pages}</td>
<td>{document.records_count.toLocaleString()}</td>
<td>{document.failed_pages}</td>
<td>
<Status value={document.processing_status === 'completed' ? 'verified' : 'requires_review'}/>
</td>
<td>{new Date(document.uploaded_at).toLocaleDateString()}</td>
<td>
<button className="secondary compact" onClick={() => void openSource(document.storage_path, 1)}>
<ExternalLink />Open</button>
</td>
</tr>)}</tbody>
</table>
</div>
</section>; }
async function invokeAdmin<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (error)
        throw new Error('Unable to manage users right now.');
    const payload = data as T & {
        error?: string;
    };
    if (payload.error)
        throw new Error(payload.error);
    return payload;
}
function AdminPage() {
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [editor, setEditor] = useState<UserEditor | null>(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const load = useCallback(async () => {
        setBusy(true);
        try {
            setUsers((await invokeAdmin<{
                users: ManagedUser[];
            }>({ action: 'list' })).users);
        }
        catch (loadError) {
            setError(friendly(loadError, 'Unable to manage users right now.'));
        }
        finally {
            setBusy(false);
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    async function save(event: React.FormEvent) {
        event.preventDefault();
        if (!editor)
            return;
        if (editor.password && editor.password.length < 8)
            return setError('Password must contain at least 8 characters.');
        setBusy(true);
        setError('');
        try {
            await invokeAdmin({ action: editor.mode, id: editor.id, email: editor.email, password: editor.password || undefined, role: editor.isCurrent ? undefined : editor.role });
            setNotice(editor.mode === 'create' ? 'Authorized user created.' : 'Authorized user updated.');
            setEditor(null);
            await load();
        }
        catch (saveError) {
            setError(friendly(saveError, 'Unable to manage users right now.'));
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="standalone-page">
<PageTitle title="Authorized user administration" description="Only administrators can create accounts or change roles, email, and passwords." action={<button className="primary" onClick={() => setEditor({ mode: 'create', email: '', password: '', role: 'viewer' })}>
<UserRound />Add user</button>}/>{error && <div className="notice error">{error}</div>}{notice && <div className="notice success">{notice}</div>}<div className="data-table">
<table>
<thead>
<tr>
<th>Email</th>
<th>Role</th>
<th>Created</th>
<th>Last sign-in</th>
<th>Action</th>
</tr>
</thead>
<tbody>{users.map((user) => <tr key={user.id}>
<td>{user.email}</td>
<td>
<span className={`role-badge ${user.role}`}>{user.role}</span>
</td>
<td>{new Date(user.created_at).toLocaleDateString()}</td>
<td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</td>
<td>
<button className="secondary compact" onClick={() => setEditor({ mode: 'edit', id: user.id, email: user.email ?? '', password: '', role: user.role, isCurrent: user.is_current })}>Edit</button>
</td>
</tr>)}</tbody>
</table>{busy && <p className="empty-row">Loading authorized users…</p>}</div>
<div className="admin-links">
<NavLink to="/upload">
<Upload />Upload PDF</NavLink>
<NavLink to="/review">
<AlertTriangle />Review OCR</NavLink>
<NavLink to="/documents">
<Files />Documents</NavLink>
<NavLink to="/insights">
<BarChart3 />Insights</NavLink>
</div>{editor && <div className="modal-backdrop">
<form className="user-modal" onSubmit={save}>
<header>
<h2>{editor.mode === 'create' ? 'Create authorized user' : 'Edit authorized user'}</h2>
<button type="button" className="icon-button" onClick={() => setEditor(null)}>
<X />
</button>
</header>
<label>Email<input type="email" required value={editor.email} onChange={(event) => setEditor({ ...editor, email: event.target.value })}/>
</label>
<label>{editor.mode === 'create' ? 'Password' : 'New password (optional)'}<input type="password" required={editor.mode === 'create'} minLength={8} value={editor.password} onChange={(event) => setEditor({ ...editor, password: event.target.value })}/>
</label>
<label>Role<select disabled={editor.isCurrent} value={editor.role} onChange={(event) => setEditor({ ...editor, role: event.target.value as Role })}>
<option value="viewer">Viewer</option>
<option value="admin">Admin</option>
</select>
</label>
<footer>
<button type="button" className="secondary" onClick={() => setEditor(null)}>Cancel</button>
<button className="primary" disabled={busy}>Save user</button>
</footer>
</form>
</div>}</section>;
}
function ProfilePage({ role }: {
    role: Role;
}) {
    const [account, setAccount] = useState<{
        id: string;
        email?: string;
        created?: string;
        last?: string;
    } | null>(null);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    useEffect(() => {
        void supabase.auth.getUser().then(({ data }) => {
            if (data.user)
                setAccount({ id: data.user.id, email: data.user.email, created: data.user.created_at, last: data.user.last_sign_in_at });
        });
    }, []);
    async function change(event: React.FormEvent) {
        event.preventDefault();
        setError('');
        setNotice('');
        const validation = validatePasswordChange(password, confirm);
        if (validation === 'too_short')
            return setError('Password must contain at least 8 characters.');
        if (validation === 'mismatch')
            return setError('Passwords do not match.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError)
            setError('Unable to update password.');
        else {
            setNotice('Password updated.');
            setPassword('');
            setConfirm('');
        }
    }
    return <section className="standalone-page">
<PageTitle title="Profile & permissions" description="Your authorized account, current role, and security settings."/>{error && <div className="notice error">{error}</div>}{notice && <div className="notice success">{notice}</div>}<div className="profile-grid">
<section className="profile-card">
<div className="profile-icon">
<UserRound />
</div>
<h2>{account?.email ?? 'Authorized user'}</h2>
<span className={`role-badge ${role}`}>{role}</span>
<dl>
<dt>User ID</dt>
<dd>{account?.id ?? 'Loading…'}</dd>
<dt>Created</dt>
<dd>{account?.created ? new Date(account.created).toLocaleString() : 'Not available'}</dd>
<dt>Last sign-in</dt>
<dd>{account?.last ? new Date(account.last).toLocaleString() : 'Not available'}</dd>
<dt>Supported Parts</dt>
<dd>227, 228, 229, 230</dd>
</dl>
</section>
<form className="profile-card" onSubmit={change}>
<div className="panel-heading">
<span>
<KeyRound />Change password</span>
</div>
<label>New password<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)}/>
</label>
<label>Confirm password<input type="password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)}/>
</label>
<button className="primary">Update password</button>
<p>{role === 'admin' ? 'Admin: upload, review, correct, verify, search, view sources, and manage users.' : 'Viewer: search, view results, documents, and original source pages.'}</p>
</form>
</div>
</section>;
}
function PageTitle({ title, description, action }: {
    title: string;
    description: string;
    action?: React.ReactNode;
}) { return <div className="page-title">
<div>
<span className="eyebrow">జనసూచి — JANASOOCHI</span>
<h1>{title}</h1>
<p>{description}</p>
</div>{action}</div>; }
export default function App() {
    const [user, setUser] = useState(false);
    const [role, setRole] = useState<Role>('viewer');
    const [loading, setLoading] = useState(true);
    const [lang, setLangState] = useState<Lang>(() => {
        const stored = localStorage.getItem('pv-lang');
        return stored === 'te' || stored === 'ur' ? stored : 'en';
    });
    useEffect(() => {
        let active = true;
        const signedOut = (expired = false) => {
            if (active) {
                const manual = sessionStorage.getItem('pv-manual-signout') === 'true';
                sessionStorage.removeItem('pv-manual-signout');
                if (expired && !manual && window.location.pathname !== '/login') {
                    sessionStorage.setItem('pv-auth-message', 'Your session has expired. Please sign in again.');
                    sessionStorage.setItem('pv-return-to', `${window.location.pathname}${window.location.search}`);
                }
                setUser(false);
                setRole('viewer');
                setLoading(false);
            }
        };
        async function applyUser(id: string) {
            if (!active)
                return;
            setLoading(true);
            const { data, error } = await supabase.from('profiles').select('role').eq('id', id).single();
            if (!active)
                return;
            if (error)
                console.error(error);
            setRole(data?.role === 'admin' ? 'admin' : 'viewer');
            setUser(true);
            setLoading(false);
        }
        void supabase.auth.getUser().then(({ data, error }) => error || !data.user ? signedOut() : void applyUser(data.user.id));
        const { data } = supabase.auth.onAuthStateChange((event, session) => window.setTimeout(() => session ? void applyUser(session.user.id) : signedOut(event === 'SIGNED_OUT'), 0));
        return () => { active = false; data.subscription.unsubscribe(); };
    }, []);
    function setLang(next: Lang) { localStorage.setItem('pv-lang', next); setLangState(next); }
    if (loading)
        return <div className="loading-screen">
<img className="loading-logo" src="/janasoochi-mark-192.png" alt=""/>
<p>Loading authorized workspace…</p>
</div>;
    return <Routes>
<Route path="/login" element={user ? <Navigate to="/search"/> : <Login />}/>
<Route path="*" element={user ? <Shell role={role} lang={lang} setLang={setLang}/> : <Navigate to="/login"/>}/>
</Routes>;
}
