'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FolderOpen, Plus, Trash2, ChevronRight, Home, Calendar, ChevronDown } from 'lucide-react'
import Link from 'next/link'

export default function SetlistsPage() {
  const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001'
  
  const [setlists, setSetlists] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['all', 'church'])) // 전체 콘티 + 사랑의교회 기본 열림
  const [newFolderName, setNewFolderName] = useState('')
  
  // 폴더 생성 모달
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderColor, setFolderColor] = useState('#3B82F6')

  useEffect(() => {
    fetchSetlists()
    fetchFolders()
  }, [])

  const fetchSetlists = async () => {
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select(`
          *,
          folder:folders(*)
        `)
        .eq('user_id', TEMP_USER_ID)
        .order('service_date', { ascending: false })

      if (error) throw error
      setSetlists(data || [])
    } catch (error) {
      console.error('Error fetching setlists:', error)
      alert('콘티를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', TEMP_USER_ID)
        .order('order_number', { ascending: true })

      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
      alert('폴더를 불러오는데 실패했습니다.')
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      alert('폴더 이름을 입력해주세요.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert([
          {
            user_id: TEMP_USER_ID,
            name: newFolderName,
            type: 'church',
            color: folderColor,
            order_number: folders.length
          }
        ])
        .select()

      if (error) throw error

      setShowFolderModal(false)
      setNewFolderName('')
      setFolderColor('#3B82F6')
      fetchFolders()
    } catch (error) {
      console.error('Error creating folder:', error)
      alert('폴더 생성에 실패했습니다.')
    }
  }

  const deleteFolder = async (folderId: string) => {
    if (!confirm('이 폴더를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)

      if (error) throw error
      fetchFolders()
    } catch (error) {
      console.error('Error deleting folder:', error)
      alert('폴더 삭제에 실패했습니다.')
    }
  }

  // 폴더 열기/닫기 토글
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const deleteSetlist = async (setlistId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('이 콘티를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('setlists')
        .delete()
        .eq('id', setlistId)

      if (error) throw error
      fetchSetlists()
    } catch (error) {
      console.error('Error deleting setlist:', error)
      alert('콘티 삭제에 실패했습니다.')
    }
  }

  const churchFolders = folders.filter(f => f.type === 'church')

  const filteredSetlists = selectedFolderId === null
    ? setlists
    : setlists.filter(s => s.folder_id === selectedFolderId)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2">
                <Home size={20} />
                홈으로
              </button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">내 콘티 관리</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 왼쪽: 폴더 목록 */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">폴더</h2>
            
            {/* 🔥 전체 콘티 (최상위 - Level 1) */}
            <div>
              <button
                onClick={() => {
                  setSelectedFolderId(null)
                  toggleFolder('all')
                }}
                className={`w-full text-left p-3 rounded-lg mb-2 transition flex items-center justify-between ${
                  selectedFolderId === null
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  {expandedFolders.has('all') ? (
                    <ChevronDown className="mr-2 text-blue-500" size={20} />
                  ) : (
                    <ChevronRight className="mr-2 text-blue-500" size={20} />
                  )}
                  <FolderOpen className="mr-2 text-blue-500" size={20} />
                  <span className="font-bold text-gray-900">전체 콘티</span>
                </div>
                <span className="text-sm text-gray-700 font-bold bg-blue-500 text-white px-2 py-1 rounded-full">
                  {setlists.length}
                </span>
              </button>

              {/* 🔥 사랑의교회 폴더 (Level 2) */}
              {expandedFolders.has('all') && (
                <div className="ml-4 space-y-2 border-l-2 border-blue-200 pl-2">
                  <div>
                    <button
                      onClick={() => {
                        toggleFolder('church')
                      }}
                      className="w-full text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        {expandedFolders.has('church') ? (
                          <ChevronDown className="mr-2 text-gray-600" size={18} />
                        ) : (
                          <ChevronRight className="mr-2 text-gray-600" size={18} />
                        )}
                        <FolderOpen className="mr-2 text-orange-500" size={18} />
                        <span className="font-bold text-gray-900">사랑의교회</span>
                      </div>
                      <span className="text-xs text-gray-700 font-medium bg-gray-200 px-2 py-1 rounded-full">
                        {churchFolders.length}
                      </span>
                    </button>

                    {/* 🔥 하위 폴더들 (Level 3 - 대학1부, 청년부 등) */}
                    {expandedFolders.has('church') && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                        {churchFolders.length === 0 ? (
                          <div className="text-center py-3 text-gray-500 text-sm">
                            <p>폴더가 없습니다.</p>
                          </div>
                        ) : (
                          churchFolders.map(folder => (
                            <div
                              key={folder.id}
                              onClick={() => setSelectedFolderId(folder.id)}
                              className={`p-2 rounded-lg cursor-pointer ${
                                selectedFolderId === folder.id
                                  ? 'bg-blue-50 border-2 border-blue-400'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <FolderOpen className="mr-2" size={16} style={{ color: folder.color }} />
                                  <span className={`text-sm ${selectedFolderId === folder.id ? 'font-bold' : 'font-medium'} text-gray-900`}>
                                    {folder.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-700 font-medium bg-gray-200 px-2 py-1 rounded-full">
                                    {setlists.filter(s => s.folder_id === folder.id).length}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteFolder(folder.id)
                                    }}
                                    className="p-1 hover:bg-red-100 rounded text-red-600"
                                    title="삭제"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}

                        {/* 새 폴더 추가 버튼 */}
                        <button
                          onClick={() => setShowFolderModal(true)}
                          className="w-full p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition flex items-center justify-center font-medium text-sm"
                        >
                          <Plus size={16} className="mr-1" />
                          새 폴더 추가
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 콘티 목록 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                {selectedFolderId === null 
                  ? '전체 콘티' 
                  : folders.find(f => f.id === selectedFolderId)?.name}
              </h2>

              {filteredSetlists.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>콘티가 없습니다.</p>
                  <p className="text-sm mt-2">메인 화면에서 새 콘티를 만들어보세요!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSetlists.map(setlist => (
                    <Link key={setlist.id} href={`/setlists/${setlist.id}`}>
                      <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar size={18} className="text-gray-600" />
                              <span className="text-sm text-gray-600">
                                {new Date(setlist.service_date).toLocaleDateString('ko-KR')}
                              </span>
                              {setlist.service_type && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {setlist.service_type}
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {setlist.title}
                            </h3>
                            {setlist.theme && (
                              <p className="text-sm text-gray-600 mb-2">테마: {setlist.theme}</p>
                            )}
                            {setlist.folder && (
                              <div className="flex items-center text-sm text-gray-500">
                                <FolderOpen size={14} className="mr-1" />
                                {setlist.folder.name}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => deleteSetlist(setlist.id, e)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="삭제"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 폴더 생성 모달 */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              새 폴더 만들기
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                폴더 종류
              </label>
              <select
                value="church"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                disabled
              >
                <option value="church">사랑의교회</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                폴더 이름
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="예: 대학1부"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowFolderModal(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={createFolder}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
