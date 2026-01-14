'use client'

import { useState } from 'react'
import { MessageSquarePlus, X, Send, Bug, Lightbulb, HelpCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { trackFeedbackSubmit } from '@/lib/analytics'

type FeedbackType = 'bug' | 'feature' | 'other'

interface FeedbackButtonProps {
  userId?: string
  userEmail?: string
}

export default function FeedbackButton({ userId, userEmail }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('other')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) {
      alert('내용을 입력해주세요.')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('feedbacks')
        .insert({
          user_id: userId || null,
          user_email: userEmail || null,
          type: feedbackType,
          message: message.trim(),
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        })

      if (error) throw error

      // GA4 트래킹
      trackFeedbackSubmit(feedbackType)

      setSubmitted(true)
      setMessage('')

      // 2초 후 모달 닫기
      setTimeout(() => {
        setIsOpen(false)
        setSubmitted(false)
        setFeedbackType('other')
      }, 2000)
    } catch (error) {
      console.error('피드백 전송 실패:', error)
      alert('피드백 전송에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const feedbackTypes = [
    { type: 'bug' as FeedbackType, icon: Bug, label: '버그 신고', color: 'text-red-600 bg-red-50 border-red-200' },
    { type: 'feature' as FeedbackType, icon: Lightbulb, label: '기능 제안', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    { type: 'other' as FeedbackType, icon: HelpCircle, label: '기타 의견', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ]

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        title="피드백 보내기"
      >
        <MessageSquarePlus size={24} />
      </button>

      {/* 모달 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">피드백 보내기</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            {submitted ? (
              /* 전송 완료 */
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">감사합니다!</h4>
                <p className="text-gray-600">소중한 의견 감사드립니다.</p>
              </div>
            ) : (
              /* 피드백 폼 */
              <div className="p-6">
                {/* 피드백 유형 선택 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    유형 선택
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {feedbackTypes.map(({ type, icon: Icon, label, color }) => (
                      <button
                        key={type}
                        onClick={() => setFeedbackType(type)}
                        className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-1 ${
                          feedbackType === type
                            ? color + ' border-current'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 메시지 입력 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    내용
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      feedbackType === 'bug'
                        ? '어떤 문제가 발생했나요? 재현 방법을 알려주시면 도움이 됩니다.'
                        : feedbackType === 'feature'
                        ? '어떤 기능이 있으면 좋을까요?'
                        : '의견을 자유롭게 작성해주세요.'
                    }
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* 안내 문구 */}
                <p className="text-xs text-gray-500 mb-4">
                  현재 페이지 URL과 브라우저 정보가 함께 전송됩니다.
                </p>

                {/* 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !message.trim()}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} />
                        보내기
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
