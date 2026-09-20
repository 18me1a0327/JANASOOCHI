import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const script = readFileSync(resolve('public/sw.js'), 'utf8')

function worker(fetch = vi.fn().mockResolvedValue({ ok: true })) {
  const listeners: Record<string, (event: unknown) => void> = {}
  const addAll = vi.fn().mockResolvedValue(undefined)
  const match = vi.fn().mockResolvedValue({ offline: true })
  runInNewContext(script, {
    self: { location: { origin: 'https://example.test' }, addEventListener: (name: string, handler: (event: unknown) => void) => { listeners[name] = handler }, skipWaiting: vi.fn(), clients: { claim: vi.fn() } },
    caches: { open: vi.fn().mockResolvedValue({ addAll }), match }, fetch, URL,
  })
  return { listeners, addAll, match, fetch }
}

describe('PWA sensitive-data cache boundary', () => {
  it('installs only the public offline shell and icons', async () => {
    const w = worker()
    let pending: Promise<unknown> | undefined
    w.listeners.install({ waitUntil: (promise: Promise<unknown>) => { pending = promise } })
    await pending
    expect(Array.from(w.addAll.mock.calls[0][0])).toEqual(['/offline.html', '/manifest.webmanifest', '/janasoochi-logo-2026-192.png', '/janasoochi-logo-2026-512.png'])
  })

  it('never intercepts API, private PDF, export, cross-origin or mutation requests', () => {
    const w = worker()
    for (const [path, method] of [['/api/export', 'GET'], ['/voter-pdfs/source.pdf', 'GET'], ['/private.pdf', 'GET'], ['/exports/records.csv', 'GET'], ['https://project.supabase.co/rest/v1/voter_records', 'GET'], ['/api/correction', 'POST']]) {
      const respondWith = vi.fn()
      w.listeners.fetch({ request: { url: new URL(path, 'https://example.test').href, method, mode: 'cors' }, respondWith })
      expect(respondWith).not.toHaveBeenCalled()
    }
    expect(w.match).not.toHaveBeenCalled()
  })

  it('fetches authenticated navigation from the network without storing it', async () => {
    const w = worker()
    let result: Promise<unknown> | undefined
    w.listeners.fetch({ request: { url: 'https://example.test/search', method: 'GET', mode: 'navigate' }, respondWith: (promise: Promise<unknown>) => { result = promise } })
    await result
    expect(w.fetch).toHaveBeenCalledOnce()
    expect(w.match).not.toHaveBeenCalled()
    expect(w.addAll).not.toHaveBeenCalled()
  })

  it('returns only the offline page when navigation fails', async () => {
    const w = worker(vi.fn().mockRejectedValue(new Error('offline')))
    let result: Promise<unknown> | undefined
    w.listeners.fetch({ request: { url: 'https://example.test/review', method: 'GET', mode: 'navigate' }, respondWith: (promise: Promise<unknown>) => { result = promise } })
    expect(await result).toEqual({ offline: true })
    expect(w.match).toHaveBeenCalledWith('/offline.html')
  })

  it('references existing standalone manifest assets at origin-root paths', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8'))
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/search')
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512'])
    for (const icon of manifest.icons) expect(existsSync(resolve('public', icon.src.slice(1)))).toBe(true)
    expect(existsSync(resolve('public/offline.html'))).toBe(true)
  })
})

