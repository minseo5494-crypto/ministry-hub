'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { VerifiedPublisher, PublisherAccount } from '@/lib/supabase'
import {
  ArrowLeft, Plus, Trash2, Building2, Users, Mail,
  Globe, Edit, X, Check, ChevronDown, ChevronUp, UserPlus
} from 'lucide-react'

export default function PublishersPage() {
  const router = useRouter()
  const t = useTranslations('admin')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [publishers, setPublishers] = useState<VerifiedPublisher[]>([])

  const [showAddForm, setShowAddForm] = useState(false)
  const [newPublisher, setNewPublisher] = useState({
    name: '',
    description: '',
    contact_email: '',
    website_url: ''
  })
  const [adding, setAdding] = useState(false)

  const [showAccountModal, setShowAccountModal] = useState(false)
  const [selectedPublisher, setSelectedPublisher] = useState<VerifiedPublisher | null>(null)
  const [newAccountEmail, setNewAccountEmail] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)

  const [expandedPublishers, setExpandedPublishers] = useState<Set<string>>(new Set())

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert(t('loginRequired'))
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()

      if (error || !userData?.is_admin) {
        alert(t('adminRequired'))
        router.push('/')
        return
      }

      setUser(currentUser)
      await loadPublishers()
    } catch (error) {
      console.error('Error checking admin:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadPublishers = async () => {
    const { data, error } = await supabase
      .from('verified_publishers')
      .select(`
        *,
        publisher_accounts (*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading publishers:', error)
      return
    }

    const publishersWithCount = (data || []).map(p => ({
      ...p,
      accounts: p.publisher_accounts || [],
      account_count: p.publisher_accounts?.length || 0
    }))

    setPublishers(publishersWithCount)
  }

  const addPublisherFn = async () => {
    if (!newPublisher.name.trim()) {
      alert(t('publisherNameRequired'))
      return
    }

    setAdding(true)
    try {
      const { error } = await supabase
        .from('verified_publishers')
        .insert({
          name: newPublisher.name.trim(),
          description: newPublisher.description.trim() || null,
          contact_email: newPublisher.contact_email.trim() || null,
          website_url: newPublisher.website_url.trim() || null,
          created_by: user.id
        })

      if (error) throw error

      setNewPublisher({ name: '', description: '', contact_email: '', website_url: '' })
      setShowAddForm(false)
      await loadPublishers()
      alert(t('uploaderAdded'))
    } catch (error) {
      console.error('Error adding publisher:', error)
      alert(t('publisherAddError'))
    } finally {
      setAdding(false)
    }
  }

  const togglePublisherActive = async (publisher: VerifiedPublisher) => {
    try {
      const { error } = await supabase
        .from('verified_publishers')
        .update({ is_active: !publisher.is_active })
        .eq('id', publisher.id)

      if (error) throw error
      await loadPublishers()
    } catch (error) {
      console.error('Error toggling publisher:', error)
      alert(t('statusChangeError'))
    }
  }

  const deletePublisher = async (publisher: VerifiedPublisher) => {
    if (!confirm(t('publisherDeleteConfirm', { name: publisher.name }))) {
      return
    }

    try {
      const { error } = await supabase
        .from('verified_publishers')
        .delete()
        .eq('id', publisher.id)

      if (error) throw error
      await loadPublishers()
      alert(t('deleted'))
    } catch (error) {
      console.error('Error deleting publisher:', error)
      alert(t('deleteErrorGeneric'))
    }
  }

  const openAccountModal = (publisher: VerifiedPublisher) => {
    setSelectedPublisher(publisher)
    setNewAccountEmail('')
    setShowAccountModal(true)
  }

  const addAccount = async () => {
    if (!selectedPublisher || !newAccountEmail.trim()) {
      alert(t('emailRequired2'))
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newAccountEmail)) {
      alert(t('invalidEmail'))
      return
    }

    setAddingAccount(true)
    try {
      const { data: existing } = await supabase
        .from('publisher_accounts')
        .select('id')
        .eq('email', newAccountEmail.trim().toLowerCase())
        .single()

      if (existing) {
        alert(t('alreadyLinkedOther'))
        setAddingAccount(false)
        return
      }

      const { error } = await supabase
        .from('publisher_accounts')
        .insert({
          publisher_id: selectedPublisher.id,
          email: newAccountEmail.trim().toLowerCase(),
          created_by: user.id
        })

      if (error) throw error

      const { data: uploaderUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', newAccountEmail.trim().toLowerCase())
        .single()

      if (uploaderUser) {
        await supabase
          .from('songs')
          .update({
            is_official: true,
            publisher_id: selectedPublisher.id
          })
          .eq('uploaded_by', uploaderUser.id)
      }

      setNewAccountEmail('')
      setShowAccountModal(false)
      await loadPublishers()
      alert(t('accountAdded'))
    } catch (error) {
      console.error('Error adding account:', error)
      alert(t('accountAddError'))
    } finally {
      setAddingAccount(false)
    }
  }

  const removeAccount = async (account: PublisherAccount) => {
    if (!confirm(t('accountDeleteConfirm', { email: account.email }))) {
      return
    }

    try {
      const { data: uploaderUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', account.email)
        .single()

      if (uploaderUser) {
        await supabase
          .from('songs')
          .update({
            is_official: false,
            publisher_id: null
          })
          .eq('uploaded_by', uploaderUser.id)
          .eq('publisher_id', account.publisher_id)
      }

      const { error } = await supabase
        .from('publisher_accounts')
        .delete()
        .eq('id', account.id)

      if (error) throw error
      await loadPublishers()
    } catch (error) {
      console.error('Error removing account:', error)
      alert(t('deleteErrorGeneric'))
    }
  }

  const toggleExpand = (publisherId: string) => {
    const newExpanded = new Set(expandedPublishers)
    if (newExpanded.has(publisherId)) {
      newExpanded.delete(publisherId)
    } else {
      newExpanded.add(publisherId)
    }
    setExpandedPublishers(newExpanded)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg touch-manipulation"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="text-purple-600" />
                {t('publisherManagement')}
              </h1>
              <p className="text-sm text-gray-600">
                {t('publisherManagementDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Plus size={20} />
                {t('addNewPublisher')}
              </h2>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-2"
                >
                  <Plus size={18} />
                  {t('add')}
                </button>
              )}
            </div>
          </div>

          {showAddForm && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('publisherNameLabel')} *
                  </label>
                  <input
                    type="text"
                    value={newPublisher.name}
                    onChange={(e) => setNewPublisher({ ...newPublisher, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('contactEmailLabel')}
                  </label>
                  <input
                    type="email"
                    value={newPublisher.contact_email}
                    onChange={(e) => setNewPublisher({ ...newPublisher, contact_email: e.target.value })}
                    placeholder="contact@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('descriptionFieldLabel')}
                  </label>
                  <input
                    type="text"
                    value={newPublisher.description}
                    onChange={(e) => setNewPublisher({ ...newPublisher, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('websiteUrlLabel')}
                  </label>
                  <input
                    type="url"
                    value={newPublisher.website_url}
                    onChange={(e) => setNewPublisher({ ...newPublisher, website_url: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={addPublisherFn}
                  disabled={adding || !newPublisher.name.trim()}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {adding ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      {t('adding')}
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      {t('add')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 size={20} />
                {t('publisherListCount', { count: publishers.length })}
              </h2>
            </div>
          </div>
          <div className="p-6">
            {publishers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
                <p>{t('noPublishers')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {publishers.map((publisher) => (
                  <div
                    key={publisher.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div
                      className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
                        publisher.is_active ? 'bg-white' : 'bg-gray-100'
                      }`}
                      onClick={() => toggleExpand(publisher.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          publisher.is_active ? 'bg-purple-100' : 'bg-gray-200'
                        }`}>
                          <Building2 size={24} className={publisher.is_active ? 'text-purple-600' : 'text-gray-400'} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {publisher.name}
                            </span>
                            {!publisher.is_active && (
                              <span className="px-2 py-0.5 bg-gray-300 text-gray-600 text-xs rounded">
                                {t('inactive')}
                              </span>
                            )}
                          </div>
                          {publisher.description && (
                            <p className="text-sm text-gray-600">{publisher.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              {t('accountCount', { count: publisher.account_count })}
                            </span>
                            {publisher.contact_email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} />
                                {publisher.contact_email}
                              </span>
                            )}
                            {publisher.website_url && (
                              <a
                                href={publisher.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe size={12} />
                                Web
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openAccountModal(publisher)
                          }}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                          title={t('addAccount')}
                        >
                          <UserPlus size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePublisherActive(publisher)
                          }}
                          className={`p-2 rounded-lg ${
                            publisher.is_active
                              ? 'text-yellow-600 hover:bg-yellow-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={publisher.is_active ? t('deactivate') : t('activate')}
                        >
                          {publisher.is_active ? <X size={18} /> : <Check size={18} />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePublisher(publisher)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title={t('delete')}
                        >
                          <Trash2 size={18} />
                        </button>
                        {expandedPublishers.has(publisher.id) ? (
                          <ChevronUp size={20} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedPublishers.has(publisher.id) && (
                      <div className="border-t bg-gray-50 p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('manageLinkedAccounts')}</h4>
                        {publisher.accounts && publisher.accounts.length > 0 ? (
                          <div className="space-y-2">
                            {publisher.accounts.map((account: PublisherAccount) => (
                              <div
                                key={account.id}
                                className="flex items-center justify-between p-3 bg-white rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <Mail size={16} className="text-gray-400" />
                                  <span className="text-sm text-gray-900">{account.email}</span>
                                </div>
                                <button
                                  onClick={() => removeAccount(account)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">
                            {t('noLinkedAccounts')}
                          </p>
                        )}
                        <button
                          onClick={() => openAccountModal(publisher)}
                          className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-500 hover:text-purple-600 flex items-center justify-center gap-2"
                        >
                          <Plus size={16} />
                          {t('addAccount')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAccountModal && selectedPublisher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('addAccount')} - {selectedPublisher.name}
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('emailLabel')}
              </label>
              <input
                type="email"
                value={newAccountEmail}
                onChange={(e) => setNewAccountEmail(e.target.value)}
                placeholder={t('accountEmailPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                autoFocus
              />
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                {t('cancel')}
              </button>
              <button
                onClick={addAccount}
                disabled={addingAccount || !newAccountEmail.trim()}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {addingAccount ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    {t('adding')}
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    {t('add')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
