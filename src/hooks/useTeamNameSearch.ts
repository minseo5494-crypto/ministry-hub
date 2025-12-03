// src/hooks/useTeamNameSearch.ts
// 🔍 팀명 자동완성 검색 훅

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * 팀명 자동완성 검색 훅
 */
export function useTeamNameSearch() {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const searchTeamNames = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setIsSearching(true)

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('team_name')
        .ilike('team_name', `%${query}%`)
        .not('team_name', 'is', null)
        .limit(50)

      if (error) throw error

      // 중복 제거 및 정렬
      const uniqueTeams = [...new Set(data?.map(d => d.team_name).filter(Boolean))] as string[]
      setSuggestions(uniqueTeams.slice(0, 10))
      setShowSuggestions(uniqueTeams.length > 0)
    } catch (error) {
      console.error('Error searching team names:', error)
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }

  const clearSuggestions = () => {
    setSuggestions([])
    setShowSuggestions(false)
  }

  return {
    suggestions,
    showSuggestions,
    isSearching,
    searchTeamNames,
    clearSuggestions,
    setShowSuggestions
  }
}