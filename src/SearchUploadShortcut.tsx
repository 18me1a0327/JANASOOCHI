import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from './lib'

export default function SearchUploadShortcut() {
  const { pathname } = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true

    async function refreshRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        if (active) setIsAdmin(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (active) setIsAdmin(data?.role === 'admin')
    }

    void refreshRole()
    const { data } = supabase.auth.onAuthStateChange(() => void refreshRole())

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (pathname !== '/search' || !isAdmin) return null

  return (
    <Link className="search-upload-shortcut" to="/upload">
      <Upload aria-hidden="true" />
      Upload PDF
    </Link>
  )
}
