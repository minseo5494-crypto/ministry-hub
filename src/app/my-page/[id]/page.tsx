'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { 
  ArrowLeft, Plus, Calendar, FileText, Settings, 
  Users, Music, ChevronRight, Crown, User, Search, Filter 
} from 'lucide-react'

interface TeamInfo {
  id: string
  name: string
  type: string
  church_name: string | null
  invite_code: string
  member_count: number
  my_role: string
}

interface Setlist {
  id: string
  title: string
  service_date: string
  service_type: string
  song_count: number
  created_by: string
  created_at: string
  creator_email?: string
}

export default function TeamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const teamId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<TeamInfo | null>(null)
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSetlist, setNewSetlist] = useState({
    title: '',
    service_date: new Date().toISOString().split('T')[0],
    service_type: '주일집회',
    custom_service_type: ''
  })
  const [creating, setCreating] = useState(false)

  // 🆕 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'created'>('date_desc')

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && teamId) {
      fetchTeamInfo()
      fetchSetlists()
    }
  }, [user, teamId])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setUser(currentUser)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamInfo = async () => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (memberError || !memberData) {
        alert('이 팀에 접근 권한이 없습니다.')
        router.push('/my-team')
        return
      }

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()

      if (teamError || !teamData) {
        alert('팀 정보를 불러올 수 없습니다.')
        router.push('/my-team')
        return
      }

      setTeam({
        id: teamData.id,
        name: teamData.name,
        type: teamData.type,
        church_name: teamData.church_name,
        invite_code: teamData.invite_code,
        member_count: teamData.member_count || 0,
        my_role: memberData.role
      })
    } catch (error) {
      console.error('Error fetching team info:', error)
      alert('팀 정보를 불러오는데 실패했습니다.')
    }
  }

  const fetchSetlists = async () => {
    try {
      const { data, error } = await supabase
        .from('team_setlists')
        .select(`
          id,
          title,
          service_date,
          service_type,
          created_by,
          created_at,
          users:created_by (email)
        `)
        .eq('team_id', teamId)
        .order('service_date', { ascending: false })

      if (error) throw error

      // 각 콘티의 곡 수 가져오기
      const setlistsWithCount = await Promise.all(
        (data || []).map(async (setlist: any) => {
          const { count } = await supabase
            .from('team_setlist_songs')
            .select('*', { count: 'exact', head: true })
            .eq('setlist_id', setlist.id)

          return {
            id: setlist.id,
            title: setlist.title,
            service_date: setlist.service_date,
            service_type: setlist.service_type,
            song_count: count || 0,
            created_by: setlist.created_by,
            created_at: setlist.created_at,
            creator_email: setlist.users?.email
          }
        })
      )

      setSetlists(setlistsWithCount)
    } catch (error) {
      console.error('Error fetching setlists:', error)
    }
  }

  const handleCreateSetlist = async () => {
    if (!newSetlist.title.trim()) {
      alert('콘티 제목을 입력하세요.')
      return
    }

    if (newSetlist.service_type === '직접입력' && !newSetlist.custom_service_type.trim()) {
      alert('예배 유형을 입력하세요.')
      return
    }

    setCreating(true)

    try {
      const { data, error } = await supabase
        .from('team_setlists')
        .insert({
          team_id: teamId,
          title: newSetlist.title.trim(),
          service_date: newSetlist.service_date,
          service_type: newSetlist.service_type === '직접입력' 
            ? newSetlist.custom_service_type.trim() 
            : newSetlist.service_type,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      alert('✅ 콘티가 생성되었습니다!')
      setShowCreateModal(false)
      setNewSetlist({
        title: '',
        service_date: new Date().toISOString().split('T')[0],
        service_type: '주일집회',
        custom_service_type: ''
      })
      
      // 콘티 상세 페이지로 이동
      router.push(`/my-team/${teamId}/setlist/${data.id}`)
    } catch (error: any) {
      console.error('Error creating setlist:', error)
      alert(`콘티 생성 실패: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  // 🆕 필터링 및 정렬된 콘티 목록
  const filteredSetlists = setlists
    .filter(setlist => {
      // 검색어 필터
      const matchesSearch = searchTerm === '' || 
        setlist.title.toLowerCase().includes(searchTerm.toLowerCase())
      
      // 예배 유형 필터
      const matchesServiceType = serviceTypeFilter === 'all' || 
        setlist.service_type === serviceTypeFilter
      
      return matchesSearch && matchesServiceType
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.service_date).getTime() - new Date(a.service_date).getTime()
        case 'date_asc':
          return new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:
          return 0
      }
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!team) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/my-team')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
                <p className="text-sm text-gray-600">
                  {team.church_name && `${team.church_name} • `}
                  {team.member_count}명
                  {team.my_role === 'leader' && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                      <Crown className="inline w-3 h-3 mr-1" />
                      리더
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push(`/my-team/${teamId}/settings`)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              title="팀 설정"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">총 콘티</p>
                <p className="text-3xl font-bold text-gray-900">{setlists.length}</p>
              </div>
              <FileText className="w-12 h-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">팀 멤버</p>
                <p className="text-3xl font-bold text-gray-900">{team.member_count}</p>
              </div>
              <Users className="w-12 h-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">초대 코드</p>
                <p className="text-2xl font-mono font-bold text-gray-900">{team.invite_code}</p>
              </div>
              <Music className="w-12 h-12 text-purple-600" />
            </div>
          </div>
        </div>

        {/* 콘티 목록 */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">콘티 목록</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="mr-2" size={18} />
                새 콘티 만들기
              </button>
            </div>

            {/* 🆕 검색 및 필터 */}
            <div className="flex flex-col md:flex-row gap-3 mt-4">
              {/* 검색 */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="콘티 제목으로 검색..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 예배 유형 필터 */}
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">모든 예배</option>
                <option value="주일집회">주일집회</option>
                <option value="중보기도회">중보기도회</option>
                <option value="기도회">기도회</option>
              </select>

              {/* 정렬 */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="date_desc">날짜 최신순</option>
                <option value="date_asc">날짜 오래된순</option>
                <option value="created">생성일순</option>
              </select>
            </div>
          </div>

          {filteredSetlists.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                {searchTerm || serviceTypeFilter !== 'all'
                  ? '검색 결과가 없습니다.'
                  : '아직 생성된 콘티가 없습니다.'}
              </p>
              {!searchTerm && serviceTypeFilter === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  첫 콘티 만들기
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredSetlists.map((setlist) => (
                <button
                  key={setlist.id}
                  onClick={() => router.push(`/my-team/${teamId}/setlist/${setlist.id}`)}
                  className="w-full p-6 hover:bg-gray-50 transition text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition">
                        {setlist.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(setlist.service_date).toLocaleDateString('ko-KR')}
                        </span>
                        <span>{setlist.service_type}</span>
                        <span className="flex items-center">
                          <Music className="w-4 h-4 mr-1" />
                          {setlist.song_count}곡
                        </span>
                        {setlist.creator_email && (
                          <span className="text-gray-500">
                            by {setlist.creator_email}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 콘티 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">새 콘티 만들기</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  콘티 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSetlist.title}
                  onChange={(e) => setNewSetlist({ ...newSetlist, title: e.target.value })}
                  placeholder="예: 아버지의 마음"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 날짜
                </label>
                <input
                  type="date"
                  value={newSetlist.service_date}
                  onChange={(e) => setNewSetlist({ ...newSetlist, service_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 유형
                </label>
                <select
                  value={newSetlist.service_type}
                  onChange={(e) => setNewSetlist({ ...newSetlist, service_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>

              {newSetlist.service_type === '직접입력' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    예배 유형 입력
                  </label>
                  <input
                    type="text"
                    value={newSetlist.custom_service_type}
                    onChange={(e) => setNewSetlist({ ...newSetlist, custom_service_type: e.target.value })}
                    placeholder="예: 또래 기도회"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewSetlist({
                    title: '',
                    service_date: new Date().toISOString().split('T')[0],
                    service_type: '주일집회',
                    custom_service_type: ''
                  })
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                disabled={creating}
              >
                취소
              </button>
              <button
                onClick={handleCreateSetlist}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}