'use client'

import { useMemo, useState } from 'react'
import { FileUp, LoaderCircle } from 'lucide-react'

import { PART_IMPORT_COLUMNS, parsePartImportCsv } from '../lib/admin/part-import'
import { createClient } from '../lib/supabase/client'
import { EMPTY_GEOGRAPHY_SCOPE, GeographyScopeSelector, type GeographyScope } from './geography-scope'

type ImportResult = { imported_part_id: string; imported_part_number: number; import_action: 'inserted' | 'updated' }

export function PartImportPanel() {
  const [scope, setScope] = useState<GeographyScope>(EMPTY_GEOGRAPHY_SCOPE)
  const [csv, setCsv] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<ImportResult[]>([])
  const parsed = useMemo(() => (csv.trim() ? parsePartImportCsv(csv) : null), [csv])
  const ready = Boolean(scope.acId && scope.revisionId && sourceReference.trim() && parsed?.rows.length && !parsed.errors.length)

  async function loadFile(file: File | undefined) {
    if (!file) return
    if (file.size > 1_000_000) { setError('The CSV file is larger than 1 MB.'); return }
    setCsv(await file.text())
    setResults([])
  }

  async function submit() {
    if (!ready || !parsed) return
    setBusy(true); setError(''); setResults([])
    try {
      const { data, error: rpcError } = await createClient().rpc('import_verified_electoral_parts_v1', {
        p_assembly_constituency_id: scope.acId,
        p_revision_id: scope.revisionId,
        p_source_reference: sourceReference.trim(),
        p_parts: parsed.rows,
      })
      if (rpcError) throw rpcError
      setResults((data ?? []) as ImportResult[])
      setCsv('')
    } catch (importError) {
      console.error('Part import failed', importError)
      setError(importError instanceof Error || (importError && typeof importError === 'object' && 'message' in importError) ? String((importError as { message: string }).message) : 'Unable to import these Parts.')
    } finally { setBusy(false) }
  }

  const inserted = results.filter((row) => row.import_action === 'inserted').length

  return (
    <section className="surface-panel part-import-panel">
      <div className="panel-header"><div><h2>Import verified Parts</h2><p>Add or correct Parts for one Assembly Constituency and revision, using the figures printed on the official roll header. Every import is audited; nothing is created without a source reference.</p></div></div>
      <GeographyScopeSelector value={scope} onChange={(next) => { setScope(next); setResults([]) }} />
      {!(scope.acId && scope.revisionId) && <p className="inline-notice">Choose the Assembly Constituency and revision the Parts belong to.</p>}
      <div className="part-import-fields">
        <label><span>Source reference</span><input value={sourceReference} maxLength={500} onChange={(event) => setSourceReference(event.target.value)} placeholder="e.g. 2026 final roll, AC 87 Part headers (page 1), checked by …" /></label>
        <label><span>CSV ({PART_IMPORT_COLUMNS.join(', ')})</span><textarea rows={6} value={csv} onChange={(event) => { setCsv(event.target.value); setResults([]) }} placeholder={'part_number,expected_voter_total,polling_station_name\n227,1014,M.P.P. School'} spellCheck={false} /></label>
        <label className="button secondary"><FileUp aria-hidden="true" />Load CSV file<input type="file" accept=".csv,text/csv" hidden onChange={(event) => void loadFile(event.target.files?.[0])} /></label>
      </div>
      {parsed?.errors.length ? <ul className="error-notice" role="alert">{parsed.errors.slice(0, 20).map((message) => <li key={message}>{message}</li>)}</ul> : null}
      {parsed && !parsed.errors.length && <div className="data-table-wrap"><table><thead><tr><th>Part</th><th>Voters</th><th>Serials</th><th>Polling station</th></tr></thead><tbody>{parsed.rows.slice(0, 50).map((row) => <tr key={row.part_number}><td><strong>{row.part_number}</strong></td><td>{row.expected_voter_total.toLocaleString('en-IN')}</td><td>{row.expected_serial_start}–{row.expected_serial_end}</td><td>{row.polling_station_name ?? '—'}</td></tr>)}</tbody></table>{parsed.rows.length > 50 && <p className="empty-row">+{parsed.rows.length - 50} more</p>}</div>}
      {error && <p className="error-notice" role="alert">{error}</p>}
      {results.length > 0 && <p className="success-notice" role="status">Imported {results.length} Part{results.length === 1 ? '' : 's'}: {inserted} new, {results.length - inserted} updated.</p>}
      <div className="export-actions"><button className="button primary" type="button" disabled={!ready || busy} onClick={() => void submit()}>{busy && <LoaderCircle className="spin" />}Import {parsed?.rows.length ?? 0} verified Part{parsed?.rows.length === 1 ? '' : 's'}</button></div>
    </section>
  )
}
