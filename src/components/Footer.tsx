import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* 로고 및 설명 */}
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold text-gray-900">Ministry Hub</h3>
            <p className="text-sm text-gray-600 mt-1">예배팀을 위한 악보 관리 서비스</p>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/terms" className="text-gray-600 hover:text-gray-900">
              이용약관
            </Link>
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900">
              개인정보처리방침
            </Link>
            <Link href="/copyright" className="text-gray-600 hover:text-gray-900">
              저작권 정책
            </Link>
            <a href="mailto:support@ministryhub.com" className="text-gray-600 hover:text-gray-900">
              문의하기
            </a>
          </div>
        </div>

        {/* 저작권 */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Ministry Hub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
