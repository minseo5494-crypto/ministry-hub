'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function TermsPage() {
  const t = useTranslations('terms')

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
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article1Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('article1Content')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article2Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article2Content') }} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article3Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article3Content') }} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article4Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('article4Intro')}
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('article4Item1')}</li>
                <li>{t('article4Item2')}</li>
                <li>{t('article4Item3')}</li>
                <li>{t('article4Item4')}</li>
                <li>{t('article4Item5')}</li>
                <li>{t('article4Item6')}</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                {t('article4Continued')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article5Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article5Content') }} />
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('article5Item1')}</li>
                <li>{t('article5Item2')}</li>
                <li>{t('article5Item3')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article6Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('article6Intro')}
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('article6Item1')}</li>
                <li>{t('article6Item2')}</li>
                <li>{t('article6Item3')}</li>
                <li>{t('article6Item4')}</li>
                <li>{t('article6Item5')}</li>
                <li>{t('article6Item6')}</li>
                <li>{t('article6Item7')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article7Title')}</h2>

              <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">{t('article7Sub1Title')}</h3>
              <p className="text-gray-700 leading-relaxed">
                {t('article7Sub1Content')}
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">{t('article7Sub2Title')}</h3>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article7Sub2Content') }} />
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('article7Sub2Item1')}</li>
                <li>{t('article7Sub2Item2')}</li>
                <li>{t('article7Sub2Item3')}</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                {t('article7Sub2Continued')}
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">{t('article7Sub3Title')}</h3>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article7Sub3Content') }} />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">
                  {t.rich('article7CopyrightNote', {
                    link: (chunks) => <Link href="/copyright" className="text-blue-600 underline font-medium">{chunks}</Link>
                  })}
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article8Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('article8Intro')}
              </p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>{t('article8Item1')}</li>
                <li>{t('article8Item2')}</li>
                <li>{t('article8Item3')}</li>
                <li>{t('article8Item4')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article9Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article9Content') }} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article10Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article10Content') }} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article11Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article11Content') }} />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article12Title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t.rich('article12Content', {
                  link: (chunks) => <Link href="/privacy" className="text-blue-600 underline">{chunks}</Link>
                })}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('article13Title')}</h2>
              <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('article13Content') }} />
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
