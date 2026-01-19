'use client'

import { useState } from 'react'

export type PPTOptions = {
  includeTitleSlides: boolean  // 곡 사이에 제목 슬라이드 표시
  showFormLabels: boolean      // 송폼 라벨 표시 (V, C, B 등)
}

type PPTModalProps = {
  isOpen: boolean
  onGeneratePPT: (options: PPTOptions) => void
  onClose: () => void
  hasMultipleSongs: boolean    // 여러 곡 선택 여부
  hasSongForms: boolean        // 송폼 설정된 곡 있는지
}

export default function PPTModal({
  isOpen,
  onGeneratePPT,
  onClose,
  hasMultipleSongs,
  hasSongForms
}: PPTModalProps) {
  const [options, setOptions] = useState<PPTOptions>({
    includeTitleSlides: true,
    showFormLabels: true
  })

  if (!isOpen) return null

  const handleGenerate = () => {
    onGeneratePPT(options)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-xl font-bold mb-2">가사 PPT 다운로드</h3>
        <p className="text-gray-600 mb-6 text-sm">
          가사를 슬라이드로 생성합니다. 송폼이 설정된 경우 해당 순서대로 가사가 표시됩니다.
        </p>

        {/* 옵션 섹션 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
          <h4 className="font-medium text-gray-700 mb-2">PPT 옵션</h4>

          {/* 곡 사이 제목 슬라이드 - 여러 곡일 때만 표시 */}
          {hasMultipleSongs && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition">
              <div
                onClick={() => setOptions(prev => ({
                  ...prev, includeTitleSlides: !prev.includeTitleSlides
                }))}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                  options.includeTitleSlides
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-300'
                }`}
              >
                {options.includeTitleSlides && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <span className="font-medium">🎵 곡 제목 슬라이드</span>
                <p className="text-xs text-gray-500">각 곡 시작 전 제목 슬라이드 삽입</p>
              </div>
            </label>
          )}

          {/* 송폼 라벨 표시 - 송폼이 설정된 곡이 있을 때만 표시 */}
          {hasSongForms && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition">
              <div
                onClick={() => setOptions(prev => ({
                  ...prev, showFormLabels: !prev.showFormLabels
                }))}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                  options.showFormLabels
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-300'
                }`}
              >
                {options.showFormLabels && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <span className="font-medium">🏷️ 송폼 라벨 표시</span>
                <p className="text-xs text-gray-500">슬라이드에 V, C, B 등 섹션 표시</p>
              </div>
            </label>
          )}

          {/* 옵션이 없을 때 안내 메시지 */}
          {!hasMultipleSongs && !hasSongForms && (
            <p className="text-sm text-gray-500 text-center py-2">
              추가 설정 없이 가사 PPT를 생성합니다.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={handleGenerate}
            className="w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold"
          >
            PPT 생성하기
          </button>
        </div>

        {/* 폰트 안내 */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <span className="font-bold">💡 폰트 안내:</span> PPT는 나눔고딕 폰트를 사용합니다.
            정상적으로 표시되려면 컴퓨터에 나눔고딕이 설치되어 있어야 합니다.{' '}
            <a
              href="https://hangeul.naver.com/font"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 underline hover:text-amber-900"
            >
              나눔글꼴 다운로드
            </a>
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          취소
        </button>
      </div>
    </div>
  )
}
