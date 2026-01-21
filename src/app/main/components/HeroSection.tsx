'use client'

import { Search } from 'lucide-react'
import { Song, Filters } from '../types'

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
  clearAIResult
}: HeroSectionProps) {
  return (
    <div
      className="relative bg-cover bg-center py-16"
      style={{
        backgroundImage: `url('/images/church-hero.jpg')`
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        {/* 제목 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 hero-title" style={{
            color: '#FFFFFF',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)'
          }}>
            찬양으로 하나되는 예배
          </h1>
          <p className="text-lg md:text-xl" style={{
            color: '#FFFFFF',
            opacity: 0.95,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)'
          }}>
            <span className="whitespace-nowrap">WORSHEEP과 함께 은혜로운</span>{' '}
            <span className="whitespace-nowrap">예배를 준비하세요</span>
          </p>
        </div>

        {/* 검색바 */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className={`relative rounded-xl p-[2px] transition-all duration-300 ${isAISearchEnabled
            ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 shadow-lg shadow-purple-500/30'
            : 'bg-transparent'
            }`}>
            <div className="relative">
              <Search className={`absolute left-4 top-4 transition-colors ${isAISearchEnabled ? 'text-purple-500' : 'text-gray-400'}`} size={24} />
              <input
                type="text"
                placeholder={isAISearchEnabled ? "자연어로 검색해보세요 (예: 부활절에 부르기 좋은 빠른 찬양)" : `찬양곡 제목, 아티스트${filters.includeLyrics ? ', 가사' : ''}로 검색...`}
                className={`w-full pl-12 pr-28 py-4 text-lg text-gray-900 bg-white rounded-xl shadow-xl focus:outline-none ${isAISearchEnabled
                  ? 'focus:ring-2 focus:ring-purple-400'
                  : 'focus:ring-4 focus:ring-blue-500 border-2 border-white/50'
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
                      // AI 검색 시 themes 필터는 적용하지 않음 (lyricsKeywords로 충분)
                      // themes 필터를 적용하면 themes가 없는 곡들이 제외됨
                      setFilters({
                        ...filters,
                        // themes는 설정하지 않음 - lyricsKeywords가 가사 검색을 담당
                        season: aiFilters.season || filters.season,
                        tempo: aiFilters.tempo === 'slow' ? '느림' : aiFilters.tempo === 'fast' ? '빠름' : aiFilters.tempo === 'medium' ? '보통' : filters.tempo,
                        key: aiFilters.key || filters.key,
                      })
                    }
                  }
                }}
                style={{ backgroundColor: 'white' }}
              />
              {/* AI 검색 토글 */}
              <button
                onClick={() => setIsAISearchEnabled(!isAISearchEnabled)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-300 ${isAISearchEnabled
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
              >
                {isAISearching ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>검색중</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span>✨</span>
                    <span>AI 검색</span>
                  </span>
                )}
              </button>
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
                  className="w-4 h-4 rounded border-white/50 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 bg-white/20"
                />
                <span className="text-sm font-medium" style={{ color: '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                  가사 포함 검색
                </span>
              </label>
            </div>
          )}

          {/* AI 검색 결과 피드백 */}
          {aiSearchResult && aiSearchResult.success && (
            <div className="mt-3 bg-white/10 backdrop-blur rounded-lg p-3 text-white text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium flex items-center gap-1">
                  ✨ AI 검색 해석 결과
                </span>
                <button
                  onClick={clearAIResult}
                  className="text-white/60 hover:text-white text-xs"
                >
                  닫기
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* 가사 검색 키워드 표시 (lyricsKeywords) */}
                {aiSearchResult.filters.lyricsKeywords?.length && aiSearchResult.filters.lyricsKeywords.length > 0 && (
                  <span className="px-2 py-1 bg-purple-500/30 rounded text-xs">
                    🔍 {aiSearchResult.filters.lyricsKeywords.slice(0, 5).join(', ')}{aiSearchResult.filters.lyricsKeywords.length > 5 ? ' ...' : ''}
                  </span>
                )}
                {aiSearchResult.filters.season && (
                  <span className="px-2 py-1 bg-green-500/30 rounded text-xs">
                    📅 {aiSearchResult.filters.season}
                  </span>
                )}
                {aiSearchResult.filters.tempo && (
                  <span className="px-2 py-1 bg-orange-500/30 rounded text-xs">
                    🎵 {aiSearchResult.filters.tempo === 'slow' ? '느린' : aiSearchResult.filters.tempo === 'fast' ? '빠른' : '보통'} 템포
                  </span>
                )}
                {aiSearchResult.filters.key && (
                  <span className="px-2 py-1 bg-blue-500/30 rounded text-xs">
                    🎹 {aiSearchResult.filters.key} Key
                  </span>
                )}
                {aiSearchResult.filters.mood && (
                  <span className="px-2 py-1 bg-pink-500/30 rounded text-xs">
                    💭 {aiSearchResult.filters.mood}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-2 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-semibold" style={{ color: '#ffffff' }}>{songs.length}+</div>
            <div className="text-[10px] md:text-xs opacity-80" style={{ color: '#ffffff' }}>찬양곡</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-2 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-semibold" style={{ color: '#ffffff' }}>
              {new Set(songs.map(s => s.team_name).filter(Boolean)).size}+
            </div>
            <div className="text-[10px] md:text-xs opacity-80" style={{ color: '#ffffff' }}>아티스트</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-2 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-semibold" style={{ color: '#ffffff' }}>{selectedSongs.length}</div>
            <div className="text-[10px] md:text-xs opacity-80" style={{ color: '#ffffff' }}>선택한 곡</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-2 md:p-4 text-center">
            <div className="text-lg md:text-2xl font-semibold" style={{ color: '#ffffff' }}>12</div>
            <div className="text-[10px] md:text-xs opacity-80" style={{ color: '#ffffff' }}>Key</div>
          </div>
        </div>
      </div>
    </div>
  )
}
