'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type UiLanguage = 'en' | 'te' | 'ur'

const STORAGE_KEY = 'janasoochi-ui-language'

const copy = {
  en: {
    search: 'Search', documents: 'Documents', review: 'Review', quality: 'Data Quality',
    administration: 'Administration', logout: 'Logout', english: 'English', telugu: 'Telugu',
    urdu: 'Urdu', unavailableUrdu: 'Urdu voter data is unavailable until valid Urdu PDFs are uploaded.',
  },
  te: {
    search: 'శోధన', documents: 'పత్రాలు', review: 'సమీక్ష', quality: 'డేటా నాణ్యత',
    administration: 'నిర్వహణ', logout: 'లాగ్ అవుట్', english: 'English', telugu: 'తెలుగు',
    urdu: 'اردو', unavailableUrdu: 'చెల్లుబాటు అయ్యే ఉర్దూ PDFలు అప్‌లోడ్ చేసే వరకు ఉర్దూ ఓటరు డేటా అందుబాటులో లేదు.',
  },
  ur: {
    search: 'تلاش', documents: 'دستاویزات', review: 'جائزہ', quality: 'ڈیٹا معیار',
    administration: 'انتظامیہ', logout: 'لاگ آؤٹ', english: 'English', telugu: 'తెలుగు',
    urdu: 'اردو', unavailableUrdu: 'درست اردو PDF فائلیں اپ لوڈ ہونے تک اردو ووٹر ڈیٹا دستیاب نہیں ہے۔',
  },
} as const

type CopyKey = keyof (typeof copy)['en']
type LanguageContextValue = {
  language: UiLanguage
  setLanguage: (language: UiLanguage) => void
  t: (key: CopyKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<UiLanguage>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'te' || saved === 'ur') setLanguage(saved)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr'
  }, [language])

  const value = useMemo(
    () => ({ language, setLanguage, t: (key: CopyKey) => copy[language][key] }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
