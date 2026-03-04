'use client'

import { useState } from 'react'
import { Trash2, Send, Loader2, Flag } from 'lucide-react'
import type { SharedSetlistComment } from '@/types/community'

type CommunityCommentsProps = {
  comments: SharedSetlistComment[]
  currentUserId: string | null
  loading: boolean
  onAddComment: (content: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
  onReport: (reason: string) => Promise<void>
}

export default function CommunityComments({
  comments,
  currentUserId,
  loading,
  onAddComment,
  onDeleteComment,
  onReport,
}: CommunityCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    try {
      await onAddComment(newComment.trim())
      setNewComment('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReport = async () => {
    if (!reportReason.trim() || reportSubmitting) return
    setReportSubmitting(true)
    try {
      await onReport(reportReason.trim())
      setShowReportModal(false)
      setReportReason('')
    } finally {
      setReportSubmitting(false)
    }
  }

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}시간 전`
    const days = Math.floor(hours / 24)
    return `${days}일 전`
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">
          댓글 ({comments.length})
        </h3>
        {currentUserId && (
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            <Flag size={12} />
            <span>신고</span>
          </button>
        )}
      </div>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="text-violet-500 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">
          첫 번째 댓글을 남겨보세요!
        </p>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-800">{comment.author_name} 님</span>
                  {comment.author_church && (
                    <span className="text-xs text-gray-400">· {comment.author_church}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(comment.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
              </div>
              {currentUserId === comment.user_id && (
                <button
                  onClick={() => onDeleteComment(comment.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0 self-start mt-0.5"
                  style={{ touchAction: 'manipulation', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '2px' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 댓글 입력 */}
      {currentUserId ? (
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, 500))}
            placeholder="댓글을 입력하세요... (최대 500자)"
            rows={2}
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            style={{ fontSize: '16px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit()
              }
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 self-end"
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">
            <a href="/login" className="text-violet-600 font-medium hover:underline">로그인</a>
            하면 댓글을 남길 수 있어요
          </p>
        </div>
      )}

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">콘티 신고</h3>
            <p className="text-sm text-gray-500 mb-4">부적절한 콘텐츠를 신고합니다. 사유를 입력해주세요.</p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="신고 사유를 입력하세요..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
              style={{ fontSize: '16px' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowReportModal(false); setReportReason('') }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                취소
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason.trim() || reportSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition"
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                {reportSubmitting ? '신고 중...' : '신고하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
