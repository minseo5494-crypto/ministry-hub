'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { Song, Filters, UserTeam } from '../types'
import StatsRow from './StatsRow'

type AISearchResult = {
  success: boolean
  filters: {
    themes?: string[]
    season?: string
    tempo?: string
    key?: string
    mood?: string
    keywords?: string[]
    lyricsKeywords?: string[]
  }
}

type HeroSectionProps = {
  songs: Song[]
  selectedSongs: Song[]
  filters: Filters
  setFilters: (filters: Filters) => void
  isAISearchEnabled: boolean
  setIsAISearchEnabled: (enabled: boolean) => void
  isAISearching: boolean
  aiSearchResult: AISearchResult | null
  aiSearchKeywords: string[]
  setAiSearchKeywords: (keywords: string[]) => void
  searchWithAI: (query: string) => Promise<AISearchResult | null>
  clearAIResult: () => void
  userTeams: UserTeam[]
}

export default function HeroSection({
  songs,
  selectedSongs,
  filters,
  setFilters,
  isAISearchEnabled,
  setIsAISearchEnabled,
  isAISearching,
  aiSearchResult,
  aiSearchKeywords,
  setAiSearchKeywords,
  searchWithAI,
  clearAIResult,
  userTeams
}: HeroSectionProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative bg-gradient-to-b from-gray-50 to-white pt-10 pb-6 md:pt-12 md:pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* 팀 배지 */}
        {userTeams.length > 0 && (
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {userTeams.map(team => (
                <span
                  key={team.id}
                  className="text-xs font-medium text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full"
                >
                  {team.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 제목 텍스트 - 두 줄 */}
        <div className="text-center mb-8 md:mb-12 mt-3 md:mt-0 pl-16 md:pl-0">
          <h1 className="text-[28px] md:text-4xl font-bold text-gray-900 leading-relaxed md:leading-snug">
            필요한 찬양악보를<br />
            지금 바로 검색하세요
          </h1>
        </div>

        {/* 검색바 + 양 캐릭터 */}
        <div className="max-w-5xl mx-auto mb-8 md:mb-10 relative">
          {/* 양 캐릭터 - 검색창 바로 위에 딱 붙어서 손만 살짝 걸침 */}
          <div className="absolute -top-[6.15rem] left-2 md:-top-[9rem] md:left-6 w-28 h-28 md:w-40 md:h-40 z-10 pointer-events-none">
            <Image
              src="/images/inside.png"
              alt="WORSHEEP 양 캐릭터"
              width={160}
              height={160}
              className="object-contain"
              style={{ width: '100%', height: '100%' }}
              priority
            />
          </div>

          <div className={`relative rounded-xl p-[2px] transition-all duration-300 ${isAISearchEnabled
            ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 shadow-lg shadow-purple-500/30'
            : 'bg-transparent'
            }`}>
            <div className="relative">
              <Search className={`absolute left-4 top-4 transition-colors ${isAISearchEnabled ? 'text-purple-500' : 'text-gray-400'}`} size={24} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isAISearchEnabled ? "자연어로 검색해보세요 (예: 부활절에 부르기 좋은 빠른 찬양)" : `찬양곡 제목, 아티스트${filters.includeLyrics ? ', 가사' : ''}로 검색...`}
                className={`w-full pl-12 pr-36 py-4 text-base md:text-lg text-gray-900 bg-white rounded-xl shadow-lg focus:outline-none ${isAISearchEnabled
                  ? 'focus:ring-2 focus:ring-purple-400'
                  : 'focus:ring-2 focus:ring-violet-400 border border-gray-200'
                  }`}
                value={filters.searchText}
                onChange={(e) => {
                  setFilters({ ...filters, searchText: e.target.value })
                  if (aiSearchKeywords.length > 0) {
                    setAiSearchKeywords([])
                    clearAIResult()
                  }
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && isAISearchEnabled && filters.searchText.trim()) {
                    const result = await searchWithAI(filters.searchText)
                    if (result?.success && result.filters) {
                      const aiFilters = result.filters
                      const allKeywords = [
                        ...(aiFilters.keywords || []),
                        ...(aiFilters.lyricsKeywords || [])
                      ]
                      setAiSearchKeywords(allKeywords)
                      setFilters({
                        ...filters,
                        season: aiFilters.season || filters.season,
                        tempo: aiFilters.tempo === 'slow' ? '느림' : aiFilters.tempo === 'fast' ? '빠름' : aiFilters.tempo === 'medium' ? '보통' : filters.tempo,
                        key: aiFilters.key || filters.key,
                      })
                    }
                  }
                }}
                style={{ backgroundColor: 'white', fontSize: '16px' }}
              />
              {/* 버튼 영역 */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  onClick={async () => {
                    searchInputRef.current?.blur();
                    if (isAISearchEnabled && filters.searchText.trim() && !isAISearching) {
                      const result = await searchWithAI(filters.searchText)
                      if (result?.success && result.filters) {
                        const aiFilters = result.filters
                        const allKeywords = [
                          ...(aiFilters.keywords || []),
                          ...(aiFilters.lyricsKeywords || [])
                        ]
                        setAiSearchKeywords(allKeywords)
                        setFilters({
                          ...filters,
                          season: aiFilters.season || filters.season,
                          tempo: aiFilters.tempo === 'slow' ? '느림' : aiFilters.tempo === 'fast' ? '빠름' : aiFilters.tempo === 'medium' ? '보통' : filters.tempo,
                          key: aiFilters.key || filters.key,
                        })
                      }
                    }
                  }}
                  disabled={isAISearchEnabled && (!filters.searchText.trim() || isAISearching)}
                  className={`p-2.5 rounded-xl transition-all ${
                    isAISearchEnabled
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="검색"
                >
                  {isAISearching ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <Search size={20} />
                  )}
                </button>
                <button
                  onClick={() => setIsAISearchEnabled(!isAISearchEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-300 ${isAISearchEnabled
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                    }`}
                  title={isAISearchEnabled ? 'AI 검색 끄기' : 'AI 검색 켜기'}
                >
                  <span className="flex items-center gap-1">
                    <span>✨</span>
                    <span>AI</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 가사 검색 토글 */}
          {!isAISearchEnabled && (
            <div className="mt-3 flex justify-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.includeLyrics}
                  onChange={(e) => setFilters({ ...filters, includeLyrics: e.target.checked })}
                  className="w-3 h-3 rounded border-gray-300 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
                  style={{ minHeight: '12px', minWidth: '12px', width: '12px', height: '12px' }}
                />
                <span className="text-sm font-medium text-gray-600">
                  가사 포함 검색
                </span>
              </label>
            </div>
          )}

          {/* AI 검색 결과 피드백 */}
          {aiSearchResult && aiSearchResult.success && (
            <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-violet-700 flex items-center gap-1">
                  ✨ AI 검색 해석 결과
                </span>
                <button
                  onClick={clearAIResult}
                  className="text-violet-400 hover:text-violet-600 text-xs"
                >
                  닫기
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiSearchResult.filters.lyricsKeywords?.length && aiSearchResult.filters.lyricsKeywords.length > 0 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                    🔍 {aiSearchResult.filters.lyricsKeywords.slice(0, 5).join(', ')}{aiSearchResult.filters.lyricsKeywords.length > 5 ? ' ...' : ''}
                  </span>
                )}
                {aiSearchResult.filters.season && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    📅 {aiSearchResult.filters.season}
                  </span>
                )}
                {aiSearchResult.filters.tempo && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                    🎵 {aiSearchResult.filters.tempo === 'slow' ? '느린' : aiSearchResult.filters.tempo === 'fast' ? '빠른' : '보통'} 템포
                  </span>
                )}
                {aiSearchResult.filters.key && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    🎹 {aiSearchResult.filters.key} Key
                  </span>
                )}
                {aiSearchResult.filters.mood && (
                  <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                    💭 {aiSearchResult.filters.mood}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 통계 카드 */}
        <div className="max-w-5xl mx-auto">
          <StatsRow songs={songs} selectedSongs={selectedSongs} />
        </div>
      </div>
    </div>
  )
}
