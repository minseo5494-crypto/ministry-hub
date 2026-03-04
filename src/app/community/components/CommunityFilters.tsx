'use client'

import { Search, X } from 'lucide-react'
import type { CommunityFilters as CommunityFiltersType } from '@/types/community'

const SERVICE_TYPES = ['주일예배', '수요예배', '금요예배', '새벽예배', '청년예배', '주일학교']
const POPULAR_TAGS = ['부활절', '크리스마스', '감사', '경배', '찬양', '묵상', '빠른', '느린']

type CommunityFiltersProps = {
  filters: CommunityFiltersType
  onChange: (filters: CommunityFiltersType) => void
}

export default function CommunityFilters({ filters, onChange }: CommunityFiltersProps) {
  const handleSortChange = (sortBy: CommunityFiltersType['sortBy']) => {
    onChange({ ...filters, sortBy })
  }

  const handleServiceTypeChange = (serviceType: string) => {
    onChange({
      ...filters,
      serviceType: filters.serviceType === serviceType ? null : serviceType,
    })
  }

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag]
    onChange({ ...filters, tags: newTags })
  }

  const handleSearchChange = (searchText: string) => {
    onChange({ ...filters, searchText })
  }

  const clearFilters = () => {
    onChange({ sortBy: 'latest', serviceType: null, tags: [], searchText: '' })
  }

  const hasActiveFilters = filters.serviceType || filters.tags.length > 0 || filters.searchText

  return (
    <div className="space-y-3">
      {/* 검색바 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="콘티 검색 (제목, 작성자, 교회명...)"
          value={filters.searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          style={{ fontSize: '16px' }}
        />
        {filters.searchText && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            style={{ touchAction: 'manipulation', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 정렬 탭 */}
      <div className="flex gap-2">
        {([
          { key: 'latest', label: '최신' },
          { key: 'popular', label: '인기' },
          { key: 'most_copied', label: '많이 복사됨' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSortChange(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filters.sortBy === key
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 예배 유형 */}
      <div className="flex gap-2 flex-wrap">
        {SERVICE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => handleServiceTypeChange(type)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              filters.serviceType === type
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-indigo-300'
            }`}
            style={{ touchAction: 'manipulation', minHeight: '36px' }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* 태그 */}
      <div className="flex gap-2 flex-wrap">
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagToggle(tag)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              filters.tags.includes(tag)
                ? 'bg-violet-100 text-violet-700 border border-violet-300'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-violet-300'
            }`}
            style={{ touchAction: 'manipulation', minHeight: '36px' }}
          >
            #{tag}
          </button>
        ))}
      </div>

      {/* 필터 초기화 */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          style={{ touchAction: 'manipulation' }}
        >
          <X size={14} />
          필터 초기화
        </button>
      )}
    </div>
  )
}
