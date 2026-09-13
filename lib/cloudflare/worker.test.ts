import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('vinext/server/app-router-entry', () => ({ default: { fetch: mocks.fetch } }))
import worker from './worker'

describe('Cloudflare no-store response boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves redirect status/location and disables caching', async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 307, headers: { location: '/login' } }))
    const request = new Request('https://example.test/review')
    const response = await worker.fetch(request)
    expect(mocks.fetch).toHaveBeenCalledWith(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/login')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('preserves multiple session Set-Cookie headers', async () => {
    const headers = new Headers({ 'content-type': 'text/html' })
    headers.append('Set-Cookie', 'test-session.0=one; HttpOnly; Secure')
    headers.append('Set-Cookie', 'test-session.1=two; HttpOnly; Secure')
    mocks.fetch.mockResolvedValue(new Response('shell', { headers }))
    const response = await worker.fetch(new Request('https://example.test/search'))
    expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie())
    expect(await response.text()).toBe('shell')
  })

  it('does not buffer or replace an RSC streaming body', async () => {
    const stream = new ReadableStream({ start: (controller) => { controller.enqueue(new TextEncoder().encode('rsc')); controller.close() } })
    const original = new Response(stream, { headers: { 'content-type': 'text/x-component', vary: 'RSC' } })
    mocks.fetch.mockResolvedValue(original)
    const response = await worker.fetch(new Request('https://example.test/search'))
    expect(response.body).toBe(original.body)
    expect(response.headers.get('content-type')).toBe('text/x-component')
    expect(response.headers.get('vary')).toBe('RSC')
    expect(await response.text()).toBe('rsc')
  })

  it('does not swallow underlying runtime exceptions or hardcode success', async () => {
    const error = new Error('internal-runtime-failure')
    mocks.fetch.mockRejectedValue(error)
    await expect(worker.fetch(new Request('https://example.test/search'))).rejects.toBe(error)
  })
})
