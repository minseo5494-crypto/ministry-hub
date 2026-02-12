'use client'

import { useRouter } from 'next/navigation'
import {
  Music, Plus, Users, UserPlus, X,
  BarChart3, MessageSquare
} from 'lucide-react'
import { User } from '../types'

type MobileMenuProps = {
  isOpen: boolean
  user: User | null
  onClose: () => void
  setShowAddSongModal: (show: boolean) => void
  handleSignOut: () => void
}

export default function MobileMenu({
  isOpen,
  user,
  onClose,
  setShowAddSongModal,
  handleSignOut
}: MobileMenuProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* 사이드바 메뉴 */}
      <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-purple-50">
          <h2 className="text-xl font-bold text-purple-700">메뉴</h2>
          <button
            onClick={onClose}
            className="p-2 text-purple-500 hover:bg-purple-100 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* 메뉴 아이템들 */}
        <div className="p-4 space-y-2">
          {user ? (
            <>
              {/* PraiseHub - 현재 비활성화
              <button
                onClick={() => {
                  router.push('/streaming')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition"
              >
                <Music size={20} />
                <span className="font-medium">PraiseHub</span>
              </button>
              */}

              {/* My Team */}
              <button
                onClick={() => {
                  router.push('/my-team')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Users size={20} />
                <span>My Team</span>
              </button>

              {/* My Page */}
              <button
                onClick={() => {
                  router.push('/my-page')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <UserPlus size={20} />
                <span>My Page</span>
              </button>

              <div className="border-t my-2"></div>

              {/* 곡 추가 */}
              <button
                onClick={() => {
                  setShowAddSongModal(true)
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Plus size={20} />
                <span>곡 추가</span>
              </button>

              {/* 팀 만들기 */}
              <button
                onClick={() => {
                  router.push('/teams/create')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Users size={20} />
                <span>팀 만들기</span>
              </button>

              {/* 팀 참여 */}
              <button
                onClick={() => {
                  router.push('/teams/join')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <UserPlus size={20} />
                <span>팀 참여</span>
              </button>

              {/* 관리자 메뉴 */}
              {user?.is_admin && (
                <>
                  <div className="border-t my-2"></div>
                  <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">관리자</p>

                  <button
                    onClick={() => {
                      router.push('/admin/content-management')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-blue-700 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Music size={20} />
                    <span>콘텐츠 관리</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push('/admin/account-management')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-violet-700 hover:bg-violet-50 rounded-lg transition"
                  >
                    <Users size={20} />
                    <span>계정 관리</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push('/admin/dashboard')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-green-700 hover:bg-green-50 rounded-lg transition"
                  >
                    <BarChart3 size={20} />
                    <span>통계 대시보드</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push('/admin/feedbacks')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-orange-700 hover:bg-orange-50 rounded-lg transition"
                  >
                    <MessageSquare size={20} />
                    <span>피드백 관리</span>
                  </button>
                </>
              )}

              <div className="border-t my-2"></div>

              {/* 사용자 정보 */}
              <div className="px-4 py-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">로그인 계정</p>
                <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
              </div>

              {/* 로그아웃 */}
              <button
                onClick={() => {
                  handleSignOut()
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] transition"
              >
                <X size={20} />
                <span className="font-medium">로그아웃</span>
              </button>
            </>
          ) : (
            <>
              {/* 로그인 */}
              <button
                onClick={() => {
                  router.push('/login')
                  onClose()
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <span className="font-medium">로그인</span>
              </button>

              {/* 회원가입 */}
              <button
                onClick={() => {
                  router.push('/signup')
                  onClose()
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] transition"
              >
                <span className="font-medium">회원가입</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
