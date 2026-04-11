'use client'

import { useState } from 'react'
import { X, Loader2, Share2 } from 'lucide-react'
import type { ShareSetlistInput } from '@/types/community'

const SERVICE_TYPES = ['주일예배', '수요예배', '금요예배', '새벽예배', '청년예배', '주일학교']

const TAG_GROUPS = [
  {
    label: '예배 유형',
    tags: ['주일예배', '수요예배', '금요예배', '새벽예배', '청년예배', '주일학교'],
  },
  {
    label: '분위기',
    tags: ['경배', '찬양', '묵상', '축제', '차분한', '힘찬', '고백'],
  },
  {
    label: '절기',
    tags: ['부활절', '크리스마스', '고난주간', '추수감사절', '신년', '셀러브레이션'],
  },
  {
    label: '템포',
    tags: ['느린', '보통', '빠른', '믹스(느→빠)', '믹스(빠→느)'],
  },
]

type ShareSetlistModalProps = {
  isOpen: boolean
  onClose: () => void
  // 원본 셋리스트 정보
  sourceSetlistId: string
  sourceTeamId: string
  defaultTitle: string
  defaultServiceType?: string
  defaultDevotionalGuide?: string
  // 공유 함수
  onShare: (input: ShareSetlistInput) => Promise<boolean>
  // 이미 공유됐는지 여부
  alreadyShared?: boolean
}

export default function ShareSetlistModal({
  isOpen,
  onClose,
  sourceSetlistId,
  sourceTeamId,
  defaultTitle,
  defaultServiceType,
  defaultDevotionalGuide,
  onShare,
  alreadyShared = false,
}: ShareSetlistModalProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [serviceType, setServiceType] = useState(defaultServiceType ?? '')
  const [includeDevotionalGuide, setIncludeDevotionalGuide] = useState(!!defaultDevotionalGuide)
  const [sharing, setSharing] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleShare = async () => {
    if (!title.trim() || sharing) return
    setSharing(true)
    try {
      const ok = await onShare({
        source_setlist_id: sourceSetlistId,
        source_team_id: sourceTeamId,
        title: title.trim(),
        description: description.trim() || undefined,
        tags: selectedTags,
        service_type: serviceType || undefined,
        devotional_guide: includeDevotionalGuide && defaultDevotionalGuide
          ? defaultDevotionalGuide
          : undefined,
      })
      if (ok) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 1800)
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-violet-600" />
            <h3 className="text-base font-bold text-gray-900">커뮤니티에 공유</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
            style={{ touchAction: 'manipulation', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-lg font-bold text-gray-900 mb-1">공유 완료!</p>
            <p className="text-sm text-gray-500">커뮤니티에서 확인할 수 있어요</p>
          </div>
        ) : alreadyShared ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-medium text-gray-900 mb-1">이미 공유된 콘티입니다</p>
            <p className="text-sm text-gray-500 mb-5">커뮤니티에서 공유된 콘티를 확인하세요</p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition"
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              닫기
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                공유 제목 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder="콘티 제목을 입력하세요"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                소개글 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                placeholder="이 콘티에 대해 간단히 소개해주세요..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/300</p>
            </div>

            {/* 예배 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                예배 유형 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setServiceType(serviceType === type ? '' : type)}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${
                      serviceType === type
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{ touchAction: 'manipulation', minHeight: '36px' }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                태그 <span className="text-gray-400 font-normal">(선택, 복수 가능)</span>
              </label>
              <div className="space-y-3">
                {TAG_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs text-gray-400 mb-1.5">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleTagToggle(tag)}
                          className={`px-2.5 py-1 rounded-full text-xs transition ${
                            selectedTags.includes(tag)
                              ? 'bg-violet-100 text-violet-700 border border-violet-300'
                              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-violet-300'
                          }`}
                          style={{ touchAction: 'manipulation', minHeight: '32px' }}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <p className="text-xs text-violet-600 mt-2">선택됨: {selectedTags.map(t => `#${t}`).join(', ')}</p>
              )}
            </div>

            {/* 묵상 가이드 포함 여부 */}
            {defaultDevotionalGuide && (
              <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-3">
                <input
                  type="checkbox"
                  id="includeGuide"
                  checked={includeDevotionalGuide}
                  onChange={(e) => setIncludeDevotionalGuide(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-violet-600"
                  style={{ appearance: 'checkbox', minWidth: '16px', minHeight: '16px' }}
                />
                <label htmlFor="includeGuide" className="text-sm text-gray-700 cursor-pointer">
                  인도자 묵상 가이드 포함하여 공유
                </label>
              </div>
            )}

            {/* 안내 문구 */}
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 leading-relaxed">
              공유 후 커뮤니티에 즉시 공개됩니다. 개인 필기는 포함되지 않습니다.
              부적절한 콘텐츠는 신고를 통해 관리됩니다.
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pb-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                취소
              </button>
              <button
                onClick={handleShare}
                disabled={!title.trim() || sharing}
                className="flex-1 px-4 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                {sharing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>공유 중...</span>
                  </>
                ) : (
                  <>
                    <Share2 size={16} />
                    <span>공유하기</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
