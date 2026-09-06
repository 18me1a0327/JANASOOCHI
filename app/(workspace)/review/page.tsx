'use client'

import { useLanguage } from '../../../components/language-provider'
import AdvancedReviewPage from '../../../src/AdvancedReviewPage'

export default function ReviewPage() {
  const { language } = useLanguage()
  return <AdvancedReviewPage lang={language} />
}
