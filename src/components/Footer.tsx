'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')

  return (
    <footer className="bg-gray-100 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* 로고 및 설명 */}
          <div className="text-center md:text-left">
            <h3 className="text-lg font-logo text-gray-900">WORSHEEP</h3>
            <p className="text-sm text-gray-600 mt-1">{t('description')}</p>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/terms" className="text-gray-600 hover:text-gray-900">
              {t('terms')}
            </Link>
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900">
              {t('privacy')}
            </Link>
            <Link href="/copyright" className="text-gray-600 hover:text-gray-900">
              {t('copyright')}
            </Link>
            <a href="mailto:support@worsheep.org" className="text-gray-600 hover:text-gray-900">
              {t('contact')}
            </a>
          </div>
        </div>

        {/* 저작권 */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} WORSHEEP. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
