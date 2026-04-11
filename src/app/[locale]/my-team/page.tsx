'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { Users, Plus, UserPlus, ChevronRight, Building2, Crown, User } from 'lucide-react'
import Link from 'next/link'

interface Team {
  id: string
  name: string
  type: string
  church_name: string | null
  member_count: number
  created_at: string
  role: string
  invite_code: string
}

export default function MyTeamPage() {
  const router = useRouter()
  const t = useTranslations('myTeam')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      fetchTeams()
    }
  }, [user])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert(t('loginRequired'))
        router.push('/login')
        return
      }
      setUser(currentUser)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    }
  }

  const fetchTeams = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          role,
          teams (
            id,
            name,
            type,
            church_name,
            member_count,
            invite_code,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) throw error

      const teamsList: Team[] = (data || []).map((tm: any) => ({
        id: tm.teams.id,
        name: tm.teams.name,
        type: tm.teams.type,
        church_name: tm.teams.church_name,
        member_count: tm.teams.member_count || 0,
        created_at: tm.teams.created_at,
        role: tm.role,
        invite_code: tm.teams.invite_code
      }))

    setTeams(teamsList)

    } catch (error) {
      console.error('Error fetching teams:', error)
      alert(t('fetchTeamsFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 뒤로가기 */}
              <button
                onClick={() => router.push('/main')}
                className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition"
                title={t('backToMain')}
              >
                <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
              </button>
              {/* 로고 */}
              <Link href="/main" className="text-xl font-logo text-slate-700 hover:text-indigo-600 transition-colors">
                WORSHEEP
              </Link>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{t('pageTitle')}</h1>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {teams.length === 0 ? (
          // 팀이 없을 때
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Users className="w-24 h-24 text-gray-300 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t('noTeamsTitle')}
              </h2>
              <p className="text-gray-600 mb-8">
                {t('noTeamsDesc')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/teams/create')}
                  className="p-6 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition text-left"
                >
                  <Plus className="w-8 h-8 text-blue-600 mb-3" />
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{t('createTeam')}</h3>
                  <p className="text-sm text-gray-600">
                    {t('createTeamDesc')}
                  </p>
                </button>

                <button
                  onClick={() => router.push('/teams/join')}
                  className="p-6 border-2 border-green-300 rounded-lg hover:bg-green-50 transition text-left"
                >
                  <UserPlus className="w-8 h-8 text-green-600 mb-3" />
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{t('joinTeam')}</h3>
                  <p className="text-sm text-gray-600">
                    {t('joinTeamDesc')}
                  </p>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // 팀이 있을 때
          <div>
            {/* 액션 버튼 */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {t('myTeamsCount', { count: teams.length })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/teams/join')}
                  className="px-4 py-2 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] flex items-center"
                >
                  <UserPlus className="mr-2" size={18} />
                  {t('joinTeamShort')}
                </button>
                <button
                  onClick={() => router.push('/teams/create')}
                  className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center"
                >
                  <Plus className="mr-2" size={18} />
                  {t('createTeam')}
                </button>
              </div>
            </div>

            {/* 팀 목록 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => router.push(`/my-team/${team.id}`)}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition">
                          {team.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {team.role === 'leader' ? (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                              <Crown className="inline w-3 h-3 mr-1" />
                              {t('roleLeader')}
                            </span>
                          ) : team.role === 'admin' ? (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                              {t('roleAdmin')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                              <User className="inline w-3 h-3 mr-1" />
                              {t('roleMember')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition" />
                  </div>

                  {team.church_name && (
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <Building2 className="w-4 h-4 mr-2" />
                      {team.church_name}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {team.type === 'church_internal' ? t('teamTypeInternal') : t('teamTypeExternal')}
                    </span>
                    <span>{t('memberCount', { count: team.member_count })}</span>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-gray-500">
                      {t('inviteCode')}: <span className="font-mono font-semibold text-gray-700">{team.invite_code}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
