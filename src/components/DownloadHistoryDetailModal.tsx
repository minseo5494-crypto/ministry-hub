'use client'

import { useState, useCallback } from 'react'
import { X, Download, Trash2, Plus } from 'lucide-react'
import type { DownloadHistory, DownloadSong } from '@/types/downloadHistory'
import { generatePDF } from '@/lib/pdfGenerator'
import DownloadLoadingModal from '@/components/DownloadLoadingModal'
import type { DownloadProgress } from '@/components/DownloadLoadingModal'

// 송폼 섹션 약어 목록 (기존 SECTION_ABBREVIATIONS 참고)
const FORM_TAGS = ['I', 'V', 'V1', 'V2', 'V3', 'PC', 'C', 'C1', 'C2', 'B', '간주', 'Out']

interface Props {
  history: DownloadHistory
  onClose: () => void
}

export default function DownloadHistoryDetailModal({ history, onClose }: Props) {
  // 각 곡의 송폼을 로컬 상태로 관리 (DB 저장 X, 다운로드 시에만 사용)
  const [songForms, setSongForms] = useState<{ [songId: string]: string[] }>(
    () => Object.fromEntries(history.songs.map(s => [s.song_id, [...s.songForms]]))
  )
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)

  const removeTag = useCallback((songId: string, index: number) => {
    setSongForms(prev => ({
      ...prev,
      [songId]: prev[songId].filter((_, i) => i !== index),
    }))
  }, [])

  const addTag = useCallback((songId: string, tag: string) => {
    setSongForms(prev => ({
      ...prev,
      [songId]: [...(prev[songId] || []), tag],
    }))
    setAddingTagFor(null)
  }, [])

  const handleRedownload = useCallback(async () => {
    if (history.format !== 'pdf') {
      alert('재다운로드는 PDF 형식만 지원합니다.')
      return
    }

    setDownloading(true)
    setDownloadProgress(null)

    try {
      const pdfSongs = history.songs.map((s: DownloadSong) => ({
        id: s.song_id,
        song_name: s.song_name,
        team_name: s.team_name,
        file_url: s.file_url,
        file_type: s.file_type,
        selectedForm: songForms[s.song_id] || [],
      }))

      const songFormsMap: { [key: string]: string[] } = {}
      history.songs.forEach((s: DownloadSong) => {
        songFormsMap[s.song_id] = songForms[s.song_id] || []
      })

      await generatePDF({
        title: history.title,
        date: new Date(history.created_at).toLocaleDateString('ko-KR'),
        songs: pdfSongs,
        songForms: songFormsMap,
        includeCover: history.options?.includeCover ?? true,
        marginPercent: history.options?.marginPercent ?? 0,
        customFileName: history.options?.customFileName,
        onProgress: (current, total, songName) => {
          setDownloadProgress({ current, total, songName })
        },
      })
    } catch (err) {
      console.error('재다운로드 실패:', err)
      alert('다운로드 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setDownloading(false)
      setDownloadProgress(null)
    }
  }, [history, songForms])

  const formatBadgeColor: Record<string, string> = {
    pdf: 'bg-red-50 text-red-600',
    ppt: 'bg-orange-50 text-orange-600',
    image: 'bg-blue-50 text-blue-600',
  }

  const dateStr = new Date(history.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        {/* 모달 패널 */}
        <div
          className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase flex-shrink-0 ${formatBadgeColor[history.format] ?? 'bg-slate-100 text-slate-600'}`}>
                {history.format}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">{history.title}</h2>
                <p className="text-xs text-slate-400">{dateStr}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg flex-shrink-0 transition-colors"
              style={{ touchAction: 'manipulation' }}
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 곡 목록 */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {history.songs.map((song: DownloadSong) => (
              <div key={song.song_id} className="px-5 py-4">
                {/* 곡 정보 */}
                <div className="mb-2">
                  <p className="font-semibold text-slate-900 text-sm">{song.song_name}</p>
                  {song.team_name && (
                    <p className="text-xs text-slate-400">{song.team_name}</p>
                  )}
                </div>

                {/* 송폼 태그 */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(songForms[song.song_id] || []).map((tag, i) => (
                    <button
                      key={i}
                      onClick={() => removeTag(song.song_id, i)}
                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md hover:bg-red-50 hover:text-red-600 transition-colors group"
                      style={{ touchAction: 'manipulation', minHeight: '28px' }}
                      aria-label={`${tag} 삭제`}
                    >
                      {tag}
                      <Trash2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}

                  {/* 태그 추가 */}
                  {addingTagFor === song.song_id ? (
                    <div className="flex flex-wrap gap-1">
                      {FORM_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => addTag(song.song_id, tag)}
                          className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                          style={{ touchAction: 'manipulation', minHeight: '28px' }}
                        >
                          {tag}
                        </button>
                      ))}
                      <button
                        onClick={() => setAddingTagFor(null)}
                        className="px-2 py-1 bg-slate-100 text-slate-400 text-xs rounded-md hover:bg-slate-200 transition-colors"
                        style={{ touchAction: 'manipulation', minHeight: '28px' }}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTagFor(song.song_id)}
                      className="inline-flex items-center gap-0.5 px-2 py-1 border border-dashed border-slate-300 text-slate-400 text-xs rounded-md hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                      style={{ touchAction: 'manipulation', minHeight: '28px' }}
                    >
                      <Plus className="w-3 h-3" />
                      추가
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 다운로드 옵션 표시 (있는 경우) */}
          {history.options && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 text-xs text-slate-500">
              {history.options.includeCover !== undefined && (
                <span>커버 {history.options.includeCover ? '포함' : '미포함'}</span>
              )}
              {history.options.includeSongForm !== undefined && (
                <span>송폼 {history.options.includeSongForm ? '포함' : '미포함'}</span>
              )}
              {history.options.marginPercent !== undefined && history.options.marginPercent > 0 && (
                <span>여백 {history.options.marginPercent}%</span>
              )}
              {history.options.customFileName && (
                <span>파일명: {history.options.customFileName}</span>
              )}
            </div>
          )}

          {/* 푸터 버튼 */}
          <div className="px-5 py-4 border-t border-slate-100">
            <button
              onClick={handleRedownload}
              disabled={downloading || history.format !== 'pdf'}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              <Download className="w-4 h-4" />
              {history.format !== 'pdf'
                ? 'PDF만 재다운로드 지원'
                : downloading
                  ? '다운로드 중...'
                  : '같은 설정으로 다운로드'}
            </button>
          </div>
        </div>
      </div>

      {/* 다운로드 로딩 모달 */}
      <DownloadLoadingModal
        isOpen={downloading}
        type="pdf"
        progress={downloadProgress ?? undefined}
      />
    </>
  )
}
