'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Search, Plus, UserPlus, Music, ListMusic, Users, Tv } from 'lucide-react'
import { Song, Filters, UserTeam, User } from '../types'
import StatsRow from './StatsRow'
import { useTranslations } from 'next-intl'

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
  error?: string
}

type HeroSectionProps = {
  user: User | null
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

// 양 캐릭터 + 제목을 감싸는 히어로 셸. 세 상태(비로그인/팀없음/팀있음)가 공유한다.
function HeroShell({
  title,
  children
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative bg-gradient-to-b from-gray-50 to-white pt-10 pb-6 md:pt-12 md:pb-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8 md:mb-12 mt-3 md:mt-0 pt-[2px] md:pt-0">
          <div className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-2 pointer-events-none">
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
          <h1 className="text-2xl md:text-4xl font-normal text-gray-900 leading-tight md:leading-snug">
            {title}
          </h1>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function HeroSection({
  user,
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
  const router = useRouter()
  const t = useTranslations('main')
  const tc = useTranslations('common')

  // 상태 1 — 비로그인: 검색바 없이 랜딩 + 서비스 소개 + 가입 유도.
  // (팀 단위 폐쇄 공유 모델이라 비로그인에게 노출할 공개 검색이 존재하지 않는다)
  if (!user) {
    const features = [
      { Icon: Music, title: t('landingFeature1Title'), desc: t('landingFeature1Desc'), color: 'text-violet-600 bg-violet-50' },
      { Icon: ListMusic, title: t('landingFeature2Title'), desc: t('landingFeature2Desc'), color: 'text-indigo-600 bg-indigo-50' },
      { Icon: Users, title: t('landingFeature3Title'), desc: t('landingFeature3Desc'), color: 'text-teal-600 bg-teal-50' },
      { Icon: Tv, title: t('landingFeature4Title'), desc: t('landingFeature4Desc'), color: 'text-amber-600 bg-amber-50' },
    ]
    return (
      <>
        <HeroShell
          title={t.rich('landingTitle', { bold: (chunks) => <span className="font-bold">{chunks}</span> })}
        >
          <p className="text-center text-gray-600 text-base md:text-lg max-w-xl mx-auto mb-8">
            {t('landingSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto px-8 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-600 transition shadow-lg shadow-violet-500/20"
              style={{ touchAction: 'manipulation' }}
            >
              {t('landingLogin')}
            </button>
            <button
              onClick={() => router.push('/signup')}
              className="w-full sm:w-auto px-8 py-3 bg-white text-violet-600 border border-violet-200 rounded-xl font-semibold hover:bg-violet-50 transition"
              style={{ touchAction: 'manipulation' }}
            >
              {t('landingSignup')}
            </button>
          </div>
        </HeroShell>

        {/* 기능 소개 섹션 */}
        <div className="bg-white py-14 md:py-20">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-center text-xl md:text-3xl font-bold text-gray-900 mb-10 md:mb-14">
              {t('landingFeaturesTitle')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
              {features.map(({ Icon, title, desc, color }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 p-5 md:p-6 rounded-2xl border border-gray-100 bg-gray-50/60"
                >
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{title}</h3>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 하단 CTA */}
            <div className="text-center mt-12 md:mt-16">
              <button
                onClick={() => router.push('/signup')}
                className="px-10 py-4 bg-violet-500 text-white rounded-xl font-bold text-lg hover:bg-violet-600 transition shadow-lg shadow-violet-500/20"
                style={{ touchAction: 'manipulation' }}
              >
                {t('landingCTA')} →
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // 상태 2 — 로그인했지만 팀 없음: 검색 대신 팀 만들기/참여 온보딩.
  if (userTeams.length === 0) {
    return (
      <HeroShell title={t('onboardingTitle')}>
        <p className="text-center text-gray-600 text-base md:text-lg max-w-xl mx-auto mb-8">
          {t('onboardingSubtitle')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => router.push('/teams/create')}
            className="p-6 bg-white border-2 border-violet-200 rounded-xl hover:bg-violet-50 transition text-left"
            style={{ touchAction: 'manipulation' }}
          >
            <Plus className="w-8 h-8 text-violet-600 mb-3" />
            <h3 className="font-bold text-lg text-gray-900 mb-1">{t('onboardingCreate')}</h3>
            <p className="text-sm text-gray-600">{t('onboardingCreateDesc')}</p>
          </button>
          <button
            onClick={() => router.push('/teams/join')}
            className="p-6 bg-white border-2 border-teal-200 rounded-xl hover:bg-teal-50 transition text-left"
            style={{ touchAction: 'manipulation' }}
          >
            <UserPlus className="w-8 h-8 text-teal-600 mb-3" />
            <h3 className="font-bold text-lg text-gray-900 mb-1">{t('onboardingJoin')}</h3>
            <p className="text-sm text-gray-600">{t('onboardingJoinDesc')}</p>
          </button>
        </div>
      </HeroShell>
    )
  }

  // 상태 3 — 로그인 + 팀 있음: 기존 검색 히어로.
  return (
    <div className="relative bg-gradient-to-b from-gray-50 to-white pt-10 pb-6 md:pt-12 md:pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* 팀 배지 */}
        {userTeams.length > 0 && (
          <div className="flex justify-end mb-8 -mt-4 md:-mt-4">
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {userTeams.map(team => (
                <span
                  key={team.id}
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ color: '#ffffff', backgroundColor: '#b2a5c4' }}
                >
                  {team.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 제목 텍스트 - 두 줄 */}
        <div className="text-center mb-8 md:mb-12 mt-3 md:mt-0 pl-[114px] md:pl-0 pt-[2px] md:pt-0">
          <h1 className="text-[21px] md:text-4xl font-normal text-gray-900 leading-tight md:leading-snug">
            {t.rich('heroTitle', { bold: (chunks) => <span className="font-bold">{chunks}</span> })}<br />
            {t('heroTitleLine2')}
          </h1>
        </div>

        {/* 검색바 + 양 캐릭터 */}
        <div className="max-w-5xl mx-auto mb-8 md:mb-10 relative">
          {/* 양 캐릭터 - 검색창 바로 위에 딱 붙어서 손만 살짝 걸침 */}
          <div className="absolute -top-[7.56rem] left-0 md:-top-[9rem] md:left-6 w-[8.5rem] h-[8.5rem] md:w-40 md:h-40 z-10 pointer-events-none">
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
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                searchInputRef.current?.blur()
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
              className="relative"
            >
              <Search className={`absolute left-4 top-5 md:top-4 transition-colors ${isAISearchEnabled ? 'text-purple-500' : 'text-gray-400'}`} size={24} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isAISearchEnabled ? t('aiSearchPlaceholder') : t('searchPlaceholder', { lyrics: filters.includeLyrics ? t('searchLyricsSuffix') : '' })}
                className={`w-full pl-12 pr-36 py-5 md:py-4 text-base md:text-lg text-gray-900 bg-white rounded-xl shadow-lg focus:outline-none ${isAISearchEnabled
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
                style={{ backgroundColor: 'white', fontSize: '16px' }}
              />
              {/* 버튼 영역 */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={isAISearchEnabled && (!filters.searchText.trim() || isAISearching)}
                  className={`p-2.5 rounded-xl transition-all ${
                    isAISearchEnabled
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={tc('search')}
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
                  type="button"
                  onClick={() => setIsAISearchEnabled(!isAISearchEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-300 ${isAISearchEnabled
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                    }`}
                  title={isAISearchEnabled ? t('aiSearchOn') : t('aiSearchOff')}
                >
                  <span className="flex items-center gap-1">
                    <span>✨</span>
                    <span>AI</span>
                  </span>
                </button>
              </div>
            </form>
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
                  {t('includeLyrics')}
                </span>
              </label>
            </div>
          )}

          {/* AI 검색 에러 (로그인 필요 등) */}
          {aiSearchResult && !aiSearchResult.success && aiSearchResult.error && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-amber-700 flex items-center gap-1.5">
                  {aiSearchResult.error === '로그인이 필요합니다.' || aiSearchResult.error === 'Login required.' ? (
                    <>
                      <span>{t('aiLoginRequired')}</span>
                      <a
                        href="/login"
                        className="underline font-semibold text-amber-800 hover:text-amber-900"
                      >
                        {t('aiLoginLink')}
                      </a>
                    </>
                  ) : (
                    <span>{aiSearchResult.error}</span>
                  )}
                </span>
                <button
                  onClick={clearAIResult}
                  className="text-amber-400 hover:text-amber-600 text-xs ml-2 shrink-0"
                >
                  {tc('close')}
                </button>
              </div>
            </div>
          )}

          {/* AI 검색 결과 피드백 */}
          {aiSearchResult && aiSearchResult.success && (
            <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-violet-700 flex items-center gap-1">
                  ✨ {t('aiResultTitle')}
                </span>
                <button
                  onClick={clearAIResult}
                  className="text-violet-400 hover:text-violet-600 text-xs"
                >
                  {tc('close')}
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
                    🎵 {aiSearchResult.filters.tempo === 'slow' ? t('aiTempoSlow') : aiSearchResult.filters.tempo === 'fast' ? t('aiTempoFast') : t('aiTempoMedium')} {t('aiTempo')}
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
