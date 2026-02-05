// src/hooks/useMobile.ts
// 📱 모바일/태블릿 감지 훅

import { useState, useEffect } from 'react'

/**
 * 모바일 기기 감지 훅
 * @param breakpoint 모바일 기준 너비 (기본값: 768)
 * @returns isMobile 상태
 */
export function useMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // 초기 체크
    checkMobile()

    // 리사이즈 이벤트 리스너
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  return isMobile
}

/**
 * 태블릿 기기 감지 훅
 * - 터치 지원 + 화면 너비 768px 이상 1366px 이하
 * - 또는 iPad/Android 태블릿 User Agent
 * @returns isTablet 상태
 */
export function useTablet() {
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      // iPad 감지 (iOS 13+에서는 데스크톱 Safari로 위장함)
      const isIPad = /iPad/.test(navigator.userAgent) ||
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

      // Android 태블릿 감지
      const isAndroidTablet = /Android/.test(navigator.userAgent) && !/Mobile/.test(navigator.userAgent)

      // 터치 지원 + 768px~1366px 화면 = 태블릿으로 간주
      const isTouchTabletSize = hasTouch && width >= 768 && width <= 1366

      setIsTablet(isIPad || isAndroidTablet || isTouchTabletSize)
    }

    checkTablet()
    window.addEventListener('resize', checkTablet)

    return () => window.removeEventListener('resize', checkTablet)
  }, [])

  return isTablet
}

/**
 * 모바일 또는 태블릿 (터치 기기) 감지 훅
 * @returns { isMobile, isTablet, isTouchDevice }
 */
export function useDevice() {
  const isMobile = useMobile()
  const isTablet = useTablet()

  return {
    isMobile,
    isTablet,
    isTouchDevice: isMobile || isTablet
  }
}

/**
 * 모바일 기기 여부 (User Agent 기반)
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}