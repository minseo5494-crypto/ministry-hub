'use client'

import Link from 'next/link'
import { ArrowLeft, Shield, AlertTriangle, Mail, CheckCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function CopyrightPage() {
  const t = useTranslations('copyrightPage')

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 뒤로가기 */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} className="mr-1" />
          {t('backLink')}
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">{t('pageTitle')}</h1>
          </div>
          <p className="text-gray-500 mb-8">{t('lastModified')}</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* 개요 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('overviewTitle')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('overviewContent')}
              </p>
            </section>

            {/* 악보 분류 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('classificationTitle')}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t('classificationIntro')}
              </p>

              <div className="space-y-4">
                {/* 공식 악보 */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">{t('officialTitle')}</h3>
                  </div>
                  <p className="text-sm text-green-800">
                    {t('officialContent')}
                  </p>
                </div>

                {/* 사용자 악보 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-900">{t('ugcTitle')}</h3>
                  </div>
                  <p className="text-sm text-yellow-800">
                    {t('ugcContent')}
                  </p>
                </div>

                {/* 퍼블릭 도메인 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">{t('publicDomainTitle')}</h3>
                  </div>
                  <p className="text-sm text-blue-800">
                    {t('publicDomainContent')}
                  </p>
                </div>
              </div>
            </section>

            {/* 저작권 침해 신고 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('infringementTitle')}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t('infringementIntro')}
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-3">{t('infringementInfoTitle')}</h3>
                <ol className="list-decimal list-inside text-gray-700 space-y-2">
                  <li><strong>{t('infringementInfo1Label')}</strong> {t('infringementInfo1Value')}</li>
                  <li><strong>{t('infringementInfo2Label')}</strong> {t('infringementInfo2Value')}</li>
                  <li><strong>{t('infringementInfo3Label')}</strong> {t('infringementInfo3Value')}</li>
                  <li><strong>{t('infringementInfo4Label')}</strong> {t('infringementInfo4Value')}</li>
                  <li><strong>{t('infringementInfo5Label')}</strong> {t('infringementInfo5Value')}</li>
                </ol>
              </div>

              <div className="flex items-center gap-3 mt-4 p-4 bg-blue-50 rounded-lg">
                <Mail className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900">{t('reportContact')}</p>
                  <a href="mailto:support@worsheep.org" className="text-blue-600 hover:underline">
                    support@worsheep.org
                  </a>
                </div>
              </div>
            </section>

            {/* 처리 절차 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('procedureTitle')}</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <div>
                    <p className="font-medium text-gray-900">{t('procedureStep1Title')}</p>
                    <p className="text-sm text-gray-600">{t('procedureStep1Desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <div>
                    <p className="font-medium text-gray-900">{t('procedureStep2Title')}</p>
                    <p className="text-sm text-gray-600">{t('procedureStep2Desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  <div>
                    <p className="font-medium text-gray-900">{t('procedureStep3Title')}</p>
                    <p className="text-sm text-gray-600">{t('procedureStep3Desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  <div>
                    <p className="font-medium text-gray-900">{t('procedureStep4Title')}</p>
                    <p className="text-sm text-gray-600">{t('procedureStep4Desc')}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 반복 침해자 정책 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('repeatOffenderTitle')}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t('repeatOffenderIntro')}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <ul className="space-y-2 text-red-800">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">{t('repeatOffender1st')}</span>
                    <span>{t('repeatOffender1stAction')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">{t('repeatOffender2nd')}</span>
                    <span>{t('repeatOffender2ndAction')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">{t('repeatOffender3rd')}</span>
                    <span>{t('repeatOffender3rdAction')}</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 이의 제기 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('counterNoticeTitle')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('counterNoticeContent')}
              </p>
            </section>

            {/* 파트너십 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('partnershipTitle')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('partnershipContent')}
              </p>
              <div className="flex items-center gap-3 mt-4 p-4 bg-green-50 rounded-lg">
                <Mail className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900">{t('partnershipContact')}</p>
                  <a href="mailto:support@worsheep.org" className="text-green-600 hover:underline">
                    support@worsheep.org
                  </a>
                </div>
              </div>
            </section>

            {/* 관련 문서 */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('relatedDocsTitle')}</h2>
              <div className="flex flex-col gap-2">
                <Link href="/terms" className="text-blue-600 hover:underline">
                  {t('relatedTerms')}
                </Link>
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  {t('relatedPrivacy')}
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
