'use client'

import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, MapPinned } from 'lucide-react'
import { createClient } from '../lib/supabase/client'

export type GeographyScope = {
  stateId: string
  pcId: string
  acId: string
  revisionId: string
  partId: string
  partNumber: number | null
}

type StateRow = { id: string; code: string; name: string }
type PcRow = { id: string; pc_number: number; name: string; state_id: string }
type AcRow = { id: string; ac_number: number; name: string; state_id: string; parliamentary_constituency_id: string }
type RevisionRow = { id: string; code: string; revision_year: number | null; state_id: string }
type PartRow = { id: string; part_number: number; polling_station_name: string | null; assembly_constituency_id: string; revision_id: string }

const EMPTY: GeographyScope = { stateId: '', pcId: '', acId: '', revisionId: '', partId: '', partNumber: null }

export function scopeHasNarrowing(scope: GeographyScope) {
  return Boolean(scope.pcId || scope.acId || scope.revisionId || scope.partId)
}

export function scopeRpcParams(scope: GeographyScope) {
  return {
    p_electoral_part_id: scope.partId || null,
    p_assembly_constituency_id: scope.acId || null,
    p_parliamentary_constituency_id: scope.pcId || null,
    p_revision_id: scope.revisionId || null,
  }
}

export function GeographyScopeSelector({ value = EMPTY, onChange, requiredPart = false }: { value?: GeographyScope; onChange: (scope: GeographyScope) => void; requiredPart?: boolean }) {
  const [states, setStates] = useState<StateRow[]>([])
  const [pcs, setPcs] = useState<PcRow[]>([])
  const [acs, setAcs] = useState<AcRow[]>([])
  const [revisions, setRevisions] = useState<RevisionRow[]>([])
  const [parts, setParts] = useState<PartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const supabase = createClient()
        const [stateResult, pcResult, acResult, revisionResult, partResult] = await Promise.all([
          supabase.from('states').select('id,code,name').eq('code', 'AP').order('name'),
          supabase.from('parliamentary_constituencies').select('id,pc_number,name,state_id').order('pc_number'),
          supabase.from('assembly_constituencies').select('id,ac_number,name,state_id,parliamentary_constituency_id').order('ac_number'),
          supabase.from('electoral_revisions').select('id,code,revision_year,state_id').order('revision_year', { ascending: false, nullsFirst: false }).order('code'),
          supabase.from('electoral_parts').select('id,part_number,polling_station_name,assembly_constituency_id,revision_id').order('part_number').limit(5000),
        ])
        const failed = [stateResult, pcResult, acResult, revisionResult, partResult].find((result) => result.error)
        if (failed?.error) throw failed.error
        if (!active) return
        const loadedStates = (stateResult.data ?? []) as StateRow[]
        setStates(loadedStates)
        setPcs((pcResult.data ?? []) as PcRow[])
        setAcs((acResult.data ?? []) as AcRow[])
        setRevisions((revisionResult.data ?? []) as RevisionRow[])
        setParts((partResult.data ?? []) as PartRow[])
        if (!value.stateId && loadedStates[0]) onChange({ ...EMPTY, stateId: loadedStates[0].id })
      } catch (loadError) {
        console.error('Geography options query failed', loadError)
        if (active) setError('Geography options are unavailable. No statewide data was inferred.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
    // The initial option load must not reset a user selection on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const state = states.find((item) => item.id === value.stateId)
  const visiblePcs = useMemo(() => pcs.filter((item) => !value.stateId || item.state_id === value.stateId), [pcs, value.stateId])
  const visibleAcs = useMemo(() => acs.filter((item) => (!value.stateId || item.state_id === value.stateId) && (!value.pcId || item.parliamentary_constituency_id === value.pcId)), [acs, value.pcId, value.stateId])
  const visibleRevisions = useMemo(() => revisions.filter((item) => !value.stateId || item.state_id === value.stateId), [revisions, value.stateId])
  const visibleParts = useMemo(() => {
    const pcAcIds = value.pcId ? new Set(visibleAcs.filter((item) => item.parliamentary_constituency_id === value.pcId).map((item) => item.id)) : null
    return parts.filter((item) => (!pcAcIds || pcAcIds.has(item.assembly_constituency_id)) && (!value.acId || item.assembly_constituency_id === value.acId) && (!value.revisionId || item.revision_id === value.revisionId))
  }, [parts, value.acId, value.pcId, value.revisionId, visibleAcs])

  function update(patch: Partial<GeographyScope>) {
    const next = { ...value, ...patch }
    onChange(next)
  }

  return <section className="geography-scope" aria-label="Electoral geography scope">
    <div className="geography-scope-heading"><MapPinned aria-hidden="true" /><span><strong>Electoral scope</strong><small>Andhra Pradesh → PC → AC → Revision → Part</small></span>{loading && <LoaderCircle className="spin" aria-label="Loading geography" />}</div>
    {error && <p className="inline-notice" role="status">{error}</p>}
    <div className="geography-scope-grid">
      <label><span>State</span><select value={value.stateId} onChange={(event) => update({ stateId: event.target.value, pcId: '', acId: '', revisionId: '', partId: '', partNumber: null })} disabled={loading || !states.length}><option value="">{loading ? 'Loading…' : 'Select state'}</option>{states.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
      <label><span>Parliamentary Constituency</span><select value={value.pcId} onChange={(event) => update({ pcId: event.target.value, acId: '', partId: '', partNumber: null })} disabled={loading || !state}><option value="">All PCs</option>{visiblePcs.map((item) => <option key={item.id} value={item.id}>PC {item.pc_number} · {item.name}</option>)}</select></label>
      <label><span>Assembly Constituency</span><select value={value.acId} onChange={(event) => update({ acId: event.target.value, partId: '', partNumber: null })} disabled={loading || !state}><option value="">All ACs</option>{visibleAcs.map((item) => <option key={item.id} value={item.id}>AC {item.ac_number} · {item.name}</option>)}</select></label>
      <label><span>Revision</span><select value={value.revisionId} onChange={(event) => update({ revisionId: event.target.value, partId: '', partNumber: null })} disabled={loading || !state}><option value="">All revisions</option>{visibleRevisions.map((item) => <option key={item.id} value={item.id}>{item.code}{item.revision_year ? ` · ${item.revision_year}` : ''}</option>)}</select></label>
      <label><span>Part / polling station{requiredPart ? ' *' : ''}</span><select value={value.partId} onChange={(event) => { const part = visibleParts.find((item) => item.id === event.target.value); update({ partId: event.target.value, partNumber: part?.part_number ?? null, acId: value.acId || (part ? acs.find((item) => item.id === part.assembly_constituency_id)?.id ?? '' : ''), revisionId: value.revisionId || part?.revision_id || '' }) }} disabled={loading || !state || !visibleParts.length}><option value="">{visibleParts.length ? 'All Parts' : 'No verified Parts configured'}</option>{visibleParts.map((item) => <option key={item.id} value={item.id}>Part {item.part_number}{item.polling_station_name ? ` · ${item.polling_station_name}` : ''}</option>)}</select></label>
    </div>
    {!loading && scopeHasNarrowing(value) && !value.partId && <p className="inline-notice">Choose a verified Part to query records in this narrowed scope. Empty statewide Parts are not fabricated.</p>}
  </section>
}

export const EMPTY_GEOGRAPHY_SCOPE = EMPTY
