'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Download, LoaderCircle, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react'

import { filterUserDirectory } from '../lib/admin/user-filter'
import { createClient } from '../lib/supabase/client'
import { useLanguage } from './language-provider'

type Role = 'admin' | 'viewer'
type ManagedUser = { id: string; email: string | null; role: Role; created_at: string; last_sign_in_at: string | null; is_current: boolean }
type UserResponse = { users?: ManagedUser[]; total?: number; error?: string }
type Source = Record<string, unknown> & { language?: 'en' | 'te' | 'ur' }
type MasterRow = { logical_voter_id: string; part_number: number; serial_number: string; verification_status: string; verified_at: string | null; source_records: Source[]; total_count: number | string }
type ExportRow = { id: string; export_format: string; status: string; record_count: number | null; requested_at: string; completed_at: string | null }
type RpcResult = { data: unknown; error: { message: string } | null }

const COPY = {
  en: { create: 'Create authorized user', edit: 'Edit authorized user', email: 'Email address', password: 'Password', optionalPassword: 'New password (leave blank to keep current)', role: 'Role', save: 'Save user', usersError: 'Unable to load authorized users.', saveError: 'Unable to save this user.', saved: 'Authorized user saved.', current: 'Current account', created: 'Created', lastSignIn: 'Last sign-in', exportError: 'Unable to create an audited export.', exporting: 'Preparing the canonical dataset…', exportDone: 'Audited export downloaded.', directory: 'Authorized users', audit: 'Exports contain the 3,454 canonical slots and linked source-language records; every download is audited.', filterUsers: 'Filter this page by email', allRoles: 'All roles', shown: 'shown on this page', exportHistory: 'Recent audited exports', exportHistoryError: 'Unable to load export history.', requested: 'Requested', records: 'Records' },
  te: { create: 'అధీకృత వినియోగదారుని సృష్టించండి', edit: 'అధీకృత వినియోగదారుని సవరించండి', email: 'ఇమెయిల్ చిరునామా', password: 'పాస్‌వర్డ్', optionalPassword: 'కొత్త పాస్‌వర్డ్ (ప్రస్తుతది ఉంచడానికి ఖాళీగా వదలండి)', role: 'పాత్ర', save: 'వినియోగదారుని సేవ్ చేయండి', usersError: 'అధీకృత వినియోగదారులను లోడ్ చేయలేకపోయాం.', saveError: 'ఈ వినియోగదారుని సేవ్ చేయలేకపోయాం.', saved: 'అధీకృత వినియోగదారు సేవ్ అయ్యారు.', current: 'ప్రస్తుత ఖాతా', created: 'సృష్టించబడింది', lastSignIn: 'చివరి సైన్-ఇన్', exportError: 'ఆడిట్ చేసిన ఎగుమతిని సృష్టించలేకపోయాం.', exporting: 'ప్రామాణిక డేటాసెట్ సిద్ధమవుతోంది…', exportDone: 'ఆడిట్ చేసిన ఎగుమతి డౌన్‌లోడ్ అయింది.', directory: 'అధీకృత వినియోగదారులు', audit: 'ఎగుమతుల్లో 3,454 ప్రామాణిక స్థానాలు, అనుసంధానమైన మూల-భాష రికార్డులు ఉంటాయి; ప్రతి డౌన్‌లోడ్ ఆడిట్ అవుతుంది.', filterUsers: 'ఈ పేజీని ఇమెయిల్‌తో ఫిల్టర్ చేయండి', allRoles: 'అన్ని పాత్రలు', shown: 'ఈ పేజీలో చూపబడినవి', exportHistory: 'ఇటీవలి ఆడిట్ ఎగుమతులు', exportHistoryError: 'ఎగుమతి చరిత్రను లోడ్ చేయలేకపోయాం.', requested: 'అభ్యర్థించిన సమయం', records: 'రికార్డులు' },
  ur: { create: 'مجاز صارف بنائیں', edit: 'مجاز صارف میں ترمیم', email: 'ای میل پتہ', password: 'پاس ورڈ', optionalPassword: 'نیا پاس ورڈ (موجودہ رکھنے کے لیے خالی چھوڑیں)', role: 'کردار', save: 'صارف محفوظ کریں', usersError: 'مجاز صارفین لوڈ نہیں ہو سکے۔', saveError: 'صارف محفوظ نہیں ہو سکا۔', saved: 'مجاز صارف محفوظ ہو گیا۔', current: 'موجودہ اکاؤنٹ', created: 'بنایا گیا', lastSignIn: 'آخری سائن ان', exportError: 'آڈٹ شدہ برآمد نہیں بن سکی۔', exporting: 'کینونیکل ڈیٹاسیٹ تیار ہو رہا ہے…', exportDone: 'آڈٹ شدہ برآمد ڈاؤن لوڈ ہو گئی۔', directory: 'مجاز صارفین', audit: 'برآمد میں 3,454 کینونیکل سلاٹس اور منسلک ماخذ زبان ریکارڈ شامل ہیں؛ ہر ڈاؤن لوڈ آڈٹ ہوتا ہے۔', filterUsers: 'اس صفحے کو ای میل سے فلٹر کریں', allRoles: 'تمام کردار', shown: 'اس صفحے پر دکھائے گئے', exportHistory: 'حالیہ آڈٹ شدہ برآمدات', exportHistoryError: 'برآمد کی تاریخ لوڈ نہیں ہو سکی۔', requested: 'درخواست', records: 'ریکارڈز' },
} as const

