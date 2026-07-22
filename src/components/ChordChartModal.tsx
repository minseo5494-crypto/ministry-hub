'use client'

// src/components/ChordChartModal.tsx
//
// 곡의 악보를 코드악보로 변환하는 모달. "생성" → 추출 라우트 호출 → 마디 그리드 렌더.
// MVP: 추출 + 렌더(검증용). 교정 편집/저장은 후속.

import { useState } from 'react'
import { X, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ChordChart } from '@/types/chordChart'
import ChordChartView from '@/components/ChordChartView'

interface ChordChartSong {
  id: string
  song_name?: string
  file_url?: string
}

interface ChordChartModalProps {
  isOpen: boolean
  onClose: () => void
  song: ChordChartSong
}

export default function ChordChartModal({ isOpen, onClose, song }: ChordChartModalProps) {
  const [loading, setLoading] = useState(false)
  const [chart, setChart] = useState<ChordChart | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const extract = async () => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError('로그인이 필요합니다.')
        return
      }
      const res = await fetch('/api/chord-chart/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ songId: song.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error || '변환에 실패했습니다.')
        return
      }
      setChart(json.chart as ChordChart)
    } catch {
      setError('변환 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ touchAction: 'manipulation' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900">🎼 코드악보 변환</h3>
            {song.song_name && (
              <p className="text-sm text-gray-500 truncate max-w-[24rem]">{song.song_name}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {chart && !loading && (
              <button
                onClick={extract}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                style={{ minWidth: 44, minHeight: 44 }}
                title="다시 생성"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* 초기: 생성 버튼 */}
          {!chart && !loading && (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🎼</div>
              <p className="text-gray-600 mb-1 font-medium">악보를 코드악보로 변환합니다</p>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                오선·음표를 걷어내고 마디별 코드와 가사만 남긴 간소화 악보를 AI가 생성합니다.
                <br />
                (수십 초 소요될 수 있습니다)
              </p>
              {!song.file_url ? (
                <p className="text-sm text-red-500">이 곡에는 변환할 악보 파일이 없습니다.</p>
              ) : (
                <button
                  onClick={extract}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                  style={{ minHeight: 44 }}
                >
                  <Sparkles className="w-5 h-5" /> 코드악보 생성
                </button>
              )}
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">AI가 악보를 분석하고 있습니다…</p>
              <p className="text-xs text-gray-400 mt-1">수십 초 걸릴 수 있어요</p>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="text-center py-6">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <button
                onClick={extract}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
              >
                <RefreshCw className="w-4 h-4" /> 다시 시도
              </button>
            </div>
          )}

          {/* 결과 */}
          {chart && !loading && (
            <>
              <ChordChartView chart={chart} />
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                ※ AI 추출 결과라 오류가 있을 수 있습니다. (교정 편집·저장 기능은 준비 중)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
