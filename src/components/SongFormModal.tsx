// src/components/SongFormModal.tsx
// 🎵 송폼 설정 모달 컴포넌트 (즐겨찾기 기능 포함)
// 📱 아이패드 터치 지원 추가

'use client'

import { useState, useEffect, useCallback } from 'react'
import { SECTION_ABBREVIATIONS, supabase } from '@/lib/supabase'

// 🎯 터치 친화적 버튼 컴포넌트 - iOS Safari 호환
interface TouchButtonProps {
  onClick: () => void
  className?: string
  disabled?: boolean
  title?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

function TouchButton({ onClick, className = '', disabled = false, title, style, children }: TouchButtonProps) {
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
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', ...style }}
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
  userId?: string
  isDarkMode?: boolean
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
  userId,
  isDarkMode = false
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
      <div className={`w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border flex flex-col h-[85vh] ${
        isDarkMode
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-gray-200'
      }`}>
        {/* 헤더 */}
        <div className={`px-8 py-6 border-b flex justify-between items-center ${
          isDarkMode ? 'border-slate-800' : 'border-gray-100'
        }`}>
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {song.song_name} - 송폼 설정
            </h1>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              곡의 구성을 자유롭게 배치하고 저장하세요.
            </p>
          </div>
          <TouchButton
            onClick={onClose}
            className={`transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </TouchButton>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽: 사용 가능한 섹션 */}
          <div className={`w-1/4 border-r p-6 flex flex-col gap-6 ${
            isDarkMode
              ? 'border-slate-800 bg-slate-900/30'
              : 'border-gray-100 bg-slate-50/50'
          }`}>
            <div>
              <h2 className={`text-sm font-bold mb-4 flex items-center gap-2 ${
                isDarkMode ? 'text-slate-300' : 'text-gray-700'
              }`}>
                <span className="material-symbols-outlined text-lg">list_alt</span>
                사용 가능한 섹션
              </h2>
              <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {availableSections.map(section => {
                  const abbr = SECTION_ABBREVIATIONS[section] || section
                  return (
                    <TouchButton
                      key={section}
                      onClick={() => addSection(section)}
                      className={`flex items-center justify-between w-full p-3 border rounded-xl transition-all cursor-pointer group ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 hover:border-indigo-500'
                          : 'bg-white border-gray-200 hover:border-indigo-500'
                      }`}
                    >
                      <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                        {section}
                      </span>
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        isDarkMode
                          ? 'bg-blue-900/40 text-blue-300'
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {abbr}
                      </span>
                    </TouchButton>
                  )
                })}
              </div>
            </div>

            {/* 직접 입력 */}
            <div className={`mt-auto border-t pt-6 ${isDarkMode ? 'border-slate-800' : 'border-gray-100'}`}>
              <h2 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                직접 입력
              </h2>
              <div className="flex gap-2 overflow-hidden">
                <input
                  type="text"
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  placeholder="예: 기도회, 멘트"
                  className={`flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  style={{ touchAction: 'manipulation', fontSize: '16px' }}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomSection()}
                />
                <TouchButton
                  onClick={addCustomSection}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isDarkMode
                      ? 'bg-slate-600 hover:bg-slate-500'
                      : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                  style={{ color: '#ffffff' }}
                >
                  추가
                </TouchButton>
              </div>
            </div>
          </div>

