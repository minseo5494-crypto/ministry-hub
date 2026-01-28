'use client'

import { useState } from 'react'
import { Filter, Grid, List, ChevronDown, Pencil } from 'lucide-react'
import { User, Song, Filters, SortBy, SongFilter, ViewMode, LocalSheetMusicNote } from '../types'

type SongListToolbarProps = {
  user: User | null
  filteredSongs: Song[]
  displayCount: number
  showFilterPanel: boolean
  setShowFilterPanel: (show: boolean) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  sortBy: SortBy
  setSortBy: (sort: SortBy) => void
  songFilter: SongFilter
  setSongFilter: (filter: SongFilter) => void
  filters: Filters
  setFilters: (filters: Filters) => void
  mySheetNotes: LocalSheetMusicNote[]
}

export default function SongListToolbar({
  user,
  filteredSongs,
  displayCount,
  showFilterPanel,
  setShowFilterPanel,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  songFilter,
  setSongFilter,
  filters,
  setFilters,
  mySheetNotes
}: SongListToolbarProps) {
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showSongFilterDropdown, setShowSongFilterDropdown] = useState(false)

  return (
    <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4">
      {/* 첫 번째 줄 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
          >
            <Filter size={18} className="sm:w-5 sm:h-5" />
          </button>
          <span className="text-gray-600 text-sm sm:text-base whitespace-nowrap">
            {displayCount < filteredSongs.length
              ? `${displayCount} / ${filteredSongs.length}개의 찬양`
              : `${filteredSongs.length}개의 찬양`
            }
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* 정렬 드롭다운 - 데스크탑 */}
          <div className="hidden sm:block relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 h-7 px-2 bg-gray-100 text-gray-700 rounded-md text-[11px] font-medium hover:bg-gray-200 transition-all"
            >
              <span>{sortBy === 'recent' ? '최신순' : sortBy === 'likes' ? '좋아요순' : sortBy === 'weekly' ? '많이 찾은 순' : '이름순'}</span>
              <ChevronDown size={10} className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showSortDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border py-1 z-20 min-w-[70px]">
                  <button
                    onClick={() => { setSortBy('recent'); setShowSortDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${sortBy === 'recent' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    최신순
                  </button>
                  <button
                    onClick={() => { setSortBy('likes'); setShowSortDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${sortBy === 'likes' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    좋아요순
                  </button>
                  <button
                    onClick={() => { setSortBy('name'); setShowSortDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${sortBy === 'name' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    이름순
                  </button>
                  <button
                    onClick={() => { setSortBy('weekly'); setShowSortDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${sortBy === 'weekly' ? 'text-orange-600 font-medium' : 'text-gray-700'}`}
                  >
                    🔥 많이 찾은 순
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 공식/사용자 악보 필터 - 데스크탑 */}
          <div className="hidden sm:block relative">
            <button
              onClick={() => setShowSongFilterDropdown(!showSongFilterDropdown)}
              className={`flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium transition-all ${songFilter === 'official'
                ? 'bg-blue-100 text-blue-700'
                : songFilter === 'user'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <span>{songFilter === 'all' ? '전체' : songFilter === 'official' ? '공식' : '사용자'}</span>
              <ChevronDown size={10} className={`transition-transform ${showSongFilterDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showSongFilterDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSongFilterDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border py-1 z-20 min-w-[60px]">
                  <button
                    onClick={() => { setSongFilter('all'); setShowSongFilterDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${songFilter === 'all' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => { setSongFilter('official'); setShowSongFilterDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${songFilter === 'official' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    공식
                  </button>
                  <button
                    onClick={() => { setSongFilter('user'); setShowSongFilterDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${songFilter === 'user' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    사용자
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 내 필기 노트 포함 토글 - 데스크탑 */}
          {user && mySheetNotes.length > 0 && (
            <button
              onClick={() => setFilters({ ...filters, includeMyNotes: !filters.includeMyNotes })}
              className={`hidden sm:flex items-center h-7 px-2 rounded-md text-[11px] font-medium transition-all ${filters.includeMyNotes
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              title={filters.includeMyNotes ? '내 필기 노트 포함됨' : '내 필기 노트 미포함'}
            >
              <span>내 필기</span>
              {filters.includeMyNotes && (
                <span className="ml-1 text-[9px] bg-purple-200 px-1 py-0.5 rounded-full">{mySheetNotes.length}</span>
              )}
            </button>
          )}

          <div className="w-px h-6 bg-gray-200 hidden md:block"></div>

          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 sm:p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
              }`}
          >
            <Grid size={18} className="sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 sm:p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
              }`}
          >
            <List size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* 두 번째 줄: 정렬 및 필터 - 모바일에서만 표시 */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 sm:hidden">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="h-8 px-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border-0 focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">최신순</option>
          <option value="likes">좋아요순</option>
          <option value="name">이름순</option>
          <option value="weekly">🔥 많이 찾은 순</option>
        </select>
        {/* 공식/사용자 악보 필터 - 모바일 */}
        <select
          value={songFilter}
          onChange={(e) => setSongFilter(e.target.value as SongFilter)}
          className="h-8 px-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border-0 focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체</option>
          <option value="official">공식</option>
          <option value="user">사용자</option>
        </select>
        {/* 내 필기 노트 포함 토글 - 모바일 */}
        {user && mySheetNotes.length > 0 && (
          <button
            onClick={() => setFilters({ ...filters, includeMyNotes: !filters.includeMyNotes })}
            className={`h-8 flex items-center gap-1 px-2.5 rounded-lg text-xs font-medium transition-all ${filters.includeMyNotes
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Pencil size={12} className="flex-shrink-0" />
            <span>내 필기</span>
          </button>
        )}
      </div>
    </div>
  )
}
