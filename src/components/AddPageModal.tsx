'use client'

import { useState, useRef } from 'react'
import { X, FileText, Music, Image } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Position = 'before' | 'after' | 'last'

interface AddPage {
  type: 'blank' | 'staff' | 'sheet' | 'upload'
  songId?: string
  fileUrl?: string
  fileType?: 'pdf' | 'image'
  songName?: string
  uploadUrl?: string
  uploadFileName?: string
}

interface SongResult {
  id: string
  song_name: string
  team_name?: string
  file_url?: string
  file_type?: string
}

interface AddPageModalProps {
  isOpen: boolean
  onClose: () => void
  currentPageIndex: number
  userId?: string
  notebookId?: string
  onAddPage: (position: Position, page: AddPage) => void
}

export default function AddPageModal({
  isOpen,
  onClose,
  currentPageIndex,
  userId,
  notebookId,
  onAddPage,
}: AddPageModalProps) {
  const [position, setPosition] = useState<Position>('after')
  const [showSongSearch, setShowSongSearch] = useState(false)
  const [songSearchText, setSongSearchText] = useState('')
  const [songResults, setSongResults] = useState<SongResult[]>([])
  const [songSearching, setSongSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const POSITIONS: { value: Position; label: string }[] = [
    { value: 'before', label: '전' },
    { value: 'after', label: '후' },
    { value: 'last', label: '마지막' },
  ]

  const handleTemplateSelect = (type: 'blank' | 'staff') => {
    onAddPage(position, { type })
    onClose()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // MIME 타입 검증
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      alert('이미지(JPG, PNG, WebP) 또는 PDF 파일만 업로드할 수 있습니다.')
      return
    }
    // 크기 제한 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const uid = userId || 'anonymous'
      const nbId = notebookId || 'temp'
      const path = `notebooks/${uid}/${nbId}/${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabase.storage
        .from('sheetmusic')
        .upload(path, file, { upsert: false })

      if (error) {
        console.error('업로드 실패:', error.message)
        alert('업로드에 실패했습니다.')
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('sheetmusic')
        .getPublicUrl(data.path)

      onAddPage(position, {
        type: 'upload',
        uploadUrl: publicUrl,
        uploadFileName: file.name,
        fileType: file.type === 'application/pdf' ? 'pdf' : 'image',
      })
      onClose()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSongSearch = async (text: string) => {
    setSongSearchText(text)
    if (!text.trim()) {
      setSongResults([])
      return
    }
    setSongSearching(true)
    try {
      const { data } = await supabase
        .from('songs')
        .select('id, song_name, team_name, file_url, file_type')
        .ilike('song_name', `%${text.trim()}%`)
        .limit(20)
      setSongResults((data as SongResult[]) || [])
    } finally {
      setSongSearching(false)
    }
  }

  const handleSongSelect = (song: SongResult) => {
    if (!song.file_url) {
      alert('이 악보는 파일이 없습니다.')
      return
    }
    onAddPage(position, {
      type: 'sheet',
      songId: song.id,
      fileUrl: song.file_url,
      fileType: (song.file_type as 'pdf' | 'image') || 'image',
      songName: song.song_name,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50"
      style={{ touchAction: 'manipulation' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-slate-900">페이지 추가</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            style={{ minHeight: '44px', minWidth: '44px', touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-5">
          {/* 위치 선택 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">위치</p>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPosition(p.value)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    position === p.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={{ minHeight: '44px', touchAction: 'manipulation' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 템플릿 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">템플릿</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTemplateSelect('blank')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                style={{ minHeight: '80px', touchAction: 'manipulation' }}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200" />
                <span className="text-sm font-medium text-slate-700">백지</span>
              </button>
              <button
                onClick={() => handleTemplateSelect('staff')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                style={{ minHeight: '80px', touchAction: 'manipulation' }}
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex flex-col justify-around px-1 py-1.5">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="h-px bg-slate-400" />
                  ))}
                </div>
                <span className="text-sm font-medium text-slate-700">오선지</span>
              </button>
            </div>
          </div>

          {/* 가져오기 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">가져오기</p>
            <div className="space-y-2">
              {/* 이미지 업로드 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 text-left"
                style={{ minHeight: '44px', touchAction: 'manipulation' }}
              >
                <Image className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {uploading ? '업로드 중...' : '이미지 업로드'}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* 악보 불러오기 */}
              {!showSongSearch ? (
                <button
                  onClick={() => setShowSongSearch(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
                  style={{ minHeight: '44px', touchAction: 'manipulation' }}
                >
                  <Music className="w-5 h-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">악보 불러오기</span>
                </button>
              ) : (
                <div className="rounded-xl border border-indigo-200 overflow-hidden">
                  <input
                    type="text"
                    value={songSearchText}
                    onChange={(e) => handleSongSearch(e.target.value)}
                    placeholder="곡명 검색..."
                    className="w-full px-4 py-3 text-sm outline-none"
                    style={{ fontSize: '16px' }}
                    autoFocus
                  />
                  {songSearching && (
                    <p className="px-4 py-2 text-xs text-slate-400">검색 중...</p>
                  )}
                  {songResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                      {songResults.map((song) => (
                        <button
                          key={song.id}
                          onClick={() => handleSongSelect(song)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left"
                          style={{ minHeight: '44px', touchAction: 'manipulation' }}
                        >
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{song.song_name}</p>
                            {song.team_name && (
                              <p className="text-xs text-slate-400 truncate">{song.team_name}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!songSearching && songSearchText && songResults.length === 0 && (
                    <p className="px-4 py-2 text-xs text-slate-400">검색 결과가 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 취소 */}
          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
            style={{ minHeight: '44px', touchAction: 'manipulation' }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
