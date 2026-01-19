'use client'

import {
  Eye, EyeOff, Pencil, Youtube, Shield, UserPlus,
  FileText, Presentation, Heart
} from 'lucide-react'
import ResponsiveImage from '@/components/ResponsiveImage'
import { Song } from '../types'

type SongListItemProps = {
  song: Song
  index: number
  isSelected: boolean
  isFocused: boolean
  previewState: boolean
  youtubeState: boolean
  likedSongs: Set<string>
  songForms: { [songId: string]: string[] }
  showFilterPanel: boolean
  onSelect: () => void
  onFocus: () => void
  onTogglePreview: () => void
  onToggleYoutube: () => void
  onToggleLike: (e: React.MouseEvent) => void
  onOpenFormModal: () => void
  onOpenSheetViewer: () => void
  onOpenLyricsModal: () => void
  onDoubleClick: () => void
  onDoubleTap: () => void
  getYoutubeEmbedUrl: (url: string) => string | null
}

export default function SongListItem({
  song,
  index,
  isSelected,
  isFocused,
  previewState,
  youtubeState,
  likedSongs,
  songForms,
  showFilterPanel,
  onSelect,
  onFocus,
  onTogglePreview,
  onToggleYoutube,
  onToggleLike,
  onOpenFormModal,
  onOpenSheetViewer,
  onOpenLyricsModal,
  onDoubleClick,
  onDoubleTap,
  getYoutubeEmbedUrl
}: SongListItemProps) {
  return (
    <div
      tabIndex={0}
      onFocus={onFocus}
      className={`p-3 sm:p-4 cursor-pointer transition-all ${isSelected
        ? 'bg-blue-50'
        : isFocused
          ? 'bg-gray-50'
          : 'hover:bg-gray-50'
        }`}
    >
      {/* 상단: 곡 정보 + 버튼 */}
      <div
        className={`flex flex-col ${showFilterPanel ? 'lg:flex-row lg:items-start lg:justify-between' : 'sm:flex-row sm:items-start sm:justify-between'}`}
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="mr-3 flex-shrink-0 mt-1 w-4 h-4 cursor-pointer"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">{song.song_name}</h3>
                {song.is_official ? (
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center" title="공식 악보">
                    <Shield size={12} />
                  </span>
                ) : song.is_user_uploaded && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full flex items-center gap-0.5" title="사용자 추가">
                    <UserPlus size={10} />
                  </span>
                )}
                {songForms[song.id] && songForms[song.id].length > 0 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded flex-shrink-0">
                    송폼: {songForms[song.id].join('-')}
                  </span>
                )}
              </div>
              {song.team_name && (
                <p className="text-sm text-gray-600 mt-1">{song.team_name}</p>
              )}
              <p className="text-sm text-gray-500 mt-0.5">
                Key: {song.key || '-'} | 박자: {song.time_signature || '-'} | 템포: {song.bpm ? `${song.bpm}BPM` : (song.tempo || '-')}
              </p>

              {/* 테마 태그 */}
              <div className="flex flex-wrap gap-1 mt-2">
                {song.theme1 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                    {song.theme1}
                  </span>
                )}
                {song.theme2 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                    {song.theme2}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 버튼들 */}
        <div className={`flex gap-1 md:gap-2 mt-1 flex-shrink-0 ml-7 ${showFilterPanel ? 'lg:mt-0 lg:ml-4' : 'sm:mt-0 sm:ml-4'}`}>
          {/* 송폼 설정 버튼 */}
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenFormModal()
              }}
              className="px-2 md:px-3 py-1 bg-[#C4BEE2] text-white text-xs md:text-sm rounded hover:bg-[#B0A8D8] whitespace-nowrap"
            >
              송폼
            </button>
          )}

          {/* 미리보기 토글 버튼 */}
          {(song.lyrics || song.file_url) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePreview()
              }}
              className={`p-2 rounded-lg ${previewState
                ? 'text-sky-600 bg-sky-100'
                : 'text-sky-500 hover:bg-sky-100'
                }`}
              title={previewState ? '접기' : '펼치기'}
            >
              {previewState ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}

          {/* 악보 에디터 */}
          {song.file_url && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenSheetViewer()
              }}
              className="p-2 text-indigo-500 hover:bg-indigo-100 rounded-lg"
              title="악보 에디터"
            >
              <Presentation size={18} />
            </button>
          )}

          {/* 가사 보기 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (song.lyrics) {
                onOpenLyricsModal()
              }
            }}
            disabled={!song.lyrics}
            className="p-1.5 md:p-2 rounded-lg transition-colors"
            style={{
              color: song.lyrics ? '#16a34a' : '#d1d5db',
              cursor: song.lyrics ? 'pointer' : 'not-allowed',
              opacity: song.lyrics ? 1 : 0.5
            }}
            title={song.lyrics ? '가사 보기' : '가사 없음'}
          >
            <FileText size={16} className="md:w-[18px] md:h-[18px]" />
          </button>

          {/* 유튜브 영상 토글 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (song.youtube_url) {
                onToggleYoutube()
              }
            }}
            disabled={!song.youtube_url}
            className="p-2 rounded-lg"
            style={{
              color: !song.youtube_url
                ? '#d1d5db'
                : youtubeState
                  ? '#dc2626'
                  : '#dc2626',
              backgroundColor: !song.youtube_url
                ? 'transparent'
                : youtubeState
                  ? '#fee2e2'
                  : 'transparent',
              cursor: song.youtube_url ? 'pointer' : 'not-allowed',
              opacity: song.youtube_url ? 1 : 0.5
            }}
            title={
              !song.youtube_url
                ? '유튜브 링크 없음'
                : youtubeState
                  ? '유튜브 닫기'
                  : '유튜브 열기'
            }
          >
            <Youtube size={18} />
          </button>

          {/* 좋아요 버튼 */}
          <button
            onClick={onToggleLike}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${likedSongs.has(song.id)
              ? 'text-red-500 bg-red-50'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
            title={likedSongs.has(song.id) ? '좋아요 취소' : '좋아요'}
          >
            <Heart size={18} fill={likedSongs.has(song.id) ? 'currentColor' : 'none'} />
            {((song as any).like_count || 0) > 0 && (
              <span className="text-xs">{(song as any).like_count}</span>
            )}
          </button>
        </div>
      </div>

      {/* 유튜브 콘텐츠 */}
      {youtubeState && song.youtube_url && (
        <div className="mt-4 ml-7">
          {getYoutubeEmbedUrl(song.youtube_url) ? (
            <div className="relative w-full max-w-2xl" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={getYoutubeEmbedUrl(song.youtube_url) || ''}
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500">유효하지 않은 유튜브 링크입니다.</p>
          )}
        </div>
      )}

      {/* 악보/가사 콘텐츠 */}
      {previewState && (
        <div className="mt-4 border-t pt-4">
          {song.lyrics && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">가사</h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                {song.lyrics}
              </pre>
            </div>
          )}
          {song.file_url && (
            <div className="w-full">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">악보 <span className="text-xs text-gray-400">(더블탭하여 전체화면)</span></h4>
              {song.file_type === 'pdf' ? (
                <div
                  className="relative w-full h-[80vh] sm:h-[600px] cursor-pointer"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onDoubleClick()
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation()
                    onDoubleTap()
                  }}
                >
                  <iframe
                    src={`${song.file_url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                    className="w-full h-full border sm:rounded pointer-events-none"
                  />
                  <div className="absolute inset-0" />
                </div>
              ) : (
                <ResponsiveImage
                  src={song.file_url}
                  alt={`${song.song_name} 악보`}
                  className="rounded shadow-sm cursor-pointer"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onDoubleClick()
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation()
                    onDoubleTap()
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
