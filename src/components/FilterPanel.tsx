// src/components/FilterPanel.tsx
// 🎯 곡 필터 패널 컴포넌트

'use client'

import { useState } from 'react'
import { Calendar, Tag, Music, Clock, Activity, X, ChevronDown, ChevronUp } from 'lucide-react'
import { ThemeCount, SeasonCount } from '@/lib/supabase'
import { KEYS, TIME_SIGNATURES, TEMPOS } from '@/lib/constants'
import { useTranslations } from 'next-intl'

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
  // 동적 시즌 목록
  seasonsList?: SeasonCount[]
  seasonsLoading?: boolean
}

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

  const t = useTranslations('filter')
  const td = useTranslations('data')

  // DB 값을 번역된 표시명으로 변환
  const translateSeason = (name: string) => {
    const key = `season_${name}` as any
    return td.has(key) ? td(key) : name
  }
  const translateTheme = (name: string) => {
    const key = `theme_${name}` as any
    return td.has(key) ? td(key) : name
  }
  const translateTempo = (name: string) => {
    const key = `tempo_${name}` as any
    return td.has(key) ? td(key) : name
  }

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
    <div
      className="bg-white rounded-lg shadow-md p-4 md:p-6 sticky top-20 max-h-[80vh] overflow-y-auto lg:max-h-none lg:overflow-visible"
      style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* 모바일 닫기 버튼 */}
      {isMobile && onClose && (
        <div className="flex items-center justify-between mb-4 pb-2 border-b md:hidden">
          <h3 className="font-bold text-lg">{t('title')}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">{t('title')}</h3>
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:underline"
        >
          {t('reset')}
        </button>
      </div>

      {/* 시즌 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Calendar className="inline w-4 h-4 mr-1" />
          {t('season')}
        </label>
        {seasonsLoading ? (
          <div className="text-sm text-gray-500 py-2">{t('seasonLoading')}</div>
        ) : seasonsList.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">{t('noSeasons')}</div>
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
              {t('all')}
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
                {translateSeason(season.name)}
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
          {t('theme')}
        </label>
        {themesLoading ? (
          <div className="text-sm text-gray-500 py-2">{t('themeLoading')}</div>
        ) : themeCounts.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">{t('noThemes')}</div>
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
                  {translateTheme(theme)}
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
                    {t('showLess')}
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    {t('showMore', { count: themeCounts.length - INITIAL_THEME_COUNT })}
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
          {t('key')}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {KEYS.map(key => (
            <button
              key={key}
              onClick={() => onFilterChange('key', filters.key === key ? '' : key)}
              className={`py-2 rounded text-sm font-medium transition text-center ${
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
          {t('timeSignature')}
        </label>
        <select
          value={filters.timeSignature}
          onChange={(e) => onFilterChange('timeSignature', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">{t('all')}</option>
          {TIME_SIGNATURES.map(ts => (
            <option key={ts} value={ts}>{ts}</option>
          ))}
        </select>
      </div>

      {/* 템포 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Activity className="inline w-4 h-4 mr-1" />
          {t('tempo')}
        </label>
        <div className="flex flex-wrap gap-2">
          {TEMPOS.map(tempo => (
            <button
              key={tempo}
              onClick={() => onFilterChange('tempo', filters.tempo === tempo ? '' : tempo)}
              className={`px-3 py-2 rounded text-sm transition whitespace-nowrap ${
                filters.tempo === tempo
                  ? 'bg-[#C5D7F2] text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {translateTempo(tempo)}
            </button>
          ))}
        </div>
      </div>

      {/* BPM 범위 필터 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Activity className="inline w-4 h-4 mr-1" />
          {t('bpmRange')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={t('bpmMin')}
            value={filters.bpmMin}
            onChange={(e) => onFilterChange('bpmMin', e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
          />
          <span className="text-gray-500 flex-shrink-0">~</span>
          <input
            type="number"
            placeholder={t('bpmMax')}
            value={filters.bpmMax}
            onChange={(e) => onFilterChange('bpmMax', e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
          />
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
            {t('bpmReset')}
          </button>
        )}
      </div>
    </div>
  )
}