export function AdminConsole() {
  const { language, t } = useLanguage()
  const copy = COPY[language]
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<ManagedUser | 'new' | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [exports, setExports] = useState<ExportRow[]>([])
  const perPage = 25
  const filteredUsers = useMemo(() => filterUserDirectory(users, userSearch, roleFilter), [roleFilter, userSearch, users])

  const loadUsers = useCallback(async (nextPage: number) => {
    setBusy(true); setError('')
    try {
      const { data, error: invokeError } = await createClient().functions.invoke<UserResponse>('admin-users', { body: { action: 'list', page: nextPage, perPage } })
      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)
      setUsers(data?.users ?? [])
      setTotal(Number(data?.total ?? data?.users?.length ?? 0))
      setPage(nextPage)
    } catch (loadError) {
      console.error('Admin user list failed', loadError)
      setError(copy.usersError)
    } finally { setBusy(false) }
  }, [copy.usersError])

  useEffect(() => { void loadUsers(1) }, [loadUsers])

  const loadExports = useCallback(async () => {
    const { data, error: exportHistoryError } = await createClient().from('dataset_exports').select('id,export_format,status,record_count,requested_at,completed_at').order('requested_at', { ascending: false }).limit(10)
    if (exportHistoryError) { console.error('Export history failed', exportHistoryError); setError(copy.exportHistoryError); return }
    setExports((data ?? []) as ExportRow[])
  }, [copy.exportHistoryError])

  useEffect(() => { void loadExports() }, [loadExports])

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setBusy(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const role = String(form.get('role') ?? 'viewer') as Role
    try {
      const body = editing === 'new'
        ? { action: 'create', email, password, role }
        : { action: 'update', id: editing.id, email, password: password || undefined, role }
      const { data, error: invokeError } = await createClient().functions.invoke<UserResponse>('admin-users', { body })
      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)
      setEditing(null)
      setNotice(copy.saved)
      await loadUsers(page)
    } catch (saveError) {
      console.error('Admin user save failed', saveError)
      setError(saveError instanceof Error && saveError.message ? saveError.message : copy.saveError)
    } finally { setBusy(false) }
  }

  async function exportDataset(format: 'csv' | 'json') {
    setBusy(true); setError(''); setNotice(copy.exporting)
    try {
      const client = createClient()
      const rows: MasterRow[] = []
      for (let offset = 0; ; offset += 200) {
        const response = await client.rpc('get_master_dataset_page' as never, { p_limit: 200, p_offset: offset } as never) as RpcResult
        if (response.error) throw response.error
        const pageRows = (response.data ?? []) as MasterRow[]
        rows.push(...pageRows)
        if (pageRows.length < 200) break
      }
      const audited = await client.rpc('record_dataset_export' as never, { p_format: format, p_record_count: rows.length, p_status: 'completed', p_error_message: null } as never) as RpcResult
      if (audited.error) throw audited.error
      const payload = format === 'json' ? JSON.stringify({ generated_at: new Date().toISOString(), logical_voter_count: rows.length, voters: rows }, null, 2) : toCsv(rows)
      const blob = new Blob([payload], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `JANASOOCHI-master-${new Date().toISOString().slice(0, 10)}.${format}`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice(copy.exportDone)
      await loadExports()
    } catch (exportError) {
      console.error('Dataset export failed', exportError)
      setNotice('')
      setError(copy.exportError)
    } finally { setBusy(false) }
  }

  return <>
    <div className="admin-actions"><button className="button primary" type="button" onClick={() => setEditing('new')}><Plus aria-hidden="true" />{copy.create}</button><button className="button secondary" type="button" disabled={busy} onClick={() => void loadUsers(page)}>{busy ? <LoaderCircle className="spin" /> : <RefreshCw />}{t('refresh')}</button></div>
    {error && <p className="error-notice" role="alert">{error}</p>}{notice && <p className="success-notice" role="status"><CheckCircle2 />{notice}</p>}
    <section className="surface-panel"><div className="panel-header"><div><h2>{copy.directory}</h2><p>{t('accessControlHelp')}</p></div><span className="panel-meta">{total.toLocaleString('en-IN')}</span></div><div className="admin-directory-filter"><label><Search aria-hidden="true" /><input type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={copy.filterUsers} /></label><select aria-label={copy.role} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | Role)}><option value="all">{copy.allRoles}</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select><span>{filteredUsers.length} {copy.shown}</span></div><div className="data-table-wrap"><table><thead><tr><th>{copy.email}</th><th>{copy.role}</th><th>{copy.created}</th><th>{copy.lastSignIn}</th><th>{t('actions')}</th></tr></thead><tbody>{filteredUsers.map((managed) => <tr key={managed.id}><td><strong>{managed.email ?? t('notAvailable')}</strong>{managed.is_current && <small>{copy.current}</small>}</td><td><span className={`role-badge ${managed.role}`}>{managed.role}</span></td><td>{new Date(managed.created_at).toLocaleDateString()}</td><td>{managed.last_sign_in_at ? new Date(managed.last_sign_in_at).toLocaleString() : t('notAvailable')}</td><td><button className="button secondary small" type="button" onClick={() => setEditing(managed)}><Pencil />{copy.edit}</button></td></tr>)}</tbody></table>{!filteredUsers.length && <p className="empty-row">{t('noResultsText')}</p>}</div><nav className="table-pagination"><button className="button secondary small" disabled={page <= 1 || busy} onClick={() => void loadUsers(page - 1)}><ChevronLeft />{t('previous')}</button><span>{t('page')} {page} {t('of')} {Math.max(1, Math.ceil(total / perPage))}</span><button className="button secondary small" disabled={page >= Math.ceil(total / perPage) || busy} onClick={() => void loadUsers(page + 1)}>{t('next')}<ChevronRight /></button></nav></section>
    <section className="surface-panel"><div className="panel-header"><div><h2>{t('auditedExports')}</h2><p>{copy.audit}</p></div></div><div className="export-actions"><button className="button secondary" disabled={busy} onClick={() => void exportDataset('csv')}><Download />{t('exportCsv')}</button><button className="button secondary" disabled={busy} onClick={() => void exportDataset('json')}><Download />{t('exportJson')}</button></div><div className="data-table-wrap"><table><thead><tr><th>{copy.exportHistory}</th><th>{copy.records}</th><th>{copy.requested}</th><th>{t('status')}</th></tr></thead><tbody>{exports.map((item) => <tr key={item.id}><td><strong>{item.export_format.toUpperCase()}</strong></td><td>{item.record_count?.toLocaleString('en-IN') ?? t('notAvailable')}</td><td>{new Date(item.requested_at).toLocaleString()}</td><td><span className={`status ${item.status}`}>{item.status}</span></td></tr>)}</tbody></table>{!exports.length && <p className="empty-row">{t('noResultsText')}</p>}</div></section>
    {editing && <div className="modal-backdrop" role="presentation"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title"><header><h2 id="user-dialog-title">{editing === 'new' ? copy.create : copy.edit}</h2><button className="icon-button" type="button" onClick={() => setEditing(null)}><X /></button></header><form onSubmit={(event) => void saveUser(event)}><label>{copy.email}<input name="email" type="email" required defaultValue={editing === 'new' ? '' : editing.email ?? ''} /></label><label>{editing === 'new' ? copy.password : copy.optionalPassword}<input name="password" type="password" minLength={8} required={editing === 'new'} /></label><label>{copy.role}<select name="role" defaultValue={editing === 'new' ? 'viewer' : editing.role}><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><footer><button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" />}{copy.save}</button></footer></form></section></div>}
  </>
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

function toCsv(rows: MasterRow[]) {
  const header = ['logical_voter_id', 'part_number', 'serial_number', 'verification_status', 'verified_at', 'english_sources', 'telugu_sources', 'urdu_sources']
  const body = rows.map((row) => {
    const byLanguage = (code: 'en' | 'te' | 'ur') => row.source_records.filter((source) => source.language === code)
    return [row.logical_voter_id, row.part_number, row.serial_number, row.verification_status, row.verified_at, byLanguage('en'), byLanguage('te'), byLanguage('ur')].map(csvCell).join(',')
  })
  return [header.join(','), ...body].join('\r\n')
}

