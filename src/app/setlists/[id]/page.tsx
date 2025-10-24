'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Song } from '@/lib/supabase'
import { ArrowLeft, Edit, Trash2, Plus, FileText, Calendar, Music, X, Save } from 'lucide-react'
import Link from 'next/link'

interface SetlistSong {
  id: string
  order_number: number
  key_transposed?: string
  notes?: string
  song: Song
}

interface SetlistDetail {
  id: string
  title: string
  service_date: string
  service_type?: string
  theme?: string
  notes?: string
  folder?: {
    id: string
    name: string
  }
}

export default function SetlistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const setlistId = params.id as string

  // 상태 관리
  const [setlist, setSetlist] = useState<SetlistDetail | null>(null)
  const [songs, setSongs] = useState<SetlistSong[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // 편집 상태
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editType, setEditType] = useState('')
  const [editTheme, setEditTheme] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // 곡 추가 모달
  const [showAddSongModal, setShowAddSongModal] = useState(false)
  const [availableSongs, setAvailableSongs] = useState<Song[]>([])
  const [searchText, setSearchText] = useState('')

  // 콘티 상세 정보 가져오기
  const fetchSetlistDetail = async () => {
    setLoading(true)
    try {
      // 콘티 기본 정보
      const { data: setlistData, error: setlistError } = await supabase
        .from('setlists')
        .select(`
          *,
          folder:folders(id, name)
        `)
        .eq('id', setlistId)
        .single()

      if (setlistError) throw setlistError
      setSetlist(setlistData)

      // 편집 폼 초기값 설정
      setEditTitle(setlistData.title)
      setEditDate(setlistData.service_date)
      setEditType(setlistData.service_type || '')
      setEditTheme(setlistData.theme || '')
      setEditNotes(setlistData.notes || '')

      // 콘티에 포함된 곡들
      const { data: songsData, error: songsError } = await supabase
        .from('setlist_songs')
        .select(`
          *,
          song:songs(*)
        `)
        .eq('setlist_id', setlistId)
        .order('order_number', { ascending: true })

      if (songsError) throw songsError
      setSongs(songsData || [])

    } catch (error) {
      console.error('Error fetching setlist:', error)
      alert('콘티를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (setlistId) {
      fetchSetlistDetail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setlistId])

  // 콘티 정보 수정
  const updateSetlist = async () => {
    if (!editTitle.trim()) {
      alert('제목을 입력하세요.')
      return
    }

    try {
      const { error } = await supabase
        .from('setlists')
        .update({
          title: editTitle,
          service_date: editDate,
          service_type: editType,
          theme: editTheme,
          notes: editNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', setlistId)

      if (error) throw error

      alert('✅ 콘티가 수정되었습니다!')
      setIsEditing(false)
      fetchSetlistDetail()
    } catch (error) {
      console.error('Error updating setlist:', error)
      alert('콘티 수정에 실패했습니다.')
    }
  }

  // 콘티 삭제
  const deleteSetlist = async () => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('setlists')
        .delete()
        .eq('id', setlistId)

      if (error) throw error

      alert('✅ 콘티가 삭제되었습니다.')
      router.push('/setlists')
    } catch (error) {
      console.error('Error deleting setlist:', error)
      alert('콘티 삭제에 실패했습니다.')
    }
  }

  // 곡 삭제
  const removeSong = async (setlistSongId: string) => {
    if (!confirm('이 곡을 콘티에서 제거하시겠습니까?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', setlistSongId)

      if (error) throw error

      alert('✅ 곡이 제거되었습니다.')
      fetchSetlistDetail()
    } catch (error) {
      console.error('Error removing song:', error)
      alert('곡 제거에 실패했습니다.')
    }
  }

  // 곡 순서 변경
  const reorderSong = async (setlistSongId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .update({ order_number: newOrder })
        .eq('id', setlistSongId)

      if (error) throw error

      fetchSetlistDetail()
    } catch (error) {
      console.error('Error reordering song:', error)
      alert('순서 변경에 실패했습니다.')
    }
  }

  // 곡 위로 이동
  const moveSongUp = (index: number) => {
    if (index === 0) return
    const currentSong = songs[index]
    const previousSong = songs[index - 1]
    reorderSong(currentSong.id, index)
    reorderSong(previousSong.id, index + 1)
  }

  // 곡 아래로 이동
  const moveSongDown = (index: number) => {
    if (index === songs.length - 1) return
    const currentSong = songs[index]
    const nextSong = songs[index + 1]
    reorderSong(currentSong.id, index + 2)
    reorderSong(nextSong.id, index + 1)
  }

  // 곡 추가 모달 열기
  const openAddSongModal = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('song_name', { ascending: true })
        .limit(500)

      if (error) throw error
      setAvailableSongs(data || [])
      setShowAddSongModal(true)
    } catch (error) {
      console.error('Error fetching songs:', error)
      alert('곡 목록을 불러오는데 실패했습니다.')
    }
  }

  // 곡 추가
  const addSongToSetlist = async (song: Song) => {
    try {
      const maxOrder = songs.length > 0 ? Math.max(...songs.map(s => s.order_number)) : 0

      const { error } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: setlistId,
          song_id: song.id,
          order_number: maxOrder + 1
        })

      if (error) throw error

      alert(`✅ "${song.song_name}"이(가) 추가되었습니다!`)
      setShowAddSongModal(false)
      setSearchText('')
      fetchSetlistDetail()
    } catch (error) {
      console.error('Error adding song:', error)
      alert('곡 추가에 실패했습니다.')
    }
  }

  // PDF 생성
  const generatePDF = async () => {
    if (songs.length === 0) {
      alert('콘티에 곡이 없습니다.')
      return
    }

    try {
      const pdfLib = await import('pdf-lib')
      const PDFDocument = pdfLib.PDFDocument
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const html2canvas = (await import('html2canvas')).default

      const mergedPdf = await PDFDocument.create()

      // 표지 페이지
      const coverDiv = document.createElement('div')
      coverDiv.style.cssText = `
        width: 210mm;
        height: 297mm;
        padding: 60px;
        background-color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-sizing: border-box;
      `

      coverDiv.innerHTML = `
        <div style="text-align: center;">
          <h1 style="font-size: 48px; font-weight: bold; color: #1a202c; margin: 40px 0 20px 0;">
            ${setlist?.title || '찬양 콘티'}
          </h1>
          <p style="font-size: 28px; color: #4a5568; margin-bottom: 60px;">
            ${new Date(setlist?.service_date || '').toLocaleDateString('ko-KR')}
          </p>
          ${setlist?.service_type ? `
            <p style="font-size: 24px; color: #4a5568; margin-bottom: 20px;">
              ${setlist.service_type}
            </p>
          ` : ''}
        </div>
        
        <div style="margin-top: 80px;">
          <h2 style="font-size: 32px; font-weight: 600; color: #2d3748; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
            찬양 목록
          </h2>
          <div style="font-size: 24px; line-height: 2.5; color: #1a202c;">
            ${songs.map((item, index) => `
              <div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="font-weight: 600; color: #3b82f6; margin-right: 15px;">
                  ${index + 1}.
                </span>
                <span style="font-weight: 500;">
                  ${item.song.song_name}
                </span>
                <span style="color: #718096; margin-left: 10px;">
                  (${item.song.key || '-'})
                </span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="position: absolute; bottom: 60px; left: 60px; right: 60px; text-align: center; color: #a0aec0; font-size: 18px;">
          총 ${songs.length}곡
        </div>
      `

      coverDiv.style.position = 'fixed'
      coverDiv.style.left = '-9999px'
      document.body.appendChild(coverDiv)

      const canvas = await html2canvas(coverDiv, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      })

      document.body.removeChild(coverDiv)

      const coverPdf = new jsPDF('p', 'mm', 'a4')
      const imgData = canvas.toDataURL('image/png')
      coverPdf.addImage(imgData, 'PNG', 0, 0, 210, 297)

      const coverPdfBytes = coverPdf.output('arraybuffer')
      const coverDoc = await PDFDocument.load(coverPdfBytes)
      const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices())
      coverPages.forEach(page => mergedPdf.addPage(page))

      // 악보 추가
      const songsWithSheets = songs.filter(item => item.song.file_url && item.song.file_url.trim() !== '')

      if (songsWithSheets.length === 0) {
        alert('⚠️ 악보가 업로드된 곡이 없습니다. 표지만 다운로드됩니다.')
      }

      for (const item of songsWithSheets) {
        const song = item.song
        try {
          const response = await fetch(song.file_url!)
          if (!response.ok) continue

          const fileType = song.file_type || 'pdf'

          if (fileType === 'pdf') {
            const arrayBuffer = await response.arrayBuffer()
            const sheetPdf = await PDFDocument.load(arrayBuffer)
            const copiedPages = await mergedPdf.copyPages(sheetPdf, sheetPdf.getPageIndices())
            copiedPages.forEach(page => mergedPdf.addPage(page))
          } else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
            const imageBytes = await response.arrayBuffer()
            let image

            if (fileType === 'png') {
              image = await mergedPdf.embedPng(imageBytes)
            } else {
              image = await mergedPdf.embedJpg(imageBytes)
            }

            const page = mergedPdf.addPage([image.width, image.height])
            page.drawImage(image, {
              x: 0,
              y: 0,
              width: image.width,
              height: image.height,
            })
          }
        } catch (error) {
          console.error(`${song.song_name} 처리 중 오류:`, error)
        }
      }

      // PDF 다운로드
      const pdfBytes = await mergedPdf.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${setlist?.title || '찬양콘티'}_${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      alert(`✅ PDF가 생성되었습니다!`)
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다.')
    }
  }

  // 검색된 곡 필터링
  const filteredAvailableSongs = availableSongs.filter(song => {
    if (!searchText) return true
    return song.song_name.toLowerCase().includes(searchText.toLowerCase()) ||
           song.team_name?.toLowerCase().includes(searchText.toLowerCase())
  }).filter(song => {
    // 이미 추가된 곡은 제외
    return !songs.some(s => s.song.id === song.id)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!setlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">콘티를 찾을 수 없습니다.</p>
          <Link href="/setlists">
            <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg">
              콘티 목록으로
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/setlists">
              <button className="flex items-center text-gray-600 hover:text-gray-800">
                <ArrowLeft className="mr-2" size={20} />
                콘티 목록으로
              </button>
            </Link>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditTitle(setlist.title)
                      setEditDate(setlist.service_date)
                      setEditType(setlist.service_type || '')
                      setEditTheme(setlist.theme || '')
                      setEditNotes(setlist.notes || '')
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center"
                  >
                    <X className="mr-2" size={18} />
                    취소
                  </button>
                  <button
                    onClick={updateSetlist}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
                  >
                    <Save className="mr-2" size={18} />
                    저장
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                  >
                    <Edit className="mr-2" size={18} />
                    편집
                  </button>
                  <button
                    onClick={deleteSetlist}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center"
                  >
                    <Trash2 className="mr-2" size={18} />
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {isEditing ? (
            // 편집 모드
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">예배 유형</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택 안함</option>
                    <option value="주일예배">주일예배</option>
                    <option value="수요예배">수요예배</option>
                    <option value="금요예배">금요예배</option>
                    <option value="새벽기도">새벽기도</option>
                    <option value="청년부">청년부</option>
                    <option value="중고등부">중고등부</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">테마</label>
                <input
                  type="text"
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  placeholder="예: 감사, 찬양, 경배..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          ) : (
            // 보기 모드
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-3">{setlist.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="mr-2" size={16} />
                  {new Date(setlist.service_date).toLocaleDateString('ko-KR')}
                </div>
                {setlist.service_type && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {setlist.service_type}
                  </span>
                )}
                {setlist.theme && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                    테마: {setlist.theme}
                  </span>
                )}
                {setlist.folder && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                    📁 {setlist.folder.name}
                  </span>
                )}
              </div>
              {setlist.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{setlist.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 곡 목록 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              <Music className="inline-block mr-2 mb-1" />
              찬양 목록 ({songs.length}곡)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={openAddSongModal}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
              >
                <Plus className="mr-2" size={18} />
                곡 추가
              </button>
              <button
                onClick={generatePDF}
                disabled={songs.length === 0}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  songs.length > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <FileText className="mr-2" size={18} />
                PDF 다운로드
              </button>
            </div>
          </div>

          {songs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Music size={48} className="mx-auto mb-4 text-gray-300" />
              <p>콘티에 곡이 없습니다.</p>
              <p className="text-sm mt-2">곡 추가 버튼을 눌러 찬양을 추가하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {songs.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold text-blue-600">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {item.song.song_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {item.song.team_name && `${item.song.team_name} | `}
                            Key: {item.song.key || '-'} | 
                            BPM: {item.song.bpm || '-'}
                            {item.song.tempo && ` | ${item.song.tempo}`}
                          </p>
                        </div>
                      </div>
                      {item.song.file_url ? (
                        <span className="text-xs text-green-600">✓ 악보 있음</span>
                      ) : (
                        <span className="text-xs text-gray-400">악보 없음</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => moveSongUp(index)}
                        disabled={index === 0}
                        className={`p-2 rounded ${
                          index === 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="위로"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveSongDown(index)}
                        disabled={index === songs.length - 1}
                        className={`p-2 rounded ${
                          index === songs.length - 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="아래로"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => removeSong(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 곡 추가 모달 */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">곡 추가</h2>
                <button
                  onClick={() => {
                    setShowAddSongModal(false)
                    setSearchText('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              <input
                type="text"
                placeholder="곡 제목이나 팀명으로 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {filteredAvailableSongs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {searchText ? '검색 결과가 없습니다.' : '모든 곡이 이미 추가되었습니다.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableSongs.slice(0, 50).map(song => (
                    <div
                      key={song.id}
                      onClick={() => addSongToSetlist(song)}
                      className="p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition"
                    >
                      <h3 className="font-medium text-gray-800">{song.song_name}</h3>
                      <p className="text-sm text-gray-600">
                        {song.team_name && `${song.team_name} | `}
                        Key: {song.key || '-'} | BPM: {song.bpm || '-'}
                      </p>
                    </div>
                  ))}
                  {filteredAvailableSongs.length > 50 && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      상위 50개만 표시됩니다. 더 구체적으로 검색해주세요.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}