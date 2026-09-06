'use client'

import type { User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { createClient, isSupabaseConfigured } from '../supabase/client'

export type AppRole = 'admin' | 'viewer'

type AuthContextValue = {
  configured: boolean
  loading: boolean
  user: User | null
  role: AppRole | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [loading, setLoading] = useState(configured)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AppRole | null>(null)

  const refresh = useCallback(async () => {
    if (!configured) {
      setLoading(false)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      setUser(null)
      setRole(null)
      setLoading(false)
      return
    }

    const profile = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    setUser(data.user)
    setRole(profile.data?.role ?? null)
    setLoading(false)
  }, [configured])

  useEffect(() => {
    if (!configured) return
    void refresh()
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [configured, refresh])

  const signOut = useCallback(async () => {
    if (!configured) return
    await createClient().auth.signOut()
    setUser(null)
    setRole(null)
  }, [configured])

  const value = useMemo(
    () => ({ configured, loading, user, role, refresh, signOut }),
    [configured, loading, refresh, role, signOut, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
