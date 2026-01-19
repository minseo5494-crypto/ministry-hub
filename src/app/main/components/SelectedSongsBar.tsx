'use client'

import { useRouter } from 'next/navigation'
import { FolderOpen, FileText, Presentation } from 'lucide-react'
import { Song, User } from '../types'

type SelectedSongsBarProps = {
  user: User | null
  selectedSongs: Song[]
  isMobile: boolean
  showFilterPanel: boolean
  downloadingPDF: boolean
  downloadingPPT: boolean
  handleDownload: () => void
  startPPTDownload: () => void
  setShowSaveModal: (show: boolean) => void
  setSelectedSongs: (songs: Song[]) => void
  setSongForms: (forms: { [songId: string]: string[] }) => void
}

export default function SelectedSongsBar({
  user,
  selectedSongs,
  isMobile,
  showFilterPanel,
  downloadingPDF,
  downloadingPPT,
  handleDownload,
  startPPTDownload,
  setShowSaveModal,
  setSelectedSongs,
  setSongForms
}: SelectedSongsBarProps) {
  const router = useRouter()

  if (selectedSongs.length === 0 || (isMobile && showFilterPanel)) {
    return null
  }

  return (
    <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
              {selectedSongs.length}곡 선택됨
            </span>
            <div className="flex gap-1 sm:gap-2 overflow-x-auto">
              {selectedSongs.slice(0, 3).map(song => (
                <span key={song.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  {song.song_name}
                </span>
              ))}
              {selectedSongs.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                  +{selectedSongs.length - 3}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (!user) {
                  alert('콘티 저장은 로그인 후 이용 가능합니다.')
                  router.push('/login')
                  return
                }
                setShowSaveModal(true)
              }}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] text-xs sm:text-sm flex items-center justify-center whitespace-nowrap"
            >
              <FolderOpen className="mr-1 sm:mr-2" size={14} />
              콘티 저장
            </button>
            <button
              onClick={handleDownload}
              disabled={downloadingPDF}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] text-xs sm:text-sm flex items-center justify-center whitespace-nowrap ${downloadingPDF ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {downloadingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
                  <span className="hidden sm:inline">PDF 생성 중...</span>
                  <span className="sm:hidden">생성중</span>
                </>
              ) : (
                <>
                  <FileText className="mr-1 sm:mr-2" size={14} />
                  다운로드
                </>
              )}
            </button>
            <button
              onClick={startPPTDownload}
              disabled={downloadingPPT}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xs sm:text-sm flex items-center justify-center whitespace-nowrap ${downloadingPPT ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {downloadingPPT ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
                  <span className="hidden sm:inline">PPT 생성 중...</span>
                  <span className="sm:hidden">생성중</span>
                </>
              ) : (
                <>
                  <Presentation className="mr-1 sm:mr-2" size={14} />
                  PPT
                </>
              )}
            </button>
            <button
              onClick={() => {
                setSelectedSongs([])
                setSongForms({})
              }}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm whitespace-nowrap"
            >
              초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
