// src/components/SongFormModal.tsx
// 🎵 송폼 설정 모달 컴포넌트

'use client'

import { useState, useEffect } from 'react'
import { SECTION_ABBREVIATIONS } from '@/lib/supabase'

interface Song {
  id: string
  song_name: string
}

interface SongFormModalProps {
  isOpen: boolean
  song: Song | null
  initialForm: string[]
  onSave: (songId: string, form: string[]) => void
  onClose: () => void
}

const availableSections = [
  'Intro', 'Verse', 'Verse1', 'Verse2',
  'PreChorus', 'Chorus', 'Interlude',
  'Bridge', 'Tag', 'Outro'
]

export default function SongFormModal({
  isOpen,
  song,
  initialForm,
  onSave,
  onClose
}: SongFormModalProps) {
  const [tempSelectedForm, setTempSelectedForm] = useState<string[]>(initialForm)
  const [customSection, setCustomSection] = useState('')

  // ✅ 곡이 바뀔 때마다 송폼 초기화
useEffect(() => {
  if (song && isOpen) {
    setTempSelectedForm(initialForm)
    setCustomSection('')
  }
}, [song?.id, isOpen])

  // 모달이 열릴 때마다 초기값 설정
  if (!isOpen || !song) return null

  const addSection = (section: string) => {
    const abbr = SECTION_ABBREVIATIONS[section] || section
    setTempSelectedForm(prev => [...prev, abbr])
  }

  const addCustomSection = () => {
    if (customSection.trim()) {
      setTempSelectedForm(prev => [...prev, customSection.trim()])
      setCustomSection('')
    }
  }

  const removeSection = (index: number) => {
    setTempSelectedForm(prev => prev.filter((_, i) => i !== index))
  }

  const moveSectionUp = (index: number) => {
    if (index === 0) return
    const newForm = [...tempSelectedForm]
    ;[newForm[index - 1], newForm[index]] = [newForm[index], newForm[index - 1]]
    setTempSelectedForm(newForm)
  }

  const moveSectionDown = (index: number) => {
    if (index === tempSelectedForm.length - 1) return
    const newForm = [...tempSelectedForm]
    ;[newForm[index], newForm[index + 1]] = [newForm[index + 1], newForm[index]]
    setTempSelectedForm(newForm)
  }

  const handleSave = () => {
    onSave(song.id, tempSelectedForm)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-2xl font-bold mb-4">
          {song.song_name} - 송폼 설정
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 왼쪽: 사용 가능한 섹션 */}
          <div>
            <h4 className="font-bold mb-3 text-lg">사용 가능한 섹션</h4>
            <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
              {availableSections.map(section => {
                const abbr = SECTION_ABBREVIATIONS[section]
                return (
                  <button
                    key={section}
                    onClick={() => addSection(section)}
                    className="w-full px-4 py-3 rounded text-left bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium flex justify-between items-center"
                  >
                    <span>{section}</span>
                    <span className="text-sm bg-blue-200 px-2 py-1 rounded text-blue-900">
                      {abbr}
                    </span>
                  </button>
                )
              })}
            </div>
            
            {/* 직접 입력 */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h5 className="font-bold mb-2">직접 입력</h5>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  placeholder="예: 기도회, 멘트"
                  className="flex-1 px-3 py-2 border rounded"
                  onKeyPress={(e) => e.key === 'Enter' && addCustomSection()}
                />
                <button
                  onClick={addCustomSection}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  추가
                </button>
              </div>
            </div>
          </div>

          {/* 오른쪽: 선택된 순서 */}
          <div className="flex flex-col h-[500px]">
            <h4 className="font-bold mb-3 text-lg">선택된 순서</h4>
            
            {/* 스크롤 가능한 송폼 리스트 영역 */}
            <div className="flex-1 overflow-y-auto border-2 border-dashed rounded-lg p-4 bg-gray-50">
              {tempSelectedForm.length === 0 ? (
                <p className="text-gray-400 text-center mt-20">
                  왼쪽에서 섹션을 선택하세요
                </p>
              ) : (
                <div className="space-y-2">
                  {tempSelectedForm.map((abbr, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-white border-2 border-green-200 px-3 py-3 rounded-lg"
                    >
                      <span className="font-bold text-green-900 flex-1 text-lg">
                        {index + 1}. {abbr}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveSectionUp(index)}
                          disabled={index === 0}
                          className="px-2 py-1 bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSectionDown(index)}
                          disabled={index === tempSelectedForm.length - 1}
                          className="px-2 py-1 bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeSection(index)}
                          className="px-2 py-1 bg-[#E26559] text-white rounded hover:bg-[#D14E42]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 미리보기 - 하단 고정 */}
            {tempSelectedForm.length > 0 && (
              <div className="flex-none mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm font-bold text-blue-900 mb-1">미리보기:</p>
                <p className="text-blue-800 font-mono">
                  {tempSelectedForm.join(' - ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-bold"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}