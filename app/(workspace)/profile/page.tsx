'use client'

import { Mail, ShieldCheck, UserCircle } from 'lucide-react'

import { useAuth } from '../../../lib/providers/auth-provider'
import { useLanguage } from '../../../components/language-provider'
import { PageHeader, Panel } from '../../../components/ui-shell'

const TITLES = {
  en: { title: 'Profile', lead: 'Your authorized JANASOOCHI account and access level.', email: 'Email address', role: 'Access role', note: 'Only an administrator can change account details or roles.' },
  te: { title: 'ప్రొఫైల్', lead: 'మీ అధీకృత జనసూచి ఖాతా మరియు ప్రవేశ స్థాయి.', email: 'ఇమెయిల్ చిరునామా', role: 'ప్రవేశ పాత్ర', note: 'ఖాతా వివరాలు లేదా పాత్రలను అడ్మిన్ మాత్రమే మార్చగలరు.' },
  ur: { title: 'پروفائل', lead: 'آپ کا مجاز جاناسوچی اکاؤنٹ اور رسائی کی سطح۔', email: 'ای میل پتہ', role: 'رسائی کردار', note: 'اکاؤنٹ تفصیل یا کردار صرف ایڈمن تبدیل کر سکتا ہے۔' },
} as const

export default function ProfilePage() {
  const { user, role } = useAuth()
  const { language } = useLanguage()
  const copy = TITLES[language]
  return <>
    <PageHeader eyebrow="JANASOOCHI" title={copy.title} description={copy.lead} />
    <Panel title={copy.title}>
      <div className="profile-summary">
        <div className="profile-avatar"><UserCircle aria-hidden="true" /></div>
        <dl><div><dt><Mail aria-hidden="true" />{copy.email}</dt><dd>{user?.email ?? '—'}</dd></div><div><dt><ShieldCheck aria-hidden="true" />{copy.role}</dt><dd><span className={`role-badge ${role ?? 'viewer'}`}>{role ?? 'viewer'}</span></dd></div></dl>
        <p className="inline-notice">{copy.note}</p>
      </div>
    </Panel>
  </>
}
