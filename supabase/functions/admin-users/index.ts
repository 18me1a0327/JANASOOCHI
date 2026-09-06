import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type UserRole = 'admin' | 'viewer'
type RequestBody = {
  action?: 'list' | 'create' | 'update'
  id?: string
  email?: string
  password?: string
  role?: UserRole
  page?: number
  perPage?: number
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const validRole = (value: unknown): value is UserRole => value === 'admin' || value === 'viewer'

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const keyNames = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
    const publishableKey = (keyNames.default && Deno.env.get(keyNames.default)) || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const authorization = request.headers.get('Authorization')
    if (!authorization || !url || !serviceKey || !publishableKey) return json({ error: 'Unauthorized.' }, 401)

    const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(token)
    if (callerError || !caller) return json({ error: 'Unauthorized.' }, 401)

    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: callerProfile, error: profileError } = await service.from('profiles').select('role').eq('id', caller.id).single()
    if (profileError || callerProfile?.role !== 'admin') return json({ error: 'Admin access required.' }, 403)

    const body = await request.json() as RequestBody
    if (body.action === 'list') {
      const page = Math.max(1, Math.trunc(Number(body.page) || 1))
      const perPage = Math.min(100, Math.max(1, Math.trunc(Number(body.perPage) || 50)))
      const { data, error } = await service.auth.admin.listUsers({ page, perPage })
      if (error) throw error
      const ids = data.users.map((user) => user.id)
      const { data: profiles, error: profilesError } = ids.length
        ? await service.from('profiles').select('id,role').in('id', ids)
        : { data: [], error: null }
      if (profilesError) throw profilesError
      const roles = new Map((profiles || []).map((profile) => [profile.id, profile.role as UserRole]))
      return json({ page, perPage, total: data.total, users: data.users.map((user) => ({ id: user.id, email: user.email ?? null, role: roles.get(user.id) ?? 'viewer', created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null, is_current: user.id === caller.id })) })
    }

    if (body.action === 'create') {
      const email = body.email?.trim().toLocaleLowerCase() ?? ''
      const password = body.password ?? ''
      const role = body.role ?? 'viewer'
      if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400)
      if (password.length < 8) return json({ error: 'Password must contain at least 8 characters.' }, 400)
      if (!validRole(role)) return json({ error: 'Invalid role.' }, 400)
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) return json({ error: error.message }, 400)
      const { error: roleError } = await service.from('profiles').upsert({ id: data.user.id, role })
      if (roleError) {
        await service.auth.admin.deleteUser(data.user.id)
        throw roleError
      }
      return json({ user: { id: data.user.id, email: data.user.email, role } }, 201)
    }

    if (body.action === 'update') {
      if (!body.id) return json({ error: 'User is required.' }, 400)
      if (body.role !== undefined && !validRole(body.role)) return json({ error: 'Invalid role.' }, 400)
      if (body.id === caller.id && body.role && body.role !== 'admin') return json({ error: 'You cannot remove your own admin role.' }, 400)
      const attributes: { email?: string; password?: string } = {}
      if (body.email !== undefined) {
        const email = body.email.trim().toLocaleLowerCase()
        if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400)
        attributes.email = email
      }
      if (body.password) {
        if (body.password.length < 8) return json({ error: 'Password must contain at least 8 characters.' }, 400)
        attributes.password = body.password
      }
      if (Object.keys(attributes).length) {
        const { error } = await service.auth.admin.updateUserById(body.id, attributes)
        if (error) return json({ error: error.message }, 400)
      }
      if (body.role) {
        const { error } = await service.from('profiles').upsert({ id: body.id, role: body.role })
        if (error) throw error
      }
      return json({ updated: true })
    }

    return json({ error: 'Invalid action.' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: 'Unable to manage users right now.' }, 500)
  }
})
