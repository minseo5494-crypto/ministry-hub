// src/hooks/useSongSearch.ts
// 🔍 곡 검색 및 필터링 훅

import { useState, useEffect, useMemo } from 'react'
import { supabase, Song } from '@/lib/supabase'

interface SongFilters {
  searchText: string
  season: string
  themes: string[]
  key: string
  isMinor: boolean
  timeSignature: string
  tempo: string
  bpmMin: string
  bpmMax: string
}

const initialFilters: SongFilters = {
  searchText: '',
  season: '전체',
  themes: [],
  key: '',
  isMinor: false,
  timeSignature: '',
  tempo: '',
  bpmMin: '',
  bpmMax: ''
}

export function useSongSearch() {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<SongFilters>(initialFilters)

  // 곡 목록 가져오기
  const fetchSongs = async (userId?: string, userTeamIds?: string[]) => {
    setLoading(true)
    try {
      let allData: any[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .order('song_name', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break

        allData = [...allData, ...data]
        if (data.length < pageSize) break
        from += pageSize
      }

      // 공유 범위 필터링
      const filteredData = allData.filter(song => {
        if (!song.song_name || song.song_name.trim() === '' || song.song_name.length <= 1) {
          return false
        }

        if (song.visibility === 'public' || !song.visibility) {
          return true
        }

        if (!userId) return false

        if (song.visibility === 'private') {
          return song.uploaded_by === userId
        }

        if (song.visibility === 'teams') {
          if (song.uploaded_by === userId) return true
          const sharedTeamIds = song.shared_with_teams || []
          return userTeamIds?.some(teamId => sharedTeamIds.includes(teamId)) || false
        }

        return false
      })

      setSongs(filteredData)
      return filteredData
    } catch (error) {
      console.error('Error fetching songs:', error)
      return []
    } finally {
      setLoading(false)
    }
  }

  // 필터링된 곡 목록
  const filteredSongs = useMemo(() => {
    let result = [...songs]

    // 검색어 필터 (유니코드 정규화 적용)
    if (filters.searchText) {
      const normalizedSearch = filters.searchText.normalize('NFC').toLowerCase()
      result = result.filter(song => {
        const normalizedName = (song.song_name || '').normalize('NFC').toLowerCase()
        const normalizedTeam = (song.team_name || '').normalize('NFC').toLowerCase()
        return normalizedName.includes(normalizedSearch) ||
               normalizedTeam.includes(normalizedSearch)
      })
    }

    // 절기 필터
    if (filters.season && filters.season !== '전체') {
      result = result.filter(song => song.season === filters.season)
    }

    // 테마 필터
    if (filters.themes.length > 0) {
      result = result.filter(song => {
        if (song.themes && Array.isArray(song.themes)) {
          return filters.themes.some(theme => song.themes?.includes(theme))
        }
        return filters.themes.some(theme => 
          song.theme1 === theme || song.theme2 === theme
        )
      })
    }

    // Key 필터
    if (filters.key || filters.isMinor) {
      result = result.filter(song => {
        if (!song.key) return false
        
        if (filters.isMinor && !filters.key) {
          return song.key.includes('m')
        }
        
        if (filters.key && !filters.isMinor) {
          return song.key === filters.key && !song.key.includes('m')
        }
        
        if (filters.key && filters.isMinor) {
          return song.key === `${filters.key}m`
        }
        
        return false
      })
    }

    // 박자 필터
    if (filters.timeSignature) {
      result = result.filter(song => song.time_signature === filters.timeSignature)
    }

    // 템포 필터
    if (filters.tempo) {
      result = result.filter(song => song.tempo === filters.tempo)
    }

    // BPM 범위 필터
    if (filters.bpmMin || filters.bpmMax) {
      result = result.filter(song => {
        if (!song.bpm) return false
        const songBpm = typeof song.bpm === 'string' ? parseFloat(song.bpm) : song.bpm
        const minBpm = filters.bpmMin ? parseFloat(filters.bpmMin) : 0
        const maxBpm = filters.bpmMax ? parseFloat(filters.bpmMax) : Infinity
        return songBpm >= minBpm && songBpm <= maxBpm
      })
    }

    return result
  }, [songs, filters])

  // 필터 업데이트
  const updateFilter = <K extends keyof SongFilters>(key: K, value: SongFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // 필터 초기화
  const resetFilters = () => {
    setFilters(initialFilters)
  }

  // 테마 토글
  const toggleTheme = (theme: string) => {
    setFilters(prev => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter(t => t !== theme)
        : [...prev.themes, theme]
    }))
  }

  return {
    songs,
    filteredSongs,
    loading,
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    toggleTheme,
    fetchSongs
  }
}