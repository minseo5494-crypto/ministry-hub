'use client'

// src/components/ChordChartPanel.tsx
//
// 코드악보 패널(불러오기/생성/저장 + 코드악보·연주모드 토글).
// ChordChartModal(껍데기)와 SheetMusicEditor 탭 양쪽에서 재사용한다.

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, RefreshCw, Save, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ChordChart } from '@/types/chordChart'
import ChordChartView from '@/components/ChordChartView'
import ChordChartPlayer from '@/components/ChordChartPlayer'
import ChordChartGridEditor from '@/components/ChordChartGridEditor'

export interface ChordChartPanelSong {
  id: string
  song_name?: string
  file_url?: string
  bpm?: number
  time_signature?: string
}

export default function ChordChartPanel({
  song,
  form = [],
}: {
  song: ChordChartPanelSong
  form?: string[]
}) {
  const [loading, setLoading] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [chart, setChart] = useState<ChordChart | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'chart' | 'edit' | 'play'>('chart')
  // 코드악보가 새로 로드/생성될 때 편집기 remount 용 버전(편집 중 커서 유지 위해 편집엔 안 바뀜)
  const [chartVersion, setChartVersion] = useState(0)

  // 저장된 코드악보 불러오기
  useEffect(() => {
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
          setChartVersion((v) => v + 1)
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
  }, [song.id])

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
      setChartVersion((v) => v + 1)
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

  if (loadingExisting && !chart) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600 font-medium">AI가 악보를 분석하고 있습니다…</p>
        <p className="text-xs text-gray-400 mt-1">수십 초 걸릴 수 있어요</p>
      </div>
    )
  }

  // 차트 유무에 따라 탭 구성(차트 없으면 편집 제외, 연주는 클릭만)
  const modes = chart ? (['chart', 'edit', 'play'] as const) : (['chart', 'play'] as const)
  const effectiveMode = !chart && mode === 'edit' ? 'chart' : mode

  return (
    <div>
      {/* 액션 바: 탭 + 저장/다시생성 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="inline-flex p-0.5 bg-gray-100 rounded-lg text-sm font-medium">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md ${
                effectiveMode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              {m === 'chart' ? '코드악보' : m === 'edit' ? '편집' : '▶ 연주 모드'}
            </button>
          ))}
        </div>

        {chart && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={save}
              disabled={saving || saved}
              className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-bold ${
                saved ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              } disabled:opacity-70`}
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
            <button onClick={extract} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="다시 생성">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

      {effectiveMode === 'play' ? (
        <ChordChartPlayer chart={chart} form={form} bpm={song.bpm} timeSignature={song.time_signature} />
      ) : effectiveMode === 'edit' && chart ? (
        <ChordChartGridEditor
          key={chartVersion}
          chart={chart}
          onChange={(c) => {
            setChart(c)
            setSaved(false)
          }}
        />
      ) : chart ? (
        <ChordChartView chart={chart} />
      ) : (
        /* 코드악보 없음 → 생성 안내 */
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

      {chart && (
        <p className="text-xs text-gray-400 mt-4 leading-relaxed">
          ※ AI 추출 결과라 오류가 있을 수 있습니다. 저장하면 연주 모드(송폼 클릭)에서 재사용됩니다.
        </p>
      )}
    </div>
  )
}
