// src/components/DownloadLoadingModal.tsx
// 📥 다운로드 로딩 모달 컴포넌트 (진행률 표시 지원)

'use client'

export interface DownloadProgress {
  current: number      // 현재 처리 중인 곡 번호
  total: number        // 전체 곡 수
  songName?: string    // 현재 처리 중인 곡 이름
  stage?: string       // 현재 단계 (예: '이미지 변환', '페이지 렌더링')
}

interface DownloadLoadingModalProps {
  isOpen: boolean
  type: 'pdf' | 'ppt' | 'image'
  progress?: DownloadProgress
}

export default function DownloadLoadingModal({ isOpen, type, progress }: DownloadLoadingModalProps) {
  if (!isOpen) return null

  const config = {
    pdf: {
      title: 'PDF 생성 중...',
      description: '선택하신 곡들의 악보를 PDF로 생성하고 있습니다.',
      color: 'blue'
    },
    ppt: {
      title: 'PPT 생성 중...',
      description: '선택하신 곡들의 가사를 PPT로 생성하고 있습니다.',
      color: 'purple'
    },
    image: {
      title: '사진 다운로드 중...',
      description: '선택하신 곡들의 악보를 사진 파일로 다운로드하고 있습니다.',
      color: 'green'
    }
  }

  const { title, description, color } = config[type]

  // 진행률 계산
  const percentage = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  const colorClasses = {
    blue: {
      spinner: 'border-blue-600',
      bar: 'bg-blue-100',
      text: 'text-blue-600'
    },
    purple: {
      spinner: 'border-purple-600',
      bar: 'bg-purple-100',
      text: 'text-purple-600'
    },
    green: {
      spinner: 'border-green-600',
      bar: 'bg-green-100',
      text: 'text-green-600'
    }
  }

  const colors = colorClasses[color as keyof typeof colorClasses]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
        {/* 원형 진행률 또는 스피너 */}
        <div className="flex justify-center mb-4">
          {progress && progress.total > 0 ? (
            <div className="relative w-20 h-20">
              {/* 배경 원 */}
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#E5E7EB"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - percentage / 100)}`}
                  className={colors.text}
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              {/* 퍼센트 텍스트 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold ${colors.text}`}>{percentage}%</span>
              </div>
            </div>
          ) : (
            <div className={`animate-spin rounded-full h-16 w-16 border-b-4 ${colors.spinner}`}></div>
          )}
        </div>

        {/* 제목 */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>

        {/* 진행 상황 상세 */}
        {progress && progress.total > 0 ? (
          <div className="mb-4">
            {/* 진행률 바 */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
              <div
                className={`h-2.5 rounded-full ${colors.bar} transition-all duration-300`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* 곡 정보 */}
            <p className="text-gray-700 font-medium">
              {progress.current} / {progress.total} 곡 처리 중
            </p>

            {/* 현재 곡 이름 */}
            {progress.songName && (
              <p className="text-gray-500 text-sm mt-1 truncate px-4">
                {progress.songName}
              </p>
            )}

            {/* 현재 단계 */}
            {progress.stage && (
              <p className="text-gray-400 text-xs mt-1">
                {progress.stage}
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-600 mb-4">{description}</p>
        )}

        {/* 안내 메시지 */}
        <p className="text-sm text-gray-500">
          잠시만 기다려 주세요. 곡 수에 따라 시간이 소요될 수 있습니다.
        </p>

        {/* 바운스 애니메이션 점들 */}
        {(!progress || progress.total === 0) && (
          <div className="mt-6 flex justify-center gap-2">
            <div
              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: '0s' }}
            ></div>
            <div
              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.2s' }}
            ></div>
            <div
              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.4s' }}
            ></div>
          </div>
        )}
      </div>
    </div>
  )
}