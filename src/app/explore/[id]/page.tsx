'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Heart, Bookmark, Copy, Loader2, Music2, BookOpen, Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCommunity } from '@/hooks/useCommunity'
import { useCommunityComments } from '@/hooks/useCommunityComments'
import type { SharedSetlist, SharedSetlistComment } from '@/types/community'
import CommunityComments from '@/app/community/components/CommunityComments'
import CopyToTeamModal from '@/app/community/components/CopyToTeamModal'

type UserTeam = {
  id: string
  name: string
}

export default function ExploreDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { fetchSharedSetlist, toggleLike, toggleBookmark, copyToTeam, deleteSharedSetlist, loading } = useCommunity()
  const { fetchComments, addComment, deleteComment, reportSetlist, loading: commentsLoading } = useCommunityComments()

  const [setlist, setSetlist] = useState<SharedSetlist | null>(null)
  const [comments, setComments] = useState<SharedSetlistComment[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userTeams, setUserTeams] = useState<UserTeam[]>([])
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // 현재 사용자 정보 로드
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // 내 팀 목록 조회
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('team_id, teams(id, name)')
        .eq('user_id', user.id)

      if (memberRows) {
        const teams = memberRows
          .map((row: any) => {
            const team = Array.isArray(row.teams) ? row.teams[0] : row.teams
            return team ? { id: team.id, name: team.name } : null
          })
          .filter(Boolean) as UserTeam[]
        setUserTeams(teams)
      }
    }
    loadUser()
  }, [])

  // 콘티 상세 로드
  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const result = await fetchSharedSetlist(id, user?.id)
      if (!result) {
        setNotFound(true)
        return
      }
      setSetlist(result)

      const commentList = await fetchComments(id)
      setComments(commentList)
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleLike = async () => {
    if (!setlist || !currentUserId || likeLoading) return
    setLikeLoading(true)
    const wasLiked = setlist.is_liked ?? false
    setSetlist(prev => prev ? {
      ...prev,
      is_liked: !wasLiked,
      like_count: prev.like_count + (wasLiked ? -1 : 1),
    } : null)
    const ok = await toggleLike(setlist.id, currentUserId, wasLiked)
    if (!ok) {
      setSetlist(prev => prev ? {
        ...prev,
        is_liked: wasLiked,
        like_count: prev.like_count + (wasLiked ? 1 : -1),
      } : null)
    }
    setLikeLoading(false)
  }

  const handleToggleBookmark = async () => {
    if (!setlist || !currentUserId || bookmarkLoading) return
    setBookmarkLoading(true)
    const wasBookmarked = setlist.is_bookmarked ?? false
    setSetlist(prev => prev ? {
      ...prev,
      is_bookmarked: !wasBookmarked,
      bookmark_count: prev.bookmark_count + (wasBookmarked ? -1 : 1),
    } : null)
    const ok = await toggleBookmark(setlist.id, currentUserId, wasBookmarked)
    if (!ok) {
      setSetlist(prev => prev ? {
        ...prev,
        is_bookmarked: wasBookmarked,
        bookmark_count: prev.bookmark_count + (wasBookmarked ? 1 : -1),
      } : null)
    }
    setBookmarkLoading(false)
  }

  const handleCopyToTeam = async (input: { team_id: string; service_date: string; service_type?: string }) => {
    if (!setlist || !currentUserId) return
    await copyToTeam(
      {
        shared_setlist_id: setlist.id,
        team_id: input.team_id,
        service_date: input.service_date,
        service_type: input.service_type,
      },
      currentUserId
    )
    setSetlist(prev => prev ? { ...prev, copy_count: prev.copy_count + 1 } : null)
  }

  const handleAddComment = async (content: string) => {
    if (!setlist || !currentUserId) return
    const newComment = await addComment(setlist.id, content, currentUserId)
    if (newComment) {
      setComments(prev => [...prev, newComment])
      setSetlist(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const ok = await deleteComment(commentId)
    if (ok) {
      setComments(prev => prev.filter(c => c.id !== commentId))
      setSetlist(prev => prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : null)
    }
  }

  const handleReport = async (reason: string) => {
    if (!setlist || !currentUserId) return
    await reportSetlist(setlist.id, currentUserId, reason)
    alert('신고가 접수되었습니다. 검토 후 처리됩니다.')
  }

  const handleDelete = async () => {
    if (!setlist || !currentUserId) return
    if (!confirm('이 콘티를 커뮤니티에서 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.')) return
    const ok = await deleteSharedSetlist(setlist.id)
    if (ok) {
      router.replace('/explore?tab=shared')
    } else {
      alert('삭제에 실패했습니다. 다시 시도해주세요.')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }

  if (loading && !setlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="text-violet-500 animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Music2 size={48} className="text-gray-300" />
        <p className="text-gray-500 font-medium">콘티를 찾을 수 없습니다</p>
        <button
          onClick={() => router.push('/explore?tab=shared')}
          className="px-4 py-2 text-sm text-violet-600 font-medium hover:underline"
        >
          Explore로 돌아가기
        </button>
      </div>
    )
  }

  if (!setlist) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/explore?tab=shared')}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            style={{ touchAction: 'manipulation', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-gray-700 font-medium text-sm truncate flex-1">{setlist.title}</span>
          {currentUserId && setlist.shared_by === currentUserId && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
              style={{ touchAction: 'manipulation', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 상단 정보 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{setlist.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5 mb-1 text-sm text-gray-600">
            <span>{setlist.author_name} 님</span>
            {setlist.author_church && (
              <>
                <span className="text-gray-300">·</span>
                <span>{setlist.author_church}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400 mb-4">
            <span>{formatDate(setlist.created_at)}</span>
            {setlist.service_type && (
              <>
                <span className="text-gray-300">·</span>
                <span>{setlist.service_type}</span>
              </>
            )}
          </div>

          {setlist.description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-4 bg-gray-50 rounded-xl p-3">
              {setlist.description}
            </p>
          )}

          {/* 태그 */}
          {setlist.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {setlist.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleToggleLike}
              disabled={!currentUserId || likeLoading}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                setlist.is_liked
                  ? 'bg-red-50 text-red-500 border border-red-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-red-200'
              } disabled:opacity-50`}
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              <Heart size={16} className={setlist.is_liked ? 'fill-red-500' : ''} />
              <span>{setlist.like_count}</span>
            </button>

            <button
              onClick={handleToggleBookmark}
              disabled={!currentUserId || bookmarkLoading}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                setlist.is_bookmarked
                  ? 'bg-violet-50 text-violet-600 border border-violet-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-violet-200'
              } disabled:opacity-50`}
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              <Bookmark size={16} className={setlist.is_bookmarked ? 'fill-violet-500' : ''} />
              <span>{setlist.is_bookmarked ? '저장됨' : '저장'}</span>
            </button>

            <button
              onClick={() => currentUserId ? setShowCopyModal(true) : router.push('/login')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-all ml-auto"
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              <Copy size={16} />
              <span>내 팀에 가져오기</span>
            </button>
          </div>
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            곡 목록 ({setlist.songs.length}곡)
          </h2>
          <div className="space-y-4">
            {setlist.songs.map((song, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="text-sm text-gray-400 w-5 shrink-0 mt-0.5 font-medium">{idx + 1}.</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{song.song_title}</span>
                    {song.artist && (
                      <span className="text-xs text-gray-400">{song.artist}</span>
                    )}
                    {song.key && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium">
                        {song.key}
                      </span>
                    )}
                  </div>
                  {song.selected_form.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {song.selected_form.map((part, partIdx) => (
                        <span
                          key={partIdx}
                          className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded font-medium"
                        >
                          {part}
                        </span>
                      ))}
                    </div>
                  )}
                  {song.notes && (
                    <p className="text-xs text-gray-500 italic">"{song.notes}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 묵상 가이드 */}
        {setlist.devotional_guide && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={18} className="text-amber-600" />
              <h2 className="text-base font-bold text-gray-900">묵상 가이드</h2>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {setlist.devotional_guide}
            </p>
          </div>
        )}

        {/* 댓글 섹션 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <CommunityComments
            comments={comments}
            currentUserId={currentUserId}
            loading={commentsLoading}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onReport={handleReport}
          />
        </div>
      </div>

      {/* 내 팀으로 복사 모달 */}
      <CopyToTeamModal
        isOpen={showCopyModal}
        teams={userTeams}
        onClose={() => setShowCopyModal(false)}
        onCopy={handleCopyToTeam}
      />
    </div>
  )
}
