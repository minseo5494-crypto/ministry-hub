'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activityLogger'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { trackTeamJoin } from '@/lib/analytics'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function JoinTeamPage() {
  const router = useRouter()
  const t = useTranslations('teams')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    checkUser()
  }, [])

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
    } finally {
      setLoading(false)
    }
  }

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      alert(t('enterInviteCode'))
      return
    }

    setJoining(true)

    try {
      // 0. Team count limit check (max 10)
      const { count: teamCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
      if ((teamCount ?? 0) >= 10) {
        alert(t('maxTeamsReached'))
        setJoining(false)
        return
      }

      // 1. Find team by invite code
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single()

      if (teamError || !teamData) {
        alert(t('invalidInviteCode'))
        setJoining(false)
        return
      }

      // 2. Check if already a member or pending
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamData.id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        if (existingMember.status === 'pending') {
          alert(t('alreadyPending'))
        } else {
          alert(t('alreadyMember'))
          router.push(`/my-team/${teamData.id}`)
        }
        return
      }

      // 3. Submit join request (pending status)
      const insertData = {
        team_id: teamData.id,
        user_id: user.id,
        role: 'member',
        status: 'pending'
      }
      console.log('Inserting team member with data:', insertData)

      const { data: insertResult, error: memberError } = await supabase
        .from('team_members')
        .insert(insertData)
        .select()

      console.log('Insert result:', insertResult, 'Error:', memberError)

      if (memberError) throw memberError

      logActivity({
        actionType: 'team_join_request',
        userId: user.id,
        teamId: teamData.id
      }).catch(err => console.error('Team join request logging failed:', err))

      trackTeamJoin()

      alert(t('joinRequestSent', { teamName: teamData.name }))
      router.push('/my-team')
    } catch (error: any) {
      console.error('Error joining team:', error)
      alert(t('joinError', { message: error.message }))
    } finally {
      setJoining(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !joining) {
      handleJoinTeam()
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
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/my-team')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
              title={t('backToTeamList')}
            >
              <span className="material-symbols-outlined text-xl text-slate-600">arrow_back</span>
            </button>
            <Link href="/main" className="text-lg font-logo text-slate-700 hover:text-indigo-600 transition-colors">
              WORSHEEP
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-lg font-bold text-gray-900">{t('joinTitle')}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-6">
            <UserPlus className="w-8 h-8 text-green-600" />
          </div>

          <h2 className="text-xl font-bold text-center mb-2">{t('joinHeading')}</h2>
          <p className="text-gray-600 text-center mb-8">
            {t('joinDescription')}
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('inviteCodeLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder={t('inviteCodePlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center text-2xl font-mono tracking-widest uppercase"
                maxLength={10}
                disabled={joining}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                {t('inviteCodeHint')}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">{t('joinInfoTitle')}</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• {t('joinInfoAskLeader')}</li>
                <li>• {t('joinInfoCaseInsensitive')}</li>
                <li dangerouslySetInnerHTML={{ __html: `• ${t('joinInfoApproval')}` }} />
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => router.push('/my-team')}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                disabled={joining}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleJoinTeam}
                disabled={joining || !inviteCode.trim()}
                className="flex-1 px-6 py-3 bg-[#84B9C0] text-white rounded-lg hover:bg-[#6FA5AC] font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {joining ? t('joining') : t('joinButton')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-2">{t('noTeamYet')}</p>
          <button
            onClick={() => router.push('/teams/create')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {t('createNewTeam')}
          </button>
        </div>
      </div>
    </div>
  )
}
