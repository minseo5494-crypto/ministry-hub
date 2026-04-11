'use client'

import { useRouter } from 'next/navigation'
import {
  Music, Plus, Users, UserPlus, MoreVertical,
  BarChart3, Menu, MessageSquare, Compass, HelpCircle
} from 'lucide-react'
import { User } from '../types'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'

type HeaderProps = {
  user: User | null
  showMenu: boolean
  setShowMenu: (show: boolean) => void
  setShowMobileMenu: (show: boolean) => void
  setShowAddSongModal: (show: boolean) => void
  handleSignOut: () => void
  onOpenGuide?: () => void
}

export default function Header({
  user,
  showMenu,
  setShowMenu,
  setShowMobileMenu,
  setShowAddSongModal,
  handleSignOut,
  onOpenGuide
}: HeaderProps) {
  const router = useRouter()
  const t = useTranslations()

  return (
    <div className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 md:py-4">
        <div className="flex items-center justify-between">
          {/* 로고 */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <button
              onClick={() => window.location.reload()}
              className="text-2xl font-logo text-gray-900 hover:text-indigo-600 transition-colors"
              title={t('common.refresh')}
            >
              WORSHEEP
            </button>
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="p-1.5 text-[#84B9C0] hover:text-[#6BA3AA] hover:bg-gray-100 rounded-full transition-colors"
                title={t('nav.userGuide')}
                style={{ minWidth: '36px', minHeight: '36px', touchAction: 'manipulation' }}
              >
                <HelpCircle size={18} />
              </button>
            )}
          </div>

          {/* 네비게이션 */}
          <div className="flex items-center gap-2">
            {/* 언어 전환 */}
            <LanguageSwitcher />

            {/* 모바일: 햄버거 메뉴 버튼 */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title={t('common.menu')}
            >
              <Menu size={24} />
            </button>

            {/* 데스크톱: 기존 버튼들 */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  <button
                    onClick={() => router.push('/explore')}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap flex items-center gap-1"
                  >
                    <Compass size={15} />
                    <span>{t('nav.explore')}</span>
                  </button>

                  <button
                    onClick={() => router.push('/my-team')}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
                  >
                    {t('nav.myTeam')}
                  </button>

                  <button
                    onClick={() => router.push('/my-page')}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
                  >
                    {t('nav.myPage')}
                  </button>

                  <div className="w-px h-8 bg-gray-300 mx-2"></div>

                  {/* 더보기 메뉴 */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(!showMenu)
                      }}
                      className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      title={t('common.more')}
                    >
                      <MoreVertical size={20} />
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                        <button
                          onClick={() => {
                            setShowAddSongModal(true)
                            setShowMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <Plus className="mr-2" size={18} />
                          {t('nav.upload')}
                        </button>
                        <button
                          onClick={() => {
                            router.push('/teams/create')
                            setShowMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <Users className="mr-2" size={18} />
                          {t('nav.createTeam')}
                        </button>
                        <button
                          onClick={() => {
                            router.push('/teams/join')
                            setShowMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <UserPlus className="mr-2" size={18} />
                          {t('nav.joinTeam')}
                        </button>

                        {user?.is_admin && (
                          <>
                            <div className="border-t my-1"></div>
                            <button
                              onClick={() => {
                                router.push('/admin/content-management')
                                setShowMenu(false)
                              }}
                              className="w-full px-4 py-2 text-left text-blue-700 hover:bg-blue-50 flex items-center font-medium"
                            >
                              <Music className="mr-2" size={18} />
                              {t('nav.contentManagement')}
                            </button>
                            <button
                              onClick={() => {
                                router.push('/admin/account-management')
                                setShowMenu(false)
                              }}
                              className="w-full px-4 py-2 text-left text-violet-700 hover:bg-violet-50 flex items-center font-medium"
                            >
                              <Users className="mr-2" size={18} />
                              {t('nav.accountManagement')}
                            </button>
                            <button
                              onClick={() => {
                                router.push('/admin/dashboard')
                                setShowMenu(false)
                              }}
                              className="w-full px-4 py-2 text-left text-green-700 hover:bg-green-50 flex items-center font-medium"
                            >
                              <BarChart3 className="mr-2" size={18} />
                              {t('nav.dashboard')}
                            </button>
                            <button
                              onClick={() => {
                                router.push('/admin/feedbacks')
                                setShowMenu(false)
                              }}
                              className="w-full px-4 py-2 text-left text-orange-700 hover:bg-orange-50 flex items-center font-medium"
                            >
                              <MessageSquare className="mr-2" size={18} />
                              {t('nav.feedbackManagement')}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="w-px h-8 bg-gray-300 mx-2"></div>

                  <span className="text-sm text-gray-600 px-2">
                    {user.email}
                  </span>

                  <button
                    onClick={handleSignOut}
                    className="px-3 py-2 text-sm bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] transition whitespace-nowrap"
                  >
                    {t('common.logout')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/login')}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition whitespace-nowrap"
                  >
                    {t('common.login')}
                  </button>
                  <button
                    onClick={() => router.push('/signup')}
                    className="px-4 py-2 text-sm bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] transition whitespace-nowrap"
                  >
                    {t('common.signup')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
