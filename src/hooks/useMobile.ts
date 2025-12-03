// src/hooks/useMobile.ts
// 📱 모바일 감지 훅

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
 * 모바일 기기 여부 (User Agent 기반)
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}