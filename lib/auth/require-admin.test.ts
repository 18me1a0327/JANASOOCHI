import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  from: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`redirect:${path}`) }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('../supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}))

import { requireAdmin } from './require-admin'

describe('existing server Admin authorization gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'test-auth-user' } } })
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) })
  })

  it('redirects anonymous/revoked sessions before querying profiles', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid session') })
    await expect(requireAdmin()).rejects.toThrow('redirect:/login')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects Viewer even with a valid authenticated user', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { role: 'viewer' } })
    await expect(requireAdmin()).rejects.toThrow('redirect:/search?error=admin-required')
  })

  it('does not elevate a missing profile', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null })
    await expect(requireAdmin()).rejects.toThrow('redirect:/search?error=admin-required')
  })

  it('fails closed on a profile query error', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error('database unavailable') })
    await expect(requireAdmin()).rejects.toThrow('redirect:/search?error=admin-required')
  })

  it('permits only a server-read Admin profile', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { role: 'admin' } })
    expect(await requireAdmin()).toEqual({ id: 'test-auth-user' })
    expect(mocks.getUser).toHaveBeenCalledOnce()
    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
