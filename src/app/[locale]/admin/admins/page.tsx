'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  ArrowLeft, UserPlus, Shield, ShieldOff, Search,
  Trash2, Crown, AlertTriangle
} from 'lucide-react'

interface AdminUser {
  id: string
  email: string
  name?: string
  created_at?: string
  is_admin: boolean
}

export default function AdminsManagePage() {
  const router = useRouter()
  const t = useTranslations('admin')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [admins, setAdmins] = useState<AdminUser[]>([])

  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null)
  const [searchError, setSearchError] = useState('')

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null)

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert(t('loginRequired'))
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error || !userData?.is_admin) {
        alert(t('adminRequired'))
        router.push('/')
        return
      }

      setCurrentUser(user)
      await loadAdmins()
    } catch (error) {
      console.error('Error checking admin:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadAdmins = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, created_at, is_admin')
      .eq('is_admin', true)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setAdmins(data)
    }
  }

  const searchUserByEmail = async () => {
    if (!newAdminEmail.trim()) {
      setSearchError(t('emailRequired'))
      return
    }

    setSearchError('')
    setSearchResult(null)

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, is_admin')
      .eq('email', newAdminEmail.trim().toLowerCase())
      .single()

    if (error || !data) {
      setSearchError(t('userNotFound'))
      return
    }

    if (data.is_admin) {
      setSearchError(t('alreadyAdmin'))
      return
    }

    setSearchResult(data)
  }

  const addAdmin = async () => {
    if (!searchResult) return

    setAdding(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: true })
        .eq('id', searchResult.id)

      if (error) throw error

      showToast(t('adminAdded', { email: searchResult.email }), 'success')
      setNewAdminEmail('')
      setSearchResult(null)
      await loadAdmins()
    } catch (error) {
      console.error('Error adding admin:', error)
      showToast(t('addAdminError'), 'error')
    } finally {
      setAdding(false)
    }
  }

  const removeAdmin = async (admin: AdminUser) => {
    if (admin.id === currentUser?.id) {
      showToast(t('cannotRemoveSelf'), 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: false })
        .eq('id', admin.id)

      if (error) throw error

      showToast(t('adminRemoved', { email: admin.email }), 'success')
      setConfirmDelete(null)
      await loadAdmins()
    } catch (error) {
      console.error('Error removing admin:', error)
      showToast(t('removeAdminError'), 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t('adminManagement')}</h1>
              <p className="text-sm text-gray-500">
                {t('currentAdminCount', { count: admins.length })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus size={20} className="text-violet-600" />
            {t('addAdmin')}
          </h2>

          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => {
                setNewAdminEmail(e.target.value)
                setSearchResult(null)
                setSearchError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && searchUserByEmail()}
              placeholder={t('addAdminEmailPlaceholder')}
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
            <button
              onClick={searchUserByEmail}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
            >
              <Search size={18} />
              {t('search')}
            </button>
          </div>

          {searchError && (
            <p className="text-red-500 text-sm mb-3">{searchError}</p>
          )}

          {searchResult && (
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{searchResult.email}</p>
                {searchResult.name && (
                  <p className="text-sm text-gray-500">{searchResult.name}</p>
                )}
              </div>
              <button
                onClick={addAdmin}
                disabled={adding}
                className="px-4 py-2 bg-violet-100 hover:bg-violet-200 disabled:bg-violet-400 text-white rounded-lg transition flex items-center gap-2"
              >
                <Shield size={18} />
                {adding ? t('addingAdmin') : t('addAsAdmin')}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            {t('currentAdmins', { count: admins.length })}
          </h2>

          <div className="space-y-3">
            {admins.map((admin) => {
              const isCurrentUser = admin.id === currentUser?.id

              return (
                <div
                  key={admin.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCurrentUser ? 'bg-blue-100' : 'bg-gray-400'
                    }`}>
                      {isCurrentUser ? (
                        <Crown size={20} className="text-white" />
                      ) : (
                        <Shield size={20} className="text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{admin.email}</p>
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {t('me')}
                          </span>
                        )}
                      </div>
                      {admin.name && (
                        <p className="text-sm text-gray-500">{admin.name}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {t('signupDate', { date: new Date(admin.created_at || '').toLocaleDateString() })}
                      </p>
                    </div>
                  </div>

                  {!isCurrentUser && (
                    <button
                      onClick={() => setConfirmDelete(admin)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title={t('removeAdminTitle')}
                    >
                      <ShieldOff size={20} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {admins.length === 0 && (
            <p className="text-center text-gray-500 py-8">{t('noAdmins')}</p>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">{t('adminPermissionNotice')}</p>
              <ul className="list-disc list-inside space-y-1 text-yellow-700">
                <li>{t('adminNotice1')}</li>
                <li>{t('adminNotice2')}</li>
                <li>{t('adminNotice3')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <ShieldOff className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{t('removeAdminTitle')}</h3>
                <p className="text-sm text-gray-500">{t('removeAdminReversible')}</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              {t('removeAdminConfirm', { email: confirmDelete.email })}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => removeAdmin(confirmDelete)}
                className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
              >
                {t('removePermission')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg text-white font-medium z-50 ${
          toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
