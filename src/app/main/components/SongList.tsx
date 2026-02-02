'use client'

import { useRef } from 'react'
import { Music } from 'lucide-react'
import SongGridItem from './SongGridItem'
import SongListItem from './SongListItem'
import { Song, SongWithNote, ViewMode } from '../types'

type SongListProps = {
  loading: boolean
  displayedSongs: (Song | SongWithNote)[]
  filteredSongs: (Song | SongWithNote)[]
  selectedSongs: (Song | SongWithNote)[]
  viewMode: ViewMode
  focusedSongIndex: number
  setFocusedSongIndex: (index: number) => void
  previewStates: { [key: string]: boolean }
  youtubeStates: { [key: string]: boolean }
  likedSongs: Set<string>
  songForms: { [songId: string]: string[] }
  showFilterPanel: boolean
  displayCount: number
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onToggleSongSelection: (song: Song) => void
  onTogglePreview: (songId: string) => void
  onOpenNotePreview?: (song: Song | SongWithNote) => void
  onToggleYoutube: (songId: string) => void
  onToggleLike: (e: React.MouseEvent, songId: string) => void
  onSetPreviewSong: (song: Song) => void
  onOpenFormModal: (song: Song) => void
  onOpenSheetViewer: (song: Song) => void
  onOpenLyricsModal: (song: Song) => void
  onOpenSimpleViewer: (song: Song) => void
  onSetYoutubeModalSong: (song: Song) => void
  onSetEditingSong: (song: Song) => void
  onSetShowNoteEditor: (show: boolean) => void
  getYoutubeEmbedUrl: (url: string) => string | null
  handleDoubleTap: (song: Song) => void
}

export default function SongList({
  loading,
  displayedSongs,
  filteredSongs,
  selectedSongs,
  viewMode,
  focusedSongIndex,
  setFocusedSongIndex,
  previewStates,
  youtubeStates,
  likedSongs,
  songForms,
  showFilterPanel,
  displayCount,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onToggleSongSelection,
  onTogglePreview,
  onOpenNotePreview,
  onToggleYoutube,
  onToggleLike,
  onSetPreviewSong,
  onOpenFormModal,
  onOpenSheetViewer,
  onOpenLyricsModal,
  onOpenSimpleViewer,
  onSetYoutubeModalSong,
  onSetEditingSong,
  onSetShowNoteEditor,
  getYoutubeEmbedUrl,
  handleDoubleTap
}: SongListProps) {
  const songListRef = useRef<HTMLDivElement>(null)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-visible">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (filteredSongs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-visible">
        <div className="text-center py-12 text-gray-500">
          <Music size={48} className="mx-auto mb-4 text-gray-300" />
          <p>검색 결과가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md overflow-visible">
        {viewMode === 'grid' ? (
          // 그리드 뷰
          <div className="p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {displayedSongs.map((song, index) => (
              <SongGridItem
                key={song.id}
                song={song}
                index={index}
                isSelected={!!selectedSongs.find(s => s.id === song.id)}
                previewState={previewStates[song.id]}
                onSelect={() => {
                  onToggleSongSelection(song)
                  setFocusedSongIndex(index)
                }}
                onPreviewClick={() => onSetPreviewSong(song)}
                onEditClick={() => {
                  onSetEditingSong(song)
                  onSetShowNoteEditor(true)
                }}
                onYoutubeClick={() => onSetYoutubeModalSong(song)}
                onDoubleClick={() => onOpenSimpleViewer(song)}
                onDoubleTap={() => handleDoubleTap(song)}
              />
            ))}
          </div>
        ) : (
          // 리스트 뷰
          <div ref={songListRef} className="divide-y divide-gray-200">
            {displayedSongs.map((song, index) => (
              <SongListItem
                key={song.id}
                song={song}
                index={index}
                isSelected={!!selectedSongs.find(s => s.id === song.id)}
                isFocused={focusedSongIndex === index}
                previewState={previewStates[song.id]}
                youtubeState={youtubeStates[song.id]}
                likedSongs={likedSongs}
                songForms={songForms}
                showFilterPanel={showFilterPanel}
                onSelect={() => {
                  onToggleSongSelection(song)
                  setFocusedSongIndex(index)
                }}
                onFocus={() => setFocusedSongIndex(index)}
                onTogglePreview={() => onTogglePreview(song.id)}
                onOpenNotePreview={onOpenNotePreview ? () => onOpenNotePreview(song) : undefined}
                onToggleYoutube={() => onToggleYoutube(song.id)}
                onToggleLike={(e) => onToggleLike(e, song.id)}
                onOpenFormModal={() => onOpenFormModal(song)}
                onOpenSheetViewer={() => onOpenSheetViewer(song)}
                onOpenLyricsModal={() => onOpenLyricsModal(song)}
                onDoubleClick={() => onOpenSimpleViewer(song)}
                onDoubleTap={() => handleDoubleTap(song)}
                getYoutubeEmbedUrl={getYoutubeEmbedUrl}
              />
            ))}
          </div>
        )}
      </div>

      {/* 더보기 버튼 */}
      {hasMore && (
        <div className="py-8 text-center">
          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="text-gray-600">더 불러오는 중...</span>
            </div>
          ) : (
            <button
              onClick={onLoadMore}
              className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              더보기 ({displayCount} / {filteredSongs.length}곡)
            </button>
          )}
        </div>
      )}
    </>
  )
}
