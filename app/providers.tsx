'use client'

import type { ReactNode } from 'react'

import { LanguageProvider } from '../components/language-provider'
import { AuthProvider } from '../lib/providers/auth-provider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>{children}</AuthProvider>
    </LanguageProvider>
  )
}
