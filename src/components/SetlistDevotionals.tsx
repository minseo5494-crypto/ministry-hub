'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BookOpen, Send, Trash2 } from 'lucide-react'

interface Devotional {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string | null
  user_email: string
}

interface SetlistDevotionalsProps {
  setlistId: string
  teamId: string
  currentUserId: string
}

function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function getInitial(name: string | null, email: string): string {
  if (name && name.length > 0) return name.charAt(0)
  return email.charAt(0).toUpperCase()
}

export default function SetlistDevotionals({ setlistId, teamId, currentUserId }: SetlistDevotionalsProps) {
  const [devotionals, setDevotionals] = useState<Devotional[]>([])
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchDevotionals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('setlist_devotionals')
        .select('id, content, created_at, user_id')
        .eq('setlist_id', setlistId)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        setDevotionals([])
        return
      }

      // user 정보 조회
      const userIds = [...new Set(data.map(d => d.user_id))]
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)

      const userMap = new Map(
        (users || []).map(u => [u.id, { name: u.name, email: u.email }])
      )

      setDevotionals(
        data.map(d => ({
          ...d,
          user_name: userMap.get(d.user_id)?.name || null,
          user_email: userMap.get(d.user_id)?.email || '',
        }))
      )
    } catch (err) {
      console.error('묵상 조회 실패:', err)
    } finally {
      setLoading(false)
    }
  }, [setlistId])

  useEffect(() => {
    fetchDevotionals()
  }, [fetchDevotionals])

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('setlist_devotionals')
        .insert({
          setlist_id: setlistId,
          team_id: teamId,
          user_id: currentUserId,
          content: content.trim(),
        })

      if (error) throw error

      setContent('')
      await fetchDevotionals()
    } catch (err) {
      console.error('묵상 작성 실패:', err)
      alert('묵상 작성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 묵상을 삭제하시겠습니까?')) return

    // Optimistic UI
    setDevotionals(prev => prev.filter(d => d.id !== id))

    try {
      const { error } = await supabase
        .from('setlist_devotionals')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (err) {
      console.error('묵상 삭제 실패:', err)
      alert('삭제에 실패했습니다.')
      await fetchDevotionals()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter로 전송
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <section className="mt-8 mb-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={20} className="text-indigo-600" />
        <h2 className="text-lg font-bold text-gray-900">묵상 나눔</h2>
        {devotionals.length > 0 && (
          <span className="text-sm text-gray-500">({devotionals.length})</span>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="이번 콘티를 통해 받은 묵상이나 나눔을 적어주세요..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-[16px]"
          style={{ fontSize: '16px', touchAction: 'manipulation' }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">Ctrl+Enter로 전송</span>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[44px]"
            style={{ touchAction: 'manipulation' }}
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
            <span className="text-sm font-medium">나누기</span>
          </button>
        </div>
      </div>

      {/* 묵상 목록 */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : devotionals.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">아직 나눔이 없습니다.</p>
          <p className="text-xs mt-1">이번 콘티를 통해 받은 은혜를 나눠주세요!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devotionals.map(d => (
            <div
              key={d.id}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {/* 아바타 */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {getInitial(d.user_name, d.user_email)}
                </div>

                <div className="flex-1 min-w-0">
                  {/* 이름 + 시간 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {d.user_name || d.user_email.split('@')[0]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {getRelativeTime(d.created_at)}
                    </span>
                  </div>

                  {/* 내용 */}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {d.content}
                  </p>
                </div>

                {/* 삭제 버튼 (본인 글만) */}
                {d.user_id === currentUserId && (
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-2 text-gray-300 hover:text-red-500 transition flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    style={{ touchAction: 'manipulation' }}
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