          {/* 가운데: 선택된 순서 */}
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <h2 className={`text-sm font-bold flex items-center gap-2 ${
                isDarkMode ? 'text-slate-300' : 'text-gray-700'
              }`}>
                <span className="material-symbols-outlined text-lg">format_list_numbered</span>
                선택된 순서
              </h2>
              {userId && tempSelectedForm.length > 0 && (
                <TouchButton
                  onClick={() => setShowAddFavoriteModal(true)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors ${
                    isDarkMode
                      ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50 hover:bg-yellow-900/30'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                  }`}
                  title="현재 송폼을 즐겨찾기에 추가"
                >
                  <span className="material-symbols-outlined text-sm">star</span>
                  즐겨찾기 추가
                </TouchButton>
              )}
            </div>

            {/* 선택된 순서 리스트 */}
            <div className={`flex-1 border-2 border-dashed rounded-2xl p-4 overflow-y-auto custom-scrollbar ${
              isDarkMode
                ? 'border-slate-700 bg-slate-900/20'
                : 'border-gray-200 bg-gray-50/30'
            }`}>
              {tempSelectedForm.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm mb-4 ${
                    isDarkMode ? 'bg-slate-800' : 'bg-white'
                  }`}>
                    <span className={`material-symbols-outlined text-3xl ${
                      isDarkMode ? 'text-slate-600' : 'text-gray-300'
                    }`}>queue_music</span>
                  </div>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    왼쪽에서 섹션을 선택하세요
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tempSelectedForm.map((abbr, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-4 rounded-xl border shadow-sm ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-white border-gray-100'
                      }`}
                    >
                      <span className={`font-bold w-6 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                        {index + 1}.
                      </span>
                      <span className={`flex-1 font-semibold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                        {abbr}
                      </span>
                      <div className="flex items-center gap-1">
                        <TouchButton
                          onClick={() => moveSectionUp(index)}
                          disabled={index === 0}
                          className={`p-1 rounded transition-colors ${
                            index === 0
                              ? isDarkMode ? 'text-slate-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                              : isDarkMode ? 'text-indigo-400 hover:bg-indigo-900/20' : 'text-indigo-500 hover:bg-indigo-50'
                          }`}
                        >
                          <span className="material-symbols-outlined">expand_less</span>
                        </TouchButton>
                        <TouchButton
                          onClick={() => moveSectionDown(index)}
                          disabled={index === tempSelectedForm.length - 1}
                          className={`p-1 rounded transition-colors ${
                            index === tempSelectedForm.length - 1
                              ? isDarkMode ? 'text-slate-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                              : isDarkMode ? 'text-indigo-400 hover:bg-indigo-900/20' : 'text-indigo-500 hover:bg-indigo-50'
                          }`}
                        >
                          <span className="material-symbols-outlined">expand_more</span>
                        </TouchButton>
                        <TouchButton
                          onClick={() => removeSection(index)}
                          className={`p-1 ml-2 transition-colors ${
                            isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600'
                          }`}
                        >
                          <span className="material-symbols-outlined">close</span>
                        </TouchButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 미리보기 */}
            {tempSelectedForm.length > 0 && (
              <div className={`p-4 rounded-xl border ${
                isDarkMode
                  ? 'bg-blue-950/40 border-blue-900/50'
                  : 'bg-blue-50 border-blue-100'
              }`}>
                <span className={`text-xs font-bold block mb-1 uppercase tracking-wider ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>Preview</span>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>
                  {tempSelectedForm.join(' — ')}
                </p>
              </div>
            )}
          </div>

          {/* 오른쪽: 즐겨찾기 */}
          {userId && (
            <div className={`w-1/4 p-6 flex flex-col gap-4 ${
              isDarkMode ? 'bg-slate-900/20' : 'bg-slate-50/30'
            }`}>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${
                isDarkMode ? 'text-slate-300' : 'text-gray-700'
              }`}>
                <span className="material-symbols-outlined text-lg text-yellow-500">star</span>
                즐겨찾기
              </h2>

              <div className={`flex-1 flex flex-col overflow-hidden border rounded-2xl ${
                isDarkMode
                  ? 'border-yellow-900/30 bg-yellow-950/10'
                  : 'border-yellow-100 bg-yellow-50/20'
              }`}>
                {loadingFavorites ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm mb-4 ${
                      isDarkMode ? 'bg-slate-800' : 'bg-white'
                    }`}>
                      <span className={`material-symbols-outlined text-3xl ${
                        isDarkMode ? 'text-slate-600' : 'text-gray-300'
                      }`}>folder_open</span>
                    </div>
                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      저장된 즐겨찾기가 없습니다.<br/>
                      송폼을 설정한 후 즐겨찾기에 추가해보세요!
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className={`border rounded-lg p-3 transition cursor-pointer group ${
                          isDarkMode
                            ? 'bg-slate-800 border-yellow-900/50 hover:border-yellow-500'
                            : 'bg-white border-yellow-300 hover:border-yellow-500'
                        }`}
                        onClick={() => applyFavorite(fav.songform_pattern)}
                        onTouchEnd={(e) => {
                          if ((e.target as HTMLElement).closest('[data-delete-btn]')) return
                          e.preventDefault()
                          applyFavorite(fav.songform_pattern)
                        }}
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            {fav.label && (
                              <p className={`font-bold text-sm mb-1 truncate ${
                                isDarkMode ? 'text-yellow-400' : 'text-yellow-800'
                              }`}>
                                {fav.label}
                              </p>
                            )}
                            <p className={`text-xs font-mono truncate ${
                              isDarkMode ? 'text-slate-400' : 'text-gray-600'
                            }`}>
                              {fav.songform_pattern.join(' — ')}
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
                            className={`p-2 transition ${
                              isDarkMode ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
                            }`}
                            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                            title="삭제"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className={`text-xs text-center ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                클릭하여 송폼 적용
              </p>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className={`px-8 py-5 border-t flex justify-end gap-3 ${
          isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-white'
        }`}>
          <TouchButton
            onClick={onClose}
            className={`px-6 py-2.5 border font-semibold rounded-xl transition-colors ${
              isDarkMode
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            취소
          </TouchButton>
          <TouchButton
            onClick={handleSave}
            className="px-8 py-2.5 bg-indigo-500 font-semibold rounded-xl shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            style={{ color: '#ffffff' }}
          >
            저장하기
          </TouchButton>
        </div>
      </div>

      {/* 즐겨찾기 추가 모달 */}
      {showAddFavoriteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{ zIndex: 60 }}
        >
          <div className={`rounded-2xl p-6 w-full max-w-md mx-4 border ${
            isDarkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                즐겨찾기 추가
              </h4>
              <TouchButton
                onClick={() => {
                  setShowAddFavoriteModal(false)
                  setNewFavoriteLabel('')
                }}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="material-symbols-outlined">close</span>
              </TouchButton>
            </div>

            <div className="mb-4">
              <p className={`text-sm mb-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                현재 송폼:
              </p>
              <p className={`font-mono text-sm p-3 rounded-lg ${
                isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700'
              }`}>
                {tempSelectedForm.join(' — ')}
              </p>
            </div>

            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-slate-300' : 'text-gray-700'
              }`}>
                즐겨찾기 이름 (선택사항)
              </label>
              <input
                type="text"
                value={newFavoriteLabel}
                onChange={(e) => setNewFavoriteLabel(e.target.value)}
                placeholder="예: 주일 기본 송폼"
                className={`w-full px-4 py-3 border rounded-xl ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
                style={{ touchAction: 'manipulation', fontSize: '16px' }}
              />
            </div>

            <div className="flex gap-3">
              <TouchButton
                onClick={() => {
                  setShowAddFavoriteModal(false)
                  setNewFavoriteLabel('')
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                취소
              </TouchButton>
              <TouchButton
                onClick={addToFavorites}
                className="flex-1 px-4 py-3 bg-yellow-500 rounded-xl font-semibold hover:bg-yellow-600 transition-colors"
                style={{ color: '#ffffff' }}
              >
                추가
              </TouchButton>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#334155' : '#CBD5E1'};
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
}
