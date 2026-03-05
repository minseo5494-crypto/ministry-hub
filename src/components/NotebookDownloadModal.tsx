'use client'

import { useState, useEffect } from 'react'
import { X, Download, CheckSquare, Square, Music, Image } from 'lucide-react'

interface PageInfo {
  pageType: string
  songName?: string
  uploadFileName?: string
  order: number
}

interface NotebookDownloadModalProps {
  isOpen: boolean
  onClose: () => void
  pages: PageInfo[]
  notebookTitle: string
  onDownload: (selectedIndices: number[], fileName: string) => void
  isDownloading?: boolean
}

type DownloadMode = 'all' | 'select'

function getPageLabel(page: PageInfo): string {
  switch (page.pageType) {
    case 'blank':  return '빈 페이지'
    case 'staff':  return '오선지'
    case 'upload': return page.uploadFileName ? `업로드: ${page.uploadFileName}` : '업로드'
    default:       return page.songName || '악보'
  }
}

function PageIcon({ pageType }: { pageType: string }) {
  if (pageType === 'staff') {
    return (
      <div className="w-5 h-5 rounded bg-white border border-slate-300 flex flex-col justify-around px-0.5 py-0.5 shrink-0">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-px bg-slate-400" />
        ))}
      </div>
    )
  }
  if (pageType === 'blank') {
    return <div className="w-5 h-5 rounded bg-slate-100 border border-slate-300 shrink-0" />
  }
  if (pageType === 'upload') {
    return <Image className="w-5 h-5 text-slate-400 shrink-0" />
  }
  return <Music className="w-5 h-5 text-indigo-400 shrink-0" />
}

export default function NotebookDownloadModal({
  isOpen,
  onClose,
  pages,
  notebookTitle,
  onDownload,
  isDownloading = false,
}: NotebookDownloadModalProps) {
  const today = new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\./g, '').replace(' ', '')
  const [mode, setMode] = useState<DownloadMode>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [fileName, setFileName] = useState(`${notebookTitle}_${today}`)

  useEffect(() => {
    if (isOpen) {
      setMode('all')
      setSelected(new Set(pages.map((_, i) => i)))
      setFileName(`${notebookTitle}_${today}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const togglePage = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === pages.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pages.map((_, i) => i)))
    }
  }

  const handleDownload = () => {
    if (isDownloading) return
    const name = fileName.trim() || `${notebookTitle}_${today}`
    const indices = mode === 'all'
      ? pages.map((_, i) => i)
      : Array.from(selected).sort((a, b) => a - b)
    if (indices.length === 0) return
    onDownload(indices, name)
  }

  const selectedCount = mode === 'all' ? pages.length : selected.size
  const canDownload = !isDownloading && selectedCount > 0

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50"
      style={{ touchAction: 'manipulation' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isDownloading) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-slate-900">노트 다운로드</h2>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-40"
            style={{ minHeight: '44px', minWidth: '44px', touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* 범위 선택 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">범위 선택</p>
            <div className="space-y-2">
              {(['all', 'select'] as DownloadMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                    mode === m
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={{ minHeight: '44px', touchAction: 'manipulation' }}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    mode === m ? 'border-indigo-500' : 'border-slate-300'
                  }`}>
                    {mode === m && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </div>
                  <span className="text-sm font-medium">
                    {m === 'all' ? '전체 다운로드' : '선택 다운로드'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 페이지 목록 (선택 모드) */}
          {mode === 'select' && (
            <div>
              <button
                onClick={toggleAll}
                className="w-full flex items-center gap-3 px-3 py-2 mb-1 rounded-xl hover:bg-slate-50 transition-colors text-left"
                style={{ minHeight: '44px', touchAction: 'manipulation' }}
              >
                {selected.size === pages.length
                  ? <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" />
                  : <Square className="w-5 h-5 text-slate-300 shrink-0" />
                }
                <span className="text-sm font-semibold text-slate-700">전체 선택</span>
                <span className="ml-auto text-xs text-slate-400">{selected.size}/{pages.length}</span>
              </button>
              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                {pages.map((page, i) => {
                  const isChecked = selected.has(i)
                  return (
                    <button
                      key={i}
                      onClick={() => togglePage(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                        isChecked ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'
                      }`}
                      style={{ minHeight: '44px', touchAction: 'manipulation' }}
                    >
                      {isChecked
                        ? <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" />
                        : <Square className="w-5 h-5 text-slate-300 shrink-0" />
                      }
                      <PageIcon pageType={page.pageType} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{getPageLabel(page)}</p>
                        <p className="text-xs text-slate-400">{page.order + 1}페이지</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 파일명 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">파일명</p>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={isDownloading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition disabled:opacity-50"
              style={{ fontSize: '16px' }}
              placeholder="파일명 입력"
            />
          </div>

          {/* 다운로드 버튼 */}
          <button
            onClick={handleDownload}
            disabled={!canDownload}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20"
            style={{ minHeight: '44px', touchAction: 'manipulation' }}
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                다운로드 중...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {selectedCount > 0 ? `${selectedCount}페이지 다운로드` : '다운로드'}
              </>
            )}
          </button>

          {/* 취소 */}
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="w-full py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-40"
            style={{ minHeight: '44px', touchAction: 'manipulation' }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
