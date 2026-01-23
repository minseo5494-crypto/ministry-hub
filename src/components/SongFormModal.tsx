// src/components/SongFormModal.tsx
// 🎵 송폼 설정 모달 컴포넌트 (즐겨찾기 기능 포함)
// 📱 아이패드 터치 지원 추가

'use client'

import { useState, useEffect, useCallback } from 'react'
import { SECTION_ABBREVIATIONS, supabase } from '@/lib/supabase'
import { Star, Trash2, X } from 'lucide-react'

// 🎯 터치 친화적 버튼 컴포넌트 - iOS Safari 호환
interface TouchButtonProps {
  onClick: () => void
  className?: string
  disabled?: boolean
  title?: string
  children: React.ReactNode
}

function TouchButton({ onClick, className = '', disabled = false, title, children }: TouchButtonProps) {
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      onClick()
    }
  }, [onClick, disabled])

  return (
    <button
      onClick={onClick}
      onTouchEnd={handleTouchEnd}
      className={className}
      disabled={disabled}
      title={title}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </button>
  )
}

interface Song {
  id: string
  song_name: string
}

interface FavoriteSongform {
  id: string
  songform_pattern: string[]
  label: string | null
  created_at: string
}

interface SongFormModalProps {
  isOpen: boolean
  song: Song | null
  initialForm: string[]
  onSave: (songId: string, form: string[]) => void
  onClose: () => void
  userId?: string  // 🎵 추가
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
  onClose,
  userId
}: SongFormModalProps) {
  const [tempSelectedForm, setTempSelectedForm] = useState<string[]>(initialForm)
  const [customSection, setCustomSection] = useState('')
  
  // 🎵 즐겨찾기 관련 상태
  const [favorites, setFavorites] = useState<FavoriteSongform[]>([])
  const [showAddFavoriteModal, setShowAddFavoriteModal] = useState(false)
  const [newFavoriteLabel, setNewFavoriteLabel] = useState('')
  const [loadingFavorites, setLoadingFavorites] = useState(false)

  // ✅ 곡이 바뀔 때마다 송폼 초기화
  useEffect(() => {
    if (song && isOpen) {
      setTempSelectedForm(initialForm)
      setCustomSection('')
    }
  }, [song?.id, isOpen])

  // 🎵 즐겨찾기 불러오기
  useEffect(() => {
    if (isOpen && userId) {
      fetchFavorites()
    }
  }, [isOpen, userId])

  const fetchFavorites = async () => {
    if (!userId) return
    
    setLoadingFavorites(true)
    try {
      const { data, error } = await supabase
        .from('user_favorite_songforms')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setFavorites(data || [])
    } catch (error) {
      console.error('즐겨찾기 로드 실패:', error)
    } finally {
      setLoadingFavorites(false)
    }
  }

  // 🎵 즐겨찾기 추가
  const addToFavorites = async () => {
    if (!userId || tempSelectedForm.length === 0) return
    
    try {
      const { error } = await supabase
        .from('user_favorite_songforms')
        .insert({
          user_id: userId,
          songform_pattern: tempSelectedForm,
          label: newFavoriteLabel.trim() || null
        })
      
      if (error) throw error
      
      setShowAddFavoriteModal(false)
      setNewFavoriteLabel('')
      fetchFavorites()
    } catch (error) {
      console.error('즐겨찾기 추가 실패:', error)
      alert('즐겨찾기 추가에 실패했습니다.')
    }
  }

  // 🎵 즐겨찾기 삭제
  const removeFavorite = async (id: string) => {
    if (!confirm('이 즐겨찾기를 삭제하시겠습니까?')) return
    
    try {
      const { error } = await supabase
        .from('user_favorite_songforms')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setFavorites(prev => prev.filter(f => f.id !== id))
    } catch (error) {
      console.error('즐겨찾기 삭제 실패:', error)
    }
  }

  // 🎵 즐겨찾기 적용 (기존 송폼에 추가)
  const applyFavorite = (pattern: string[]) => {
    setTempSelectedForm(prev => [...prev, ...pattern])
  }

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
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-2xl font-bold mb-4">
          {song.song_name} - 송폼 설정
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_0.7fr] gap-6">
          {/* 왼쪽: 사용 가능한 섹션 */}
          <div>
            <h4 className="font-bold mb-3 text-lg">사용 가능한 섹션</h4>
            <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
              {availableSections.map(section => {
                const abbr = SECTION_ABBREVIATIONS[section]
                return (
                  <TouchButton
                    key={section}
                    onClick={() => addSection(section)}
                    className="w-full px-4 py-3 rounded text-left bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-900 font-medium flex justify-between items-center"
                  >
                    <span>{section}</span>
                    <span className="text-sm bg-blue-200 px-2 py-1 rounded text-blue-900">
                      {abbr}
                    </span>
                  </TouchButton>
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
                  style={{ touchAction: 'manipulation', fontSize: '16px' }}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomSection()}
                />
                <TouchButton
                  onClick={addCustomSection}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 active:bg-gray-800"
                >
                  추가
                </TouchButton>
              </div>
            </div>
          </div>

          {/* 가운데: 선택된 순서 */}
          <div className="flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-lg">선택된 순서</h4>
              {/* 🎵 즐겨찾기 추가 버튼 */}
              {userId && tempSelectedForm.length > 0 && (
                <TouchButton
                  onClick={() => setShowAddFavoriteModal(true)}
                  className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 active:bg-yellow-300 text-sm"
                  title="현재 송폼을 즐겨찾기에 추가"
                >
                  <Star size={14} />
                  즐겨찾기 추가
                </TouchButton>
              )}
            </div>

            {/* 스크롤 가능한 송폼 리스트 영역 */}
            <div className="flex-1 overflow-y-auto border-2 border-dashed rounded-lg p-4 bg-gray-50">
              {tempSelectedForm.length === 0 ? (
                <p className="text-gray-400 text-center mt-20">
                  왼쪽에서 섹션을 선택하세요
                </p>
              ) : (
                <div className="space-y-1.5">
                  {tempSelectedForm.map((abbr, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-white border border-green-200 px-2 py-1.5 rounded-lg"
                    >
                      <span className="font-semibold text-green-900 flex-1 text-sm">
                        {index + 1}. {abbr}
                      </span>
                      <div className="flex gap-0.5">
                        <TouchButton
                          onClick={() => moveSectionUp(index)}
                          disabled={index === 0}
                          className="px-2 py-1 bg-teal-500 text-white text-sm rounded hover:bg-teal-600 active:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[28px]"
                        >
                          ↑
                        </TouchButton>
                        <TouchButton
                          onClick={() => moveSectionDown(index)}
                          disabled={index === tempSelectedForm.length - 1}
                          className="px-2 py-1 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-700 active:bg-cyan-800 disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[28px]"
                        >
                          ↓
                        </TouchButton>
                        <TouchButton
                          onClick={() => removeSection(index)}
                          className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-100 active:bg-red-700 min-w-[28px]"
                        >
                          ✕
                        </TouchButton>
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

          {/* 🎵 오른쪽: 즐겨찾기 */}
          {userId && (
            <div className="flex flex-col h-[500px]">
              <h4 className="font-bold mb-3 text-lg flex items-center gap-2">
                <Star size={18} className="text-yellow-500" />
                즐겨찾기
              </h4>

              <div className="flex-1 overflow-y-auto border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50">
                {loadingFavorites ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500 mx-auto"></div>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Star size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">저장된 즐겨찾기가 없습니다</p>
                    <p className="text-xs mt-1">송폼을 설정한 후 즐겨찾기에 추가해보세요!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className="bg-white border border-yellow-300 rounded-lg p-3 hover:border-yellow-500 active:bg-yellow-50 transition cursor-pointer group"
                        onClick={() => applyFavorite(fav.songform_pattern)}
                        onTouchEnd={(e) => {
                          // 삭제 버튼 터치가 아닐 때만 적용
                          if ((e.target as HTMLElement).closest('[data-delete-btn]')) return
                          e.preventDefault()
                          applyFavorite(fav.songform_pattern)
                        }}
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            {fav.label && (
                              <p className="font-bold text-yellow-800 text-sm mb-1 truncate">
                                {fav.label}
                              </p>
                            )}
                            <p className="text-xs text-gray-600 font-mono truncate">
                              {fav.songform_pattern.join(' - ')}
                            </p>
                          </div>
                          <button
                            data-delete-btn
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFavorite(fav.id)
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              removeFavorite(fav.id)
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 active:text-red-600 opacity-100 transition"
                            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-2 text-center">
                클릭하여 송폼 적용
              </p>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="mt-6 flex justify-end gap-3">
          <TouchButton
            onClick={onClose}
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 font-medium min-h-[48px]"
          >
            취소
          </TouchButton>
          <TouchButton
            onClick={handleSave}
            className="px-6 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 active:bg-blue-800 font-semibold min-h-[48px]"
          >
            저장
          </TouchButton>
        </div>
      </div>

      {/* 🎵 즐겨찾기 추가 모달 */}
      {showAddFavoriteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{ zIndex: 60 }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold">즐겨찾기 추가</h4>
              <TouchButton
                onClick={() => {
                  setShowAddFavoriteModal(false)
                  setNewFavoriteLabel('')
                }}
                className="text-gray-500 hover:text-gray-700 active:text-gray-900 p-2"
              >
                <X size={20} />
              </TouchButton>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">현재 송폼:</p>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                {tempSelectedForm.join(' - ')}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                즐겨찾기 이름 (선택사항)
              </label>
              <input
                type="text"
                value={newFavoriteLabel}
                onChange={(e) => setNewFavoriteLabel(e.target.value)}
                placeholder="예: 주일 기본 송폼"
                className="w-full px-3 py-2 border rounded-lg"
                style={{ touchAction: 'manipulation', fontSize: '16px' }}
              />
            </div>

            <div className="flex gap-2">
              <TouchButton
                onClick={() => {
                  setShowAddFavoriteModal(false)
                  setNewFavoriteLabel('')
                }}
                className="flex-1 px-4 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 active:bg-gray-400 min-h-[48px]"
              >
                취소
              </TouchButton>
              <TouchButton
                onClick={addToFavorites}
                className="flex-1 px-4 py-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-100 active:bg-yellow-700 min-h-[48px]"
              >
                추가
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}