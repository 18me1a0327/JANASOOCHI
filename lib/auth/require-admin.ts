import { redirect } from 'next/navigation'

import { createClient } from '../supabase/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (data?.role !== 'admin') redirect('/search?error=admin-required')
  return user
}
