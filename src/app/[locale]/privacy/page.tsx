'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function PrivacyPage() {
  const t = useTranslations('privacy')

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 뒤로가기 */}
        <Link
          href="/signup"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} className="mr-1" />
          {t('backLink')}
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('pageTitle')}</h1>
          <p className="text-gray-500 mb-8">{t('lastModified')}</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section1Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('section1Intro')}
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('section1Item1')}</li>
                <li>{t('section1Item2')}</li>
                <li>{t('section1Item3')}</li>
                <li>{t('section1Item4')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section2Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                <strong>{t('section2RequiredLabel')}</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('section2RequiredItem1')}</li>
                <li>{t('section2RequiredItem2')}</li>
                <li>{t('section2RequiredItem3')}</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                <strong>{t('section2OptionalLabel')}</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('section2OptionalItem1')}</li>
                <li>{t('section2OptionalItem2')}</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                <strong>{t('section2AutoLabel')}</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('section2AutoItem1')}</li>
                <li>{t('section2AutoItem2')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section3Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('section3Content') }} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section4Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('section4Intro')}
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('section4Item1')}</li>
                <li>{t('section4Item2')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section5Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('section5Intro')}
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('section5Item1')}</li>
                <li>{t('section5Item2')}</li>
                <li>{t('section5Item3')}</li>
                <li>{t('section5Item4')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section6Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('section6Intro')}
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('section6Item1')}</li>
                <li>{t('section6Item2')}</li>
                <li>{t('section6Item3')}</li>
                <li>{t('section6Item4')}</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-2">
                {t('section6Note')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section7Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('section7Content')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section8Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('section8Intro')}
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mt-3">
                <p className="text-gray-700">
                  <strong>{t('section8Manager')}</strong> {t('section8ManagerValue')}<br />
                  <strong>{t('section8Email')}</strong> support@worsheep.org
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('section9Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('section9Content')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('supplementTitle')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('supplementContent')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
