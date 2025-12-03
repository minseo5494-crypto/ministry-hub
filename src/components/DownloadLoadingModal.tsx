// src/components/DownloadLoadingModal.tsx
// 📥 다운로드 로딩 모달 컴포넌트

'use client'

interface DownloadLoadingModalProps {
  isOpen: boolean
  type: 'pdf' | 'ppt' | 'image'
}

export default function DownloadLoadingModal({ isOpen, type }: DownloadLoadingModalProps) {
  if (!isOpen) return null

  const config = {
    pdf: {
      title: 'PDF 생성 중...',
      description: '선택하신 곡들의 악보를 PDF로 생성하고 있습니다.'
    },
    ppt: {
      title: 'PPT 생성 중...',
      description: '선택하신 곡들의 가사를 PPT로 생성하고 있습니다.'
    },
    image: {
      title: '사진 다운로드 중...',
      description: '선택하신 곡들의 악보를 사진 파일로 다운로드하고 있습니다.'
    }
  }

  const { title, description } = config[type]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
        {/* 스피너 */}
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
        </div>

        {/* 제목 */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>

        {/* 설명 */}
        <p className="text-gray-600 mb-4">{description}</p>

        {/* 안내 메시지 */}
        <p className="text-sm text-gray-500">
          잠시만 기다려 주세요. 곡 수에 따라 시간이 소요될 수 있습니다.
        </p>

        {/* 바운스 애니메이션 점들 */}
        <div className="mt-6 flex justify-center gap-2">
          <div 
            className="w-2 h-2 bg-[#C5D7F2] rounded-full animate-bounce" 
            style={{ animationDelay: '0s' }}
          ></div>
          <div 
            className="w-2 h-2 bg-[#C5D7F2] rounded-full animate-bounce" 
            style={{ animationDelay: '0.2s' }}
          ></div>
          <div 
            className="w-2 h-2 bg-[#C5D7F2] rounded-full animate-bounce" 
            style={{ animationDelay: '0.4s' }}
          ></div>
        </div>
      </div>
    </div>
  )
}