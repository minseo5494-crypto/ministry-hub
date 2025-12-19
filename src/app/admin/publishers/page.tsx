'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { VerifiedPublisher, PublisherAccount } from '@/lib/types'
import {
  ArrowLeft, Plus, Trash2, Building2, Users, Mail,
  Globe, Edit, X, Check, ChevronDown, ChevronUp, UserPlus
} from 'lucide-react'

export default function PublishersPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [publishers, setPublishers] = useState<VerifiedPublisher[]>([])

  // 새 퍼블리셔 추가 폼
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPublisher, setNewPublisher] = useState({
    name: '',
    description: '',
    contact_email: '',
    website_url: ''
  })
  const [adding, setAdding] = useState(false)

  // 계정 추가 모달
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [selectedPublisher, setSelectedPublisher] = useState<VerifiedPublisher | null>(null)
  const [newAccountEmail, setNewAccountEmail] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)

  // 펼쳐진 퍼블리셔 목록
  const [expandedPublishers, setExpandedPublishers] = useState<Set<string>>(new Set())

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()

      if (error || !userData?.is_admin) {
        alert('관리자 권한이 필요합니다.')
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

  const addPublisher = async () => {
    if (!newPublisher.name.trim()) {
      alert('퍼블리셔 이름을 입력해주세요.')
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
      alert('퍼블리셔가 추가되었습니다.')
    } catch (error) {
      console.error('Error adding publisher:', error)
      alert('추가 중 오류가 발생했습니다.')
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
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  const deletePublisher = async (publisher: VerifiedPublisher) => {
    if (!confirm(`"${publisher.name}" 퍼블리셔를 삭제하시겠습니까?\n\n연결된 모든 계정 정보도 함께 삭제됩니다.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('verified_publishers')
        .delete()
        .eq('id', publisher.id)

      if (error) throw error
      await loadPublishers()
      alert('삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting publisher:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const openAccountModal = (publisher: VerifiedPublisher) => {
    setSelectedPublisher(publisher)
    setNewAccountEmail('')
    setShowAccountModal(true)
  }

  const addAccount = async () => {
    if (!selectedPublisher || !newAccountEmail.trim()) {
      alert('이메일을 입력해주세요.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newAccountEmail)) {
      alert('올바른 이메일 형식을 입력해주세요.')
      return
    }

    setAddingAccount(true)
    try {
      // 이미 등록된 계정인지 확인
      const { data: existing } = await supabase
        .from('publisher_accounts')
        .select('id')
        .eq('email', newAccountEmail.trim().toLowerCase())
        .single()

      if (existing) {
        alert('이미 다른 퍼블리셔에 등록된 이메일입니다.')
        setAddingAccount(false)
        return
      }

      // 계정 추가
      const { error } = await supabase
        .from('publisher_accounts')
        .insert({
          publisher_id: selectedPublisher.id,
          email: newAccountEmail.trim().toLowerCase(),
          created_by: user.id
        })

      if (error) throw error

      // 해당 사용자의 곡들을 공식으로 마킹
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
      alert('계정이 추가되었습니다.')
    } catch (error) {
      console.error('Error adding account:', error)
      alert('계정 추가 중 오류가 발생했습니다.')
    } finally {
      setAddingAccount(false)
    }
  }

  const removeAccount = async (account: PublisherAccount) => {
    if (!confirm(`"${account.email}" 계정을 삭제하시겠습니까?`)) {
      return
    }

    try {
      // 해당 사용자의 곡들을 비공식으로 변경
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
      alert('삭제 중 오류가 발생했습니다.')
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
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
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
                공식 퍼블리셔 관리
              </h1>
              <p className="text-sm text-gray-600">
                팀/기관 계정을 등록하면 해당 계정이 올린 곡은 자동으로 공식 악보로 표시됩니다
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 새 퍼블리셔 추가 버튼/폼 */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Plus size={20} />
                새 퍼블리셔 추가
              </h2>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Plus size={18} />
                  추가
                </button>
              )}
            </div>
          </div>

          {showAddForm && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    퍼블리셔 이름 *
                  </label>
                  <input
                    type="text"
                    value={newPublisher.name}
                    onChange={(e) => setNewPublisher({ ...newPublisher, name: e.target.value })}
                    placeholder="예: 마커스워십"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처 이메일
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
                    설명
                  </label>
                  <input
                    type="text"
                    value={newPublisher.description}
                    onChange={(e) => setNewPublisher({ ...newPublisher, description: e.target.value })}
                    placeholder="퍼블리셔에 대한 간단한 설명"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    웹사이트 URL
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
                  취소
                </button>
                <button
                  onClick={addPublisher}
                  disabled={adding || !newPublisher.name.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {adding ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      추가 중...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      추가
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 퍼블리셔 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 size={20} />
                등록된 퍼블리셔
              </h2>
              <span className="text-sm text-gray-500">
                총 {publishers.length}개
              </span>
            </div>
          </div>
          <div className="p-6">
            {publishers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
                <p>등록된 퍼블리셔가 없습니다.</p>
                <p className="text-sm mt-1">위에서 새 퍼블리셔를 추가해주세요.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {publishers.map((publisher) => (
                  <div
                    key={publisher.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* 퍼블리셔 헤더 */}
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
                                비활성
                              </span>
                            )}
                          </div>
                          {publisher.description && (
                            <p className="text-sm text-gray-600">{publisher.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              {publisher.account_count}개 계정
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
                                웹사이트
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
                          title="계정 추가"
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
                          title={publisher.is_active ? '비활성화' : '활성화'}
                        >
                          {publisher.is_active ? <X size={18} /> : <Check size={18} />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePublisher(publisher)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="삭제"
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

                    {/* 계정 목록 */}
                    {expandedPublishers.has(publisher.id) && (
                      <div className="border-t bg-gray-50 p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">연결된 계정</h4>
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
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                    {account.role === 'admin' ? '관리자' : '멤버'}
                                  </span>
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
                            연결된 계정이 없습니다.
                          </p>
                        )}
                        <button
                          onClick={() => openAccountModal(publisher)}
                          className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-500 hover:text-purple-600 flex items-center justify-center gap-2"
                        >
                          <Plus size={16} />
                          계정 추가
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 안내 */}
        <div className="mt-8 p-4 bg-purple-50 rounded-lg">
          <h3 className="font-medium text-purple-900 mb-2">공식 퍼블리셔 안내</h3>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• 퍼블리셔에 연결된 계정이 업로드한 곡은 자동으로 공식 악보로 표시됩니다.</li>
            <li>• 새 계정을 추가하면 해당 계정의 기존 곡들도 공식으로 변경됩니다.</li>
            <li>• 퍼블리셔를 비활성화해도 기존 곡의 공식 상태는 유지됩니다.</li>
            <li>• 계정을 삭제하면 해당 계정의 곡들은 비공식으로 변경됩니다.</li>
          </ul>
        </div>
      </div>

      {/* 계정 추가 모달 */}
      {showAccountModal && selectedPublisher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                계정 추가 - {selectedPublisher.name}
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일 주소
              </label>
              <input
                type="email"
                value={newAccountEmail}
                onChange={(e) => setNewAccountEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                사용자가 로그인에 사용하는 이메일과 동일해야 합니다.
              </p>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={addAccount}
                disabled={addingAccount || !newAccountEmail.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {addingAccount ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    추가 중...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    추가
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
