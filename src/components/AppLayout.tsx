'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ReactNode } from 'react'

interface BackInfo {
  label: string  // 뒤로가기 대상 페이지 이름 (예: "메인", "팀 페이지")
  path: string   // 뒤로가기 경로
}

interface AppLayoutProps {
  children: ReactNode
  // 사이드바 관련
  sidebar?: ReactNode           // 사이드바 커스텀 콘텐츠
  showSidebar?: boolean         // 사이드바 표시 여부 (기본: true)
  // 뒤로가기 관련
  backInfo?: BackInfo           // 뒤로가기 정보 (없으면 뒤로가기 버튼 안 보임)
  // 헤더 관련
  headerContent?: ReactNode     // 헤더 우측 커스텀 콘텐츠
  title?: string                // 페이지 제목 (사이드바 아래 표시)
  // 추가 옵션
  fullWidth?: boolean           // 전체 너비 사용 여부
  noPadding?: boolean           // 패딩 제거
}

export default function AppLayout({
  children,
  sidebar,
  showSidebar = true,
  backInfo,
  headerContent,
  title,
  fullWidth = false,
  noPadding = false,
}: AppLayoutProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backInfo?.path) {
      router.push(backInfo.path)
    } else {
      router.back()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 사이드바 - 데스크톱 전용 */}
      {showSidebar && (
        <aside className="hidden lg:flex w-[260px] h-screen sticky top-0 bg-white border-r border-slate-200 flex-col shrink-0">
          {/* 로고 */}
          <div className="p-6 pb-4">
            <Link
              href="/main"
              className="text-xl font-black tracking-tighter text-slate-700 hover:text-indigo-600 transition-colors"
            >
              WORSHEEP
            </Link>
          </div>

          {/* 페이지 제목 */}
          {title && (
            <div className="px-6 pb-4">
              <h1 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</h1>
            </div>
          )}

          {/* 사이드바 콘텐츠 */}
          <div className="flex-1 overflow-y-auto px-3">
            {sidebar}
          </div>

          {/* 하단: 뒤로가기 버튼 */}
          {backInfo && (
            <div className="p-4 border-t border-slate-200">
              <button
                onClick={handleBack}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                <span>뒤로가기 ({backInfo.label})</span>
              </button>
            </div>
          )}
        </aside>
      )}

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 헤더 */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {/* 모바일 뒤로가기 */}
              {backInfo && (
                <button
                  onClick={handleBack}
                  className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
                </button>
              )}
              {/* 로고 */}
              <Link
                href="/main"
                className="text-lg font-black tracking-tighter text-slate-700"
              >
                WORSHEEP
              </Link>
            </div>
            {/* 헤더 우측 콘텐츠 */}
            {headerContent}
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className={`flex-1 ${noPadding ? '' : 'p-4 lg:p-8'} ${fullWidth ? '' : 'max-w-6xl mx-auto w-full'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

// 사이드바 없는 심플 레이아웃
export function SimpleAppLayout({
  children,
  backInfo,
  headerContent,
}: {
  children: ReactNode
  backInfo?: BackInfo
  headerContent?: ReactNode
}) {
  const router = useRouter()

  const handleBack = () => {
    if (backInfo?.path) {
      router.push(backInfo.path)
    } else {
      router.back()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            {/* 뒤로가기 */}
            {backInfo && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
                <span className="hidden sm:inline text-sm text-slate-600">뒤로가기 ({backInfo.label})</span>
              </button>
            )}
            {/* 로고 */}
            <Link
              href="/main"
              className="text-lg lg:text-xl font-black tracking-tighter text-slate-700 hover:text-indigo-600 transition-colors"
            >
              WORSHEEP
            </Link>
          </div>
          {/* 헤더 우측 콘텐츠 */}
          {headerContent}
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        {children}
      </main>
    </div>
  )
}
