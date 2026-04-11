'use client'

import { useState } from 'react'
import { Filter, ChevronDown, Pencil } from 'lucide-react'
import { User, Song, Filters, SortBy, SongFilter, LocalSheetMusicNote } from '../types'
import { useTranslations } from 'next-intl'

type SongListToolbarProps = {
  user: User | null
  filteredSongs: Song[]
  displayCount: number
  showFilterPanel: boolean
  setShowFilterPanel: (show: boolean) => void
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
  const t = useTranslations('main')

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
              ? t('songCountPartial', { displayed: displayCount, total: filteredSongs.length })
              : t('songCount', { count: filteredSongs.length })
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
              <span>{sortBy === 'recent' ? t('sortRecent') : sortBy === 'likes' ? t('sortLikes') : sortBy === 'weekly' ? t('sortWeekly') : t('sortName')}</span>
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
                    {t('sortRecent')}
                  </button>
                  <button
                    onClick={() => { setSortBy('likes'); setShowSortDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${sortBy === 'likes' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    {t('sortLikes')}
                  </button>
                  <button
                    onClick={() => { setSortBy('name'); setShowSortDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${sortBy === 'name' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    {t('sortName')}
                  </button>
                  <button
                    onClick={() => { setSortBy('weekly'); setShowSortDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${sortBy === 'weekly' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    {t('sortWeekly')}
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
                  : songFilter === 'team'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <span>{songFilter === 'all' ? t('filterAll') : songFilter === 'official' ? t('filterOfficial') : songFilter === 'user' ? t('filterUser') : t('filterTeam')}</span>
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
                    {t('filterAll')}
                  </button>
                  <button
                    onClick={() => { setSongFilter('official'); setShowSongFilterDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${songFilter === 'official' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    {t('filterOfficial')}
                  </button>
                  <button
                    onClick={() => { setSongFilter('user'); setShowSongFilterDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${songFilter === 'user' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    {t('filterUser')}
                  </button>
                  <button
                    onClick={() => { setSongFilter('team'); setShowSongFilterDropdown(false); }}
                    className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-gray-50 ${songFilter === 'team' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    {t('filterTeam')}
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
              title={filters.includeMyNotes ? t('myNotesIncluded') : t('myNotesExcluded')}
            >
              <span>{t('myNotes')}</span>
              {filters.includeMyNotes && (
                <span className="ml-1 text-[9px] bg-purple-200 px-1 py-0.5 rounded-full">{mySheetNotes.length}</span>
              )}
            </button>
          )}

        </div>
      </div>

      {/* 두 번째 줄: 정렬 및 필터 - 모바일에서만 표시 */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 sm:hidden">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="h-9 w-[72px] px-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border-0 focus:ring-2 focus:ring-blue-500 appearance-none text-center"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 4px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', paddingRight: '20px' }}
        >
          <option value="recent">{t('sortRecent')}</option>
          <option value="likes">{t('sortLikes')}</option>
          <option value="name">{t('sortName')}</option>
          <option value="weekly">{t('sortPopular')}</option>
        </select>
        {/* 공식/사용자 악보 필터 - 모바일 */}
        <select
          value={songFilter}
          onChange={(e) => setSongFilter(e.target.value as SongFilter)}
          className="h-9 w-[72px] px-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border-0 focus:ring-2 focus:ring-blue-500 appearance-none text-center"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 4px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', paddingRight: '20px' }}
        >
          <option value="all">{t('filterAll')}</option>
          <option value="official">{t('filterOfficial')}</option>
          <option value="user">{t('filterUser')}</option>
          <option value="team">{t('filterTeam')}</option>
        </select>
        {/* 내 필기 노트 포함 토글 - 모바일 */}
        {user && mySheetNotes.length > 0 && (
          <button
            onClick={() => setFilters({ ...filters, includeMyNotes: !filters.includeMyNotes })}
            className={`h-9 px-3 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${filters.includeMyNotes
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Pencil size={12} className="flex-shrink-0" />
            <span className="whitespace-nowrap">{t('myNotes')}</span>
            {filters.includeMyNotes && (
              <span className="text-[9px] bg-purple-200 px-1 rounded-full">{mySheetNotes.length}</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
