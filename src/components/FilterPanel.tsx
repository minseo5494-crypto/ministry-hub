// src/components/FilterPanel.tsx
// 🎯 곡 필터 패널 컴포넌트

'use client'

import { useState } from 'react'
import { Calendar, Tag, Music, Clock, Activity, X, ChevronDown, ChevronUp } from 'lucide-react'
import { ThemeCount, SeasonCount } from '@/lib/supabase'

interface FilterPanelProps {
  filters: {
    season: string
    themes: string[]
    key: string
    isMinor: boolean
    timeSignature: string
    tempo: string
    bpmMin: string
    bpmMax: string
  }
  onFilterChange: (key: string, value: any) => void
  onThemeToggle: (theme: string) => void
  onReset: () => void
  onClose?: () => void
  isMobile?: boolean
  isVisible?: boolean  // ← 추가
  // 동적 테마 목록
  themeCounts?: ThemeCount[]
  themesLoading?: boolean
  // 동적 절기 목록
  seasonsList?: SeasonCount[]
  seasonsLoading?: boolean
}

const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const timeSignatures = ['4/4', '3/4', '6/8', '12/8', '6/4', '2/4']
const tempos = ['느림', '조금느림', '보통', '조금빠름', '빠름', '매우빠름']

export default function FilterPanel({
  filters,
  onFilterChange,
  onThemeToggle,
  onReset,
  onClose,
  isMobile = false,
  isVisible = true,  // ← 추가
  themeCounts = [],
  themesLoading = false,
  seasonsList = [],
  seasonsLoading = false
}: FilterPanelProps) {

  // 테마 더 보기 상태
  const [showAllThemes, setShowAllThemes] = useState(false)
  const INITIAL_THEME_COUNT = 10

  // 표시할 테마 목록 (처음 10개 또는 전체)
  const displayedThemes = showAllThemes
    ? themeCounts
    : themeCounts.slice(0, INITIAL_THEME_COUNT)

  const hasMoreThemes = themeCounts.length > INITIAL_THEME_COUNT

  if (!isVisible) return null  // ← 추가
    return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6 sticky top-20 max-h-[80vh] overflow-y-auto">
      {/* 모바일 닫기 버튼 */}
      {isMobile && onClose && (
        <div className="flex items-center justify-between mb-4 pb-2 border-b md:hidden">
          <h3 className="font-bold text-lg">필터</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">필터</h3>
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:underline"
        >
          초기화
        </button>
      </div>

      {/* 절기 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Calendar className="inline w-4 h-4 mr-1" />
          절기
        </label>
        {seasonsLoading ? (
          <div className="text-sm text-gray-500 py-2">절기 로딩 중...</div>
        ) : seasonsList.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">등록된 절기가 없습니다</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onFilterChange('season', '전체')}
              className={`px-3 py-1 rounded-full text-sm transition ${
                filters.season === '전체'
                  ? 'bg-[#C5D7F2] text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {seasonsList.map(season => (
              <button
                key={season.name}
                onClick={() => onFilterChange('season', season.name)}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  filters.season === season.name
                    ? 'bg-[#C5D7F2] text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {season.name}
                <span className="ml-1 text-xs opacity-70">({season.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 테마 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Tag className="inline w-4 h-4 mr-1" />
          테마 (다중 선택)
        </label>
        {themesLoading ? (
          <div className="text-sm text-gray-500 py-2">테마 로딩 중...</div>
        ) : themeCounts.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">등록된 테마가 없습니다</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {displayedThemes.map(({ theme, count }) => (
                <button
                  key={theme}
                  onClick={() => onThemeToggle(theme)}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    filters.themes.includes(theme)
                      ? 'bg-[#C5D7F2] text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {theme}
                  <span className="ml-1 text-xs opacity-70">({count})</span>
                </button>
              ))}
            </div>
            {/* 더 보기/접기 버튼 */}
            {hasMoreThemes && (
              <button
                onClick={() => setShowAllThemes(!showAllThemes)}
                className="flex items-center gap-1 mt-3 text-sm text-blue-600 hover:text-blue-800 transition"
              >
                {showAllThemes ? (
                  <>
                    <ChevronUp size={16} />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    더 보기 (+{themeCounts.length - INITIAL_THEME_COUNT}개)
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Key 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Music className="inline w-4 h-4 mr-1" />
          Key
        </label>
        <div className="grid grid-cols-4 gap-2">
          {keys.map(key => (
            <button
              key={key}
              onClick={() => onFilterChange('key', filters.key === key ? '' : key)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                filters.key === key
                  ? 'bg-[#C5D7F2] text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Minor 버튼 */}
        <button
          onClick={() => onFilterChange('isMinor', !filters.isMinor)}
          className={`w-full mt-3 px-4 py-2 rounded-lg text-sm font-medium transition ${
            filters.isMinor
              ? 'bg-[#C4BEE2] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          minor
        </button>
      </div>

      {/* 박자 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Clock className="inline w-4 h-4 mr-1" />
          박자
        </label>
        <select
          value={filters.timeSignature}
          onChange={(e) => onFilterChange('timeSignature', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">전체</option>
          {timeSignatures.map(ts => (
            <option key={ts} value={ts}>{ts}</option>
          ))}
        </select>
      </div>

      {/* 템포 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Activity className="inline w-4 h-4 mr-1" />
          템포
        </label>
        <div className="flex flex-wrap gap-2">
          {tempos.map(tempo => (
            <button
              key={tempo}
              onClick={() => onFilterChange('tempo', filters.tempo === tempo ? '' : tempo)}
              className={`px-3 py-2 rounded text-sm transition whitespace-nowrap ${
                filters.tempo === tempo
                  ? 'bg-[#C5D7F2] text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {tempo}
            </button>
          ))}
        </div>
      </div>

      {/* BPM 범위 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Activity className="inline w-4 h-4 mr-1" />
          BPM 범위
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="최소"
            value={filters.bpmMin}
            onChange={(e) => onFilterChange('bpmMin', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
          />
          <span className="text-gray-500">~</span>
          <input
            type="number"
            placeholder="최대"
            value={filters.bpmMax}
            onChange={(e) => onFilterChange('bpmMax', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
          />
        </div>

        {/* 빠른 선택 버튼 */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              onFilterChange('bpmMin', '')
              onFilterChange('bpmMax', '80')
            }}
            className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            느림 (~80)
          </button>
          <button
            onClick={() => {
              onFilterChange('bpmMin', '80')
              onFilterChange('bpmMax', '120')
            }}
            className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            보통 (80-120)
          </button>
          <button
            onClick={() => {
              onFilterChange('bpmMin', '120')
              onFilterChange('bpmMax', '')
            }}
            className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            빠름 (120~)
          </button>
        </div>

        {/* 초기화 버튼 */}
        {(filters.bpmMin || filters.bpmMax) && (
          <button
            onClick={() => {
              onFilterChange('bpmMin', '')
              onFilterChange('bpmMax', '')
            }}
            className="w-full mt-2 px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
          >
            BPM 필터 초기화
          </button>
        )}
      </div>
    </div>
  )
}