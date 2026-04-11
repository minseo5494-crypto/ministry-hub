'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activityLogger'
import { ArrowLeft, Users } from 'lucide-react'
import { trackTeamCreate } from '@/lib/analytics'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function CreateTeamPage() {
  const router = useRouter()
  const t = useTranslations('teams')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [teamName, setTeamName] = useState('')
  const [teamType, setTeamType] = useState<'church_internal' | 'external'>('church_internal')
  const [churchName, setChurchName] = useState('')

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

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      alert(t('enterTeamName'))
      return
    }

    if (teamType === 'church_internal' && !churchName.trim()) {
      alert(t('enterChurchName'))
      return
    }

    setCreating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/teams/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          teamName: teamName.trim(),
          teamType,
          churchName: churchName.trim(),
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || t('createFailed'))
      }

      logActivity({
        actionType: 'team_create',
        userId: user.id,
        teamId: result.team.id
      }).catch(err => console.error('Team create logging failed:', err))

      trackTeamCreate()

      alert(t('createSuccess'))
      router.push(`/my-team/${result.team.id}`)
    } catch (error: any) {
      console.error('Error creating team:', error)
      alert(t('createError', { message: error.message }))
    } finally {
      setCreating(false)
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
            <h1 className="text-lg font-bold text-gray-900">{t('createTitle')}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-6">
            <Users className="w-8 h-8 text-blue-600" />
          </div>

          <h2 className="text-xl font-bold text-center mb-2">{t('createHeading')}</h2>
          <p className="text-gray-600 text-center mb-8">
            {t('createDescription')}
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('teamNameLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="words"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={t('teamNamePlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('teamNameCount', { count: teamName.length })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('teamTypeLabel')} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setTeamType('church_internal')}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    teamType === 'church_internal'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold mb-1">{t('teamTypeChurch')}</div>
                  <div className="text-xs text-gray-600">
                    {t('teamTypeChurchDesc')}
                  </div>
                </button>

                <button
                  onClick={() => setTeamType('external')}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    teamType === 'external'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold mb-1">{t('teamTypeExternal')}</div>
                  <div className="text-xs text-gray-600">
                    {t('teamTypeExternalDesc')}
                  </div>
                </button>
              </div>
            </div>

            {teamType === 'church_internal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('churchNameLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="words"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder={t('churchNamePlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  maxLength={50}
                />
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">{t('infoTitle')}</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• {t('infoInviteCode')}</li>
                <li>• {t('infoInviteOthers')}</li>
                <li>• {t('infoLeaderPermission')}</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => router.push('/my-team')}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                disabled={creating}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={creating}
                className="flex-1 px-6 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-medium disabled:bg-gray-400"
              >
                {creating ? t('creating') : t('createButton')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
