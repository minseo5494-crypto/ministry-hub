'use client'

type PPTModalProps = {
  isOpen: boolean
  onGeneratePPT: (type: 'form' | 'original') => void
  onClose: () => void
}

export default function PPTModal({
  isOpen,
  onGeneratePPT,
  onClose
}: PPTModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-xl font-bold mb-4">PPT 다운로드 옵션</h3>
        <p className="text-gray-600 mb-6">
          어떤 방식으로 PPT를 생성하시겠습니까?
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onGeneratePPT('form')}
            className="w-full p-4 border-2 border-blue-600 rounded-lg hover:bg-blue-50 text-left transition"
          >
            <div className="font-bold text-blue-900 mb-1">🎤 가사 PPT</div>
            <div className="text-sm text-gray-600">
              가사를 슬라이드로 생성 (송폼 설정 시 해당 순서대로)
            </div>
          </button>

          <button
            onClick={() => onGeneratePPT('original')}
            className="w-full p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-left transition"
          >
            <div className="font-bold text-gray-900 mb-1">📄 악보 PPT</div>
            <div className="text-sm text-gray-600">
              업로드된 악보 이미지를 슬라이드로 생성
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          취소
        </button>
      </div>
    </div>
  )
}
