'use client'

import { useState, useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'

const STORAGE_KEY = 'inapp_browser_alert_dismissed'

export default function InAppBrowserAlert() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 인앱 브라우저 감지
    const ua = navigator.userAgent || ''
    const isKakao = /KAKAOTALK/i.test(ua)
    const isLine = /Line\//i.test(ua)
    const isInsta = /Instagram/i.test(ua)
    const isFB = /FBAN|FBAV/i.test(ua)
    const isNaver = /NAVER/i.test(ua)
    const isInAppBrowser = isKakao || isLine || isInsta || isFB || isNaver

    if (!isInAppBrowser) return

    // PWA (standalone) 체크
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    if (isStandalone) return

    // 24시간 무시 체크
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) {
      const expiry = parseInt(dismissed, 10)
      if (Date.now() < expiry) return
      localStorage.removeItem(STORAGE_KEY)
    }

    setShow(true)
  }, [])

  const handleClose = () => setShow(false)

  const handleDismiss24h = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + 24 * 60 * 60 * 1000))
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 shadow-xl">
        {/* 아이콘 */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
            <ExternalLink size={24} className="text-violet-600" />
          </div>
        </div>

        {/* 안내 문구 */}
        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
          외부 브라우저를 이용해주세요
        </h3>
        <p className="text-sm text-gray-600 text-center leading-relaxed mb-1">
          현재 앱 내 브라우저에서는 일부 기능이
          <br />정상 작동하지 않을 수 있습니다.
        </p>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
          <strong>Chrome</strong> 브라우저 또는{' '}
          <strong>홈 화면에 추가</strong>하여
          <br />앱처럼 사용하시면 최적의 환경을 제공합니다.
        </p>

        {/* 홈 화면 추가 안내 */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5">
          <p className="text-xs text-gray-500 text-center">
            <span className="font-medium text-gray-700">홈 화면에 추가하는 방법</span>
            <br />
            Chrome 우측 상단 <span className="font-medium">⋮</span> 메뉴 →{' '}
            <span className="font-medium">"홈 화면에 추가"</span>
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition"
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            닫기
          </button>
          <button
            onClick={handleDismiss24h}
            className="w-full py-3 text-gray-500 text-sm hover:text-gray-700 transition"
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            24시간 동안 보지 않기
          </button>
        </div>
      </div>
    </div>
  )
}
