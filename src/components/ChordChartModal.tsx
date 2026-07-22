'use client'

// src/components/ChordChartModal.tsx
//
// 코드악보 변환 모달(껍데기). 실제 로직은 ChordChartPanel(불러오기/생성/저장/연주모드) 재사용.

import { X } from 'lucide-react'
import ChordChartPanel, { ChordChartPanelSong } from '@/components/ChordChartPanel'

interface ChordChartModalProps {
  isOpen: boolean
  onClose: () => void
  song: ChordChartPanelSong
  /** 선택된 송폼(진행 순서). 연주 모드에서 클릭 구성에 사용 */
  form?: string[]
}

export default function ChordChartModal({ isOpen, onClose, song, form = [] }: ChordChartModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ touchAction: 'manipulation' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900">🎼 코드악보 변환</h3>
            {song.song_name && (
              <p className="text-sm text-gray-500 truncate max-w-[24rem]">{song.song_name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <ChordChartPanel song={song} form={form} />
        </div>
      </div>
    </div>
  )
}
