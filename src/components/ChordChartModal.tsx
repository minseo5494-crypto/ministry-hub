'use client'

// src/components/ChordChartModal.tsx
//
// 곡의 악보를 코드악보로 변환하는 모달.
// - 열 때 저장된 코드악보가 있으면 불러와 표시(재생성 스킵)
// - "생성" → 추출 라우트 → 마디 그리드 렌더 → "저장"(song_chord_charts)
// 저장된 코드악보는 연주 모드(송폼 클릭+하이라이트)에서 마디 수 소스로 재사용된다.

import { useState, useEffect } from 'react'
import { X, Sparkles, Loader2, RefreshCw, Save, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ChordChart } from '@/types/chordChart'
import ChordChartView from '@/components/ChordChartView'
import ChordChartPlayer from '@/components/ChordChartPlayer'

interface ChordChartSong {
  id: string
  song_name?: string
  file_url?: string
  bpm?: number
  time_signature?: string
}

interface ChordChartModalProps {
  isOpen: boolean
  onClose: () => void
  song: ChordChartSong
  /** 선택된 송폼(진행 순서). 연주 모드에서 클릭 구성에 사용 */
  form?: string[]
}

export default function ChordChartModal({ isOpen, onClose, song, form = [] }: ChordChartModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [chart, setChart] = useState<ChordChart | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'chart' | 'play'>('chart')

  // 열 때 저장된 코드악보 불러오기
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoadingExisting(true)
    setError(null)
    supabase
      .from('song_chord_charts')
      .select('data')
      .eq('song_id', song.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.data) {
          setChart(data.data as ChordChart)
          setSaved(true)
        } else {
          setChart(null)
          setSaved(false)
        }
        setLoadingExisting(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, song.id])

  if (!isOpen) return null

  const extract = async () => {
    setLoading(true)
    setError(null)
    setSaved(false)
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

  const save = async () => {
    if (!chart) return
    setSaving(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        return
      }
      const { error: e } = await supabase.from('song_chord_charts').upsert(
        {
          song_id: song.id,
          data: chart,
          status: 'confirmed',
          generated_by: 'ai',
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'song_id' }
      )
      if (e) {
        setError('저장 실패: ' + e.message)
        return
      }
      setSaved(true)
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
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
              <>
                <button
                  onClick={save}
                  disabled={saving || saved}
                  className={`inline-flex items-center gap-1.5 px-3 h-11 rounded-lg text-sm font-bold ${
                    saved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  } disabled:opacity-70`}
                  title={saved ? '저장됨' : '저장'}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saved ? '저장됨' : '저장'}
                </button>
                <button
                  onClick={extract}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  style={{ minWidth: 44, minHeight: 44 }}
                  title="다시 생성"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </>
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
          {/* 저장본 불러오는 중 */}
          {loadingExisting && !chart && (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
            </div>
          )}

          {/* 초기: 생성 버튼 */}
          {!loadingExisting && !chart && !loading && (
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

          {/* 생성 중 */}
          {loading && (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">AI가 악보를 분석하고 있습니다…</p>
              <p className="text-xs text-gray-400 mt-1">수십 초 걸릴 수 있어요</p>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="text-center py-4">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              {!chart && (
                <button
                  onClick={extract}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                >
                  <RefreshCw className="w-4 h-4" /> 다시 시도
                </button>
              )}
            </div>
          )}

          {/* 결과 */}
          {chart && !loading && (
            <>
              {/* 코드악보 / 연주 모드 토글 */}
              <div className="inline-flex p-0.5 mb-3 bg-gray-100 rounded-lg text-sm font-medium">
                {(['chart', 'play'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 rounded-md ${
                      mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {m === 'chart' ? '코드악보' : '▶ 연주 모드'}
                  </button>
                ))}
              </div>

              {mode === 'play' ? (
                <ChordChartPlayer
                  chart={chart}
                  form={form}
                  bpm={song.bpm}
                  timeSignature={song.time_signature}
                />
              ) : (
                <ChordChartView chart={chart} />
              )}

              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                ※ AI 추출 결과라 오류가 있을 수 있습니다. 저장하면 연주 모드(송폼 클릭)에서 재사용됩니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
