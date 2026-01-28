'use client'

import { useState, useEffect } from 'react'
import { X, Search, ListMusic, Pencil, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'

const STORAGE_KEY = 'ministry_hub_onboarding_completed'

const STEPS = [
  {
    icon: Search,
    title: '악보 검색',
    description: '찾고 싶은 곡을 검색해보세요. 곡 제목, 아티스트, 가사로 검색할 수 있어요.',
    tip: '💡 AI 검색을 켜면 "빠른 템포의 찬양" 같은 자연어로도 검색됩니다!',
  },
  {
    icon: ListMusic,
    title: '콘티 만들기',
    description: '곡을 클릭해서 선택하고, 상단 바에서 PDF/PPT로 다운로드하거나 콘티로 저장하세요.',
    tip: '💡 곡 카드의 "송폼" 버튼으로 곡 순서(인트로, 1절, 브릿지 등)를 설정할 수 있어요.',
  },
  {
    icon: Pencil,
    title: '악보 필기',
    description: '곡 카드의 연필 아이콘을 눌러 악보에 직접 필기할 수 있어요.',
    tip: '💡 필기한 악보는 my-page > 내 필기 노트에 자동 저장됩니다.',
  },
  {
    icon: MessageSquare,
    title: '피드백 보내기',
    description: '사용하면서 불편한 점이나 원하는 기능이 있다면 알려주세요!',
    tip: '💡 화면 우측 하단의 말풍선 버튼을 눌러 피드백을 보낼 수 있어요.',
  },
]

export default function OnboardingGuide() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

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
    if (currentStep < STEPS.length - 1) {
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

  const CurrentIcon = STEPS[currentStep].icon

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
            aria-label="닫기"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <CurrentIcon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-white/80 text-sm" style={{ fontSize: '16px' }}>
                {currentStep + 1} / {STEPS.length}
              </p>
              <h2 className="text-xl font-bold" style={{ fontSize: '20px' }}>
                {STEPS[currentStep].title}
              </h2>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-6 py-6">
          <p className="text-gray-700 leading-relaxed mb-4" style={{ fontSize: '16px' }}>
            {STEPS[currentStep].description}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-gray-600" style={{ fontSize: '16px' }}>
              {STEPS[currentStep].tip}
            </p>
          </div>
        </div>

        {/* 하단 네비게이션 */}
        <div className="px-6 pb-6">
          {/* 진행 인디케이터 */}
          <div className="flex justify-center gap-2 mb-4">
            {STEPS.map((_, index) => (
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
                이전
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
              {currentStep < STEPS.length - 1 ? (
                <>
                  다음
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                '시작하기'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
