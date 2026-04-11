'use client'

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { X, Search, ListMusic, Pencil, Users, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'ministry_hub_onboarding_completed'

const STEP_ICONS = [Search, ListMusic, Pencil, Users, MessageSquare]

const STEP_KEYS = [
  { title: 'step1Title', desc: 'step1Desc', tip: 'step1Tip' },
  { title: 'step2Title', desc: 'step2Desc', tip: 'step2Tip' },
  { title: 'step3Title', desc: 'step3Desc', tip: 'step3Tip' },
  { title: 'step4Title', desc: 'step4Desc', tip: 'step4Tip' },
  { title: 'step5Title', desc: 'step5Desc', tip: 'step5Tip' },
]

export interface OnboardingGuideRef {
  open: () => void
}

const OnboardingGuide = forwardRef<OnboardingGuideRef>(function OnboardingGuide(_, ref) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const t = useTranslations()

  useImperativeHandle(ref, () => ({
    open: () => {
      setCurrentStep(0)
      setIsVisible(true)
    }
  }))

  useEffect(() => {
    // 첫 방문 여부 확인
    const isCompleted = localStorage.getItem(STORAGE_KEY)
    if (!isCompleted) {
      // 약간의 딜레이 후 표시 (페이지 로딩 완료 후)
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsVisible(false)
  }

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsVisible(false)
  }

  const handleNext = () => {
    if (currentStep < STEP_KEYS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (!isVisible) return null

  const CurrentIcon = STEP_ICONS[currentStep]
  const stepKey = STEP_KEYS[currentStep]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* 헤더 - 그라데이션 */}
        <div
          className="relative px-6 py-8 text-white"
          style={{ background: 'linear-gradient(135deg, #84B9C0 0%, #6BA3AA 100%)' }}
        >
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
            style={{ minWidth: '48px', minHeight: '48px', touchAction: 'manipulation' }}
            aria-label={t('common.close')}
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <CurrentIcon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-white/80 text-sm" style={{ fontSize: '16px' }}>
                {currentStep + 1} / {STEP_KEYS.length}
              </p>
              <h2 className="text-xl font-bold" style={{ fontSize: '20px' }}>
                {t(`onboarding.${stepKey.title}`)}
              </h2>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-6 py-6">
          <p className="text-gray-700 leading-relaxed mb-4" style={{ fontSize: '16px' }}>
            {t(`onboarding.${stepKey.desc}`)}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-gray-600" style={{ fontSize: '16px' }}>
              {t(`onboarding.${stepKey.tip}`)}
            </p>
          </div>
        </div>

        {/* 하단 네비게이션 */}
        <div className="px-6 pb-6">
          {/* 진행 인디케이터 */}
          <div className="flex justify-center gap-2 mb-4">
            {STEP_KEYS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-6 bg-[#84B9C0]'
                    : index < currentStep
                      ? 'bg-[#84B9C0]/50'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                style={{ minHeight: '48px', fontSize: '16px', touchAction: 'manipulation' }}
              >
                <ChevronLeft className="w-5 h-5" />
                {t('common.previous')}
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-white rounded-xl hover:opacity-90 transition-colors font-medium"
              style={{
                minHeight: '48px',
                fontSize: '16px',
                touchAction: 'manipulation',
                backgroundColor: '#84B9C0'
              }}
            >
              {currentStep < STEP_KEYS.length - 1 ? (
                <>
                  {t('common.next')}
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                t('common.start')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default OnboardingGuide
