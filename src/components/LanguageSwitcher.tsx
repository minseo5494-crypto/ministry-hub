'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'

export default function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (newLocale: string) => {
    // 현재 경로에서 locale prefix를 교체
    const segments = pathname.split('/')
    // segments[0] is '', segments[1] is locale
    segments[1] = newLocale
    router.push(segments.join('/'))
  }

  return (
    <button
      onClick={() => switchLocale(locale === 'ko' ? 'en' : 'ko')}
      className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition"
      title={locale === 'ko' ? 'Switch to English' : '한국어로 전환'}
    >
      {locale === 'ko' ? 'EN' : '한국어'}
    </button>
  )
}
