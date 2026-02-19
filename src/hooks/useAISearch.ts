'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// 검색 필터 타입 정의
export interface AISearchFilters {
  keywords: string[]        // 검색 키워드 (곡명, 아티스트 등)
  themes: string[]          // 테마 (감사, 찬양, 은혜 등)
  season: string | null     // 시즌 (크리스마스, 부활절 등)
  tempo: string | null      // 템포 (slow, medium, fast)
  key: string | null        // 조성 (C, D, E 등)
  mood: string | null       // 분위기 설명 (차분한, 힘찬 등)
  lyricsKeywords: string[]  // 가사에서 찾을 키워드
}

export interface AISearchResult {
  success: boolean
  query: string
  filters: AISearchFilters
  error?: string
}

export function useAISearch() {
  const [isSearching, setIsSearching] = useState(false)
  const [lastResult, setLastResult] = useState<AISearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const searchWithAI = useCallback(async (query: string): Promise<AISearchResult | null> => {
    if (!query.trim()) {
      return null
    }

    setIsSearching(true)
    setError(null)

    try {
      // 인증 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('로그인이 필요합니다.')
      }

      const response = await fetch('/api/ai-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '검색 중 오류가 발생했습니다.')
      }

      const result: AISearchResult = {
        success: true,
        query: data.query,
        filters: data.filters,
      }

      setLastResult(result)
      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      setError(errorMessage)

      const errorResult: AISearchResult = {
        success: false,
        query,
        filters: {
          keywords: query.split(' ').filter(k => k.length > 1),
          themes: [],
          season: null,
          tempo: null,
          key: null,
          mood: null,
          lyricsKeywords: [],
        },
        error: errorMessage,
      }

      setLastResult(errorResult)
      return errorResult

    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearResult = useCallback(() => {
    setLastResult(null)
    setError(null)
  }, [])

  return {
    searchWithAI,
    isSearching,
    lastResult,
    error,
    clearResult,
  }
}
