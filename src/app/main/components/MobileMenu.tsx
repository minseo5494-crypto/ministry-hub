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
      <div className="fixed top-0 right-0 h-full w-80 bg-gray-50 shadow-2xl z-50 overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#d8cefd' }}>
          <h2 className="text-lg font-bold" style={{ color: '#4c1d95' }}>WORSHEEP</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition"
            style={{ color: '#4c1d95' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* 메뉴 아이템들 */}
        <div className="p-4 space-y-1">
          {user ? (
            <>
              {/* My Team */}
              <button
                onClick={() => {
                  router.push('/my-team')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
              >
                <Users size={18} style={{ color: '#7c3aed' }} />
                <span className="text-sm font-medium">My Team</span>
              </button>

              {/* My Page */}
              <button
                onClick={() => {
                  router.push('/my-page')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
              >
                <UserPlus size={18} style={{ color: '#7c3aed' }} />
                <span className="text-sm font-medium">My Page</span>
              </button>

              <div className="border-t border-gray-200 my-2 mx-2"></div>

              {/* 곡 추가 */}
              <button
                onClick={() => {
                  setShowAddSongModal(true)
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
              >
                <Plus size={18} style={{ color: '#7c3aed' }} />
                <span className="text-sm font-medium">곡 추가</span>
              </button>

              {/* 팀 만들기 */}
              <button
                onClick={() => {
                  router.push('/teams/create')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
              >
                <Users size={18} style={{ color: '#7c3aed' }} />
                <span className="text-sm font-medium">팀 만들기</span>
              </button>

              {/* 팀 참여 */}
              <button
                onClick={() => {
                  router.push('/teams/join')
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
              >
                <UserPlus size={18} style={{ color: '#7c3aed' }} />
                <span className="text-sm font-medium">팀 참여</span>
              </button>

              {/* 관리자 메뉴 */}
              {user?.is_admin && (
                <>
                  <div className="border-t border-gray-200 my-2 mx-2"></div>
                  <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7c3aed' }}>관리자</p>

                  <button
                    onClick={() => {
                      router.push('/admin/content-management')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
                  >
                    <Music size={18} style={{ color: '#7c3aed' }} />
                    <span className="text-sm font-medium">콘텐츠 관리</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push('/admin/account-management')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
                  >
                    <Users size={18} style={{ color: '#7c3aed' }} />
                    <span className="text-sm font-medium">계정 관리</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push('/admin/dashboard')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
                  >
                    <BarChart3 size={18} style={{ color: '#7c3aed' }} />
                    <span className="text-sm font-medium">통계 대시보드</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push('/admin/feedbacks')
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
                  >
                    <MessageSquare size={18} style={{ color: '#7c3aed' }} />
                    <span className="text-sm font-medium">피드백 관리</span>
                  </button>
                </>
              )}

              <div className="border-t border-gray-200 my-2 mx-2"></div>

              {/* 사용자 정보 */}
              <div className="px-4 py-3 bg-white rounded-xl mx-1">
                <p className="text-[10px] font-medium" style={{ color: '#7c3aed' }}>로그인 계정</p>
                <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{user.email}</p>
              </div>

              {/* 로그아웃 */}
              <div className="px-1 pt-2">
                <button
                  onClick={() => {
                    handleSignOut()
                    onClose()
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition text-sm font-medium"
                  style={{ backgroundColor: '#b2a5c4', color: '#ffffff' }}
                >
                  <X size={16} />
                  <span>로그아웃</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 로그인 */}
              <button
                onClick={() => {
                  router.push('/login')
                  onClose()
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-gray-700 hover:bg-white rounded-xl transition"
              >
                <span className="text-sm font-medium">로그인</span>
              </button>

              {/* 회원가입 */}
              <button
                onClick={() => {
                  router.push('/signup')
                  onClose()
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium"
                style={{ backgroundColor: '#d8cefd', color: '#4c1d95' }}
              >
                <span>회원가입</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
