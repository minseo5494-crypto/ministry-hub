'use client'

import { useState, useEffect } from 'react'
import { supabase, Folder, Setlist, SetlistWithSongs } from '@/lib/supabase'
import { FolderOpen, Plus, Calendar, Music, ChevronRight, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function SetlistsPage() {
  // 현재 사용자 (임시로 하드코딩)
  const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001'

  // 상태 관리
  const [folders, setFolders] = useState<Folder[]>([])
  const [setlists, setSetlists] = useState<SetlistWithSongs[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  // 폴더 모달
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderType, setNewFolderType] = useState<'church' | 'department'>('church')
  const [parentFolderId, setParentFolderId] = useState<string | null>(null)

  // 데이터 불러오기
  useEffect(() => {
    fetchFolders()
    fetchSetlists()
  }, [])

  // 폴더 목록 가져오기
  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', TEMP_USER_ID)
        .order('type', { ascending: true })
        .order('order_number', { ascending: true })

      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
      alert('폴더를 불러오는데 실패했습니다.')
    }
  }

  // 콘티 목록 가져오기
  const fetchSetlists = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select(`
          *,
          folder:folders(*)
        `)
        .eq('user_id', TEMP_USER_ID)
        .order('service_date', { ascending: false })
        .limit(20)

      if (error) throw error
      setSetlists(data || [])
    } catch (error) {
      console.error('Error fetching setlists:', error)
      alert('콘티를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 폴더 생성
  const createFolder = async () => {
    if (!newFolderName.trim()) {
      alert('폴더 이름을 입력하세요.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: TEMP_USER_ID,
          name: newFolderName,
          type: newFolderType,
          parent_id: parentFolderId,
          order_number: folders.length
        })
        .select()

      if (error) throw error

      alert('폴더가 생성되었습니다!')
      setShowFolderModal(false)
      setNewFolderName('')
      setParentFolderId(null)
      fetchFolders()
    } catch (error) {
      console.error('Error creating folder:', error)
      alert('폴더 생성에 실패했습니다.')
    }
  }

  // 폴더 삭제
  const deleteFolder = async (folderId: string) => {
    if (!confirm('정말 삭제하시겠습니까? 이 폴더 안의 하위 폴더와 콘티는 폴더 없음으로 이동됩니다.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)

      if (error) throw error

      alert('폴더가 삭제되었습니다.')
      fetchFolders()
      fetchSetlists()
    } catch (error) {
      console.error('Error deleting folder:', error)
      alert('폴더 삭제에 실패했습니다.')
    }
  }

  // 콘티 삭제
  const deleteSetlist = async (setlistId: string, e: React.MouseEvent) => {
    e.preventDefault() // Link 이동 방지
    e.stopPropagation()
    
    if (!confirm('정말 삭제하시겠습니까?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('setlists')
        .delete()
        .eq('id', setlistId)

      if (error) throw error

      alert('콘티가 삭제되었습니다.')
      fetchSetlists()
    } catch (error) {
      console.error('Error deleting setlist:', error)
      alert('콘티 삭제에 실패했습니다.')
    }
  }

  // 교회 폴더와 부서 폴더 분리
  const churchFolders = folders.filter(f => f.type === 'church')
  const getDepartmentFolders = (parentId: string) => 
    folders.filter(f => f.type === 'department' && f.parent_id === parentId)

  // 필터링된 콘티
  const filteredSetlists = selectedFolderId
    ? setlists.filter(s => s.folder_id === selectedFolderId)
    : setlists

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                <FolderOpen className="inline-block mr-2 mb-1" />
                내 콘티 관리
              </h1>
              <p className="text-gray-600">예배별 찬양 콘티를 관리하세요</p>
            </div>
            <div className="flex gap-2">
              <Link href="/">
                <button className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                  ← 홈으로
                </button>
              </Link>
              <button
                onClick={() => setShowFolderModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
              >
                <Plus className="mr-2" size={20} />
                새 폴더
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 폴더 구조 */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">폴더</h2>

            {/* 전체 보기 */}
            <div
              onClick={() => setSelectedFolderId(null)}
              className={`p-3 rounded-lg cursor-pointer mb-2 ${
                selectedFolderId === null
                  ? 'bg-blue-100 border-2 border-blue-500'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center">
                <FolderOpen className="mr-2" size={20} />
                <span className="font-medium">전체 콘티</span>
                <span className="ml-auto text-sm text-gray-600">({setlists.length})</span>
              </div>
            </div>

            {/* 교회별 폴더 */}
            {churchFolders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>폴더가 없습니다.</p>
                <p className="text-sm mt-2">새 폴더를 만들어보세요!</p>
              </div>
            ) : (
              churchFolders.map(churchFolder => (
                <div key={churchFolder.id} className="mb-4">
                  {/* 교회 폴더 */}
                  <div
                    onClick={() => setSelectedFolderId(churchFolder.id)}
                    className={`p-3 rounded-lg cursor-pointer ${
                      selectedFolderId === churchFolder.id
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FolderOpen className="mr-2" size={20} style={{ color: churchFolder.color }} />
                        <span className="font-medium">{churchFolder.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          ({setlists.filter(s => s.folder_id === churchFolder.id).length})
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setParentFolderId(churchFolder.id)
                            setNewFolderType('department')
                            setShowFolderModal(true)
                          }}
                          className="p-1 hover:bg-blue-200 rounded"
                          title="부서 추가"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteFolder(churchFolder.id)
                          }}
                          className="p-1 hover:bg-red-200 rounded text-red-600"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 부서 폴더 (하위) */}
                  {getDepartmentFolders(churchFolder.id).map(deptFolder => (
                    <div
                      key={deptFolder.id}
                      onClick={() => setSelectedFolderId(deptFolder.id)}
                      className={`ml-6 mt-2 p-2 rounded-lg cursor-pointer ${
                        selectedFolderId === deptFolder.id
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <ChevronRight className="mr-1" size={16} />
                          <FolderOpen className="mr-2" size={18} style={{ color: deptFolder.color }} />
                          <span className="text-sm font-medium">{deptFolder.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            ({setlists.filter(s => s.folder_id === deptFolder.id).length})
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFolder(deptFolder.id)
                            }}
                            className="p-1 hover:bg-red-200 rounded text-red-600"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* 오른쪽: 콘티 목록 */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedFolderId
                  ? folders.find(f => f.id === selectedFolderId)?.name + ' 콘티'
                  : '최근 콘티'}
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-gray-600">불러오는 중...</p>
              </div>
            ) : filteredSetlists.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Music size={48} className="mx-auto mb-4 text-gray-300" />
                <p>콘티가 없습니다.</p>
                <p className="text-sm mt-2">메인 페이지에서 곡을 선택하고 콘티를 만들어보세요!</p>
                <Link href="/">
                  <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    곡 검색하러 가기
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
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
                value={newFolderType}
                onChange={(e) => setNewFolderType(e.target.value as 'church' | 'department')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={parentFolderId !== null}
              >
                <option value="church">교회 (최상위)</option>
                <option value="department">부서/예배</option>
              </select>
            </div>

            {parentFolderId && (
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-800">
                  상위 폴더: {folders.find(f => f.id === parentFolderId)?.name}
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                폴더 이름
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={newFolderType === 'church' ? '예: 은혜교회' : '예: 주일 대예배'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowFolderModal(false)
                  setNewFolderName('')
                  setParentFolderId(null)
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