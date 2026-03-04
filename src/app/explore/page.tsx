'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Music2, ChevronDown, Loader2, TrendingUp } from 'lucide-react'
import { useCommunity } from '@/hooks/useCommunity'
import type { SharedSetlist, CommunityFilters, CommunityPage } from '@/types/community'
import CommunitySetlistCard from '@/app/community/components/CommunitySetlistCard'
import CommunityFiltersComponent from '@/app/community/components/CommunityFilters'
import PopularSongsTab from './components/PopularSongsTab'

const defaultFilters: CommunityFilters = {
  sortBy: 'latest',
  serviceType: null,
  tags: [],
  searchText: '',
}

type TabType = 'popular' | 'shared'

function ExploreContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabType>(tabParam === 'shared' ? 'shared' : 'popular')

  const { fetchSharedSetlists, loading } = useCommunity()

  const [filters, setFilters] = useState<CommunityFilters>(defaultFilters)
  const [setlists, setSetlists] = useState<SharedSetlist[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)

  // URL 쿼리와 탭 상태 동기화
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'shared') setActiveTab('shared')
    else setActiveTab('popular')
  }, [searchParams])

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    const url = tab === 'shared' ? '/explore?tab=shared' : '/explore'
    router.replace(url, { scroll: false })
  }

  const loadSetlists = useCallback(async (newFilters: CommunityFilters) => {
    const result: CommunityPage = await fetchSharedSetlists(newFilters)
    setSetlists(result.items)
    setNextCursor(result.nextCursor)
    setHasMore(result.hasMore)
    setInitialLoaded(true)
  }, [fetchSharedSetlists])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const result: CommunityPage = await fetchSharedSetlists(filters, nextCursor)
      setSetlists(prev => [...prev, ...result.items])
      setNextCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [fetchSharedSetlists, filters, nextCursor, loadingMore])

  // 공유 콘티 탭 활성화 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'shared') {
      setInitialLoaded(false)
      loadSetlists(filters)
    }
  }, [activeTab, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-xl font-logo text-gray-900 hover:text-violet-600 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            WORSHEEP
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Explore</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 탭 UI */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => handleTabChange('popular')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'popular'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            <TrendingUp size={16} />
            <span>인기 악보</span>
          </button>
          <button
            onClick={() => handleTabChange('shared')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'shared'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            <Music2 size={16} />
            <span>공유 콘티</span>
          </button>
        </div>

        {/* 인기 악보 탭 */}
        {activeTab === 'popular' && <PopularSongsTab />}

        {/* 공유 콘티 탭 */}
        {activeTab === 'shared' && (
          <>
            {/* 히어로 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Music2 size={22} className="text-violet-600" />
                <h1 className="text-xl font-bold text-gray-900">공유 콘티</h1>
              </div>
              <p className="text-sm text-gray-500">다른 예배팀의 콘티에서 영감을 받아보세요</p>
            </div>

            {/* 필터 */}
            <div className="mb-6">
              <CommunityFiltersComponent
                filters={filters}
                onChange={setFilters}
              />
            </div>

            {/* 콘티 목록 */}
            {!initialLoaded || loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={28} className="text-violet-500 animate-spin" />
                <p className="text-sm text-gray-400">불러오는 중...</p>
              </div>
            ) : setlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Music2 size={40} className="text-gray-300" />
                <p className="text-gray-500 font-medium">공유된 콘티가 없습니다</p>
                <p className="text-sm text-gray-400">첫 번째로 콘티를 공유해보세요!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {setlists.map((setlist) => (
                    <CommunitySetlistCard
                      key={setlist.id}
                      setlist={setlist}
                      onClick={() => router.push(`/explore/${setlist.id}`)}
                    />
                  ))}
                </div>

                {/* 더 불러오기 */}
                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-violet-300 transition-all disabled:opacity-50"
                      style={{ touchAction: 'manipulation', minHeight: '44px' }}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>불러오는 중...</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} />
                          <span>더 불러오기</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                <p className="text-center text-xs text-gray-400 mt-4">
                  총 {setlists.length}개의 콘티
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="text-violet-500 animate-spin" />
      </div>
    }>
      <ExploreContent />
    </Suspense>
  )
}
