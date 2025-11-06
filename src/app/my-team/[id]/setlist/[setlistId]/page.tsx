'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Song } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logDownload } from '@/lib/downloadLogger'
import { generatePDF, PDFSong } from '@/lib/pdfGenerator'
import pptxgen from 'pptxgenjs'
import { 
  ArrowLeft, Edit, Trash2, Plus, Music, X, 
  Save, Eye, ChevronUp, ChevronDown, FileText,
  Download, FileDown 
} from 'lucide-react'

interface SetlistSong {
  id: string
  order_number: number
  key_transposed?: string
  notes?: string
  selected_form?: string[]
  songs: Song
}

interface SetlistDetail {
  id: string
  title: string
  service_date: string
  service_type?: string
  notes?: string
  team_id: string
}

export default function TeamSetlistDetailPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const setlistId = params.setlistId as string

  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [setlist, setSetlist] = useState<SetlistDetail | null>(null)
  const [songs, setSongs] = useState<SetlistSong[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // 편집 상태
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editType, setEditType] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // 곡 추가 모달
  const [showAddSongModal, setShowAddSongModal] = useState(false)
  const [availableSongs, setAvailableSongs] = useState<Song[]>([])
  const [searchText, setSearchText] = useState('')

  // 미리보기
  const [previewSong, setPreviewSong] = useState<Song | null>(null)

  // 송폼 편집 모달
  const [showSongFormModal, setShowSongFormModal] = useState(false)
  const [selectedSongForForm, setSelectedSongForForm] = useState<SetlistSong | null>(null)
  const [tempSongForm, setTempSongForm] = useState<string[]>([])
  const [customFormInput, setCustomFormInput] = useState('')

  // 송폼 옵션
  const songFormOptions = [
    'Intro', 'V1', 'V2', 'V3', 'Pc', 'Pc1', 'Pc2', 'C', 'C1', 'C2',
    '간주', 'Interlude', 'B', 'Bridge', 'Out', 'Outro', 'Ending'
  ]

  // 다운로드 상태
  const [downloadingPPT, setDownloadingPPT] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && teamId && setlistId) {
      fetchSetlistDetail()
    }
  }, [user, teamId, setlistId])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setUser(currentUser)

      // 사용자 역할 확인
      const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', currentUser.id)
        .eq('status', 'active')
        .single()

      if (memberData) {
        setUserRole(memberData.role)
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    }
  }

  const fetchSetlistDetail = async () => {
    setLoading(true)
    try {
      // 콘티 기본 정보
      const { data: setlistData, error: setlistError } = await supabase
        .from('team_setlists')
        .select('*')
        .eq('id', setlistId)
        .eq('team_id', teamId)
        .single()

      if (setlistError) throw setlistError
      setSetlist(setlistData)

      setEditTitle(setlistData.title)
      setEditDate(setlistData.service_date)
      setEditType(setlistData.service_type || '')
      setEditNotes(setlistData.notes || '')

      // 콘티에 포함된 곡들
      const { data: songsData, error: songsError } = await supabase
        .from('team_setlist_songs')
        .select(`
          id,
          order_number,
          key_transposed,
          notes,
          selected_form,
          songs (*)
        `)
        .eq('setlist_id', setlistId)
        .order('order_number', { ascending: true })

      if (songsError) throw songsError
      setSongs((songsData as any) || [])
    } catch (error) {
      console.error('Error fetching setlist:', error)
      alert('콘티를 불러오는데 실패했습니다.')
      router.push(`/my-team/${teamId}`)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = () => {
    return userRole === 'leader' || userRole === 'admin'
  }

  const handleSaveEdit = async () => {
    if (!canEdit()) {
      alert('수정 권한이 없습니다.')
      return
    }

    try {
      const { error } = await supabase
        .from('team_setlists')
        .update({
          title: editTitle,
          service_date: editDate,
          service_type: editType,
          notes: editNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', setlistId)

      if (error) throw error

      alert('✅ 수정되었습니다.')
      setIsEditing(false)
      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error updating setlist:', error)
      alert(`수정 실패: ${error.message}`)
    }
  }

  const handleDeleteSetlist = async () => {
    if (!canEdit()) {
      alert('삭제 권한이 없습니다.')
      return
    }

    if (!confirm('정말 이 콘티를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('team_setlists')
        .delete()
        .eq('id', setlistId)

      if (error) throw error

      alert('✅ 삭제되었습니다.')
      router.push(`/my-team/${teamId}`)
    } catch (error: any) {
      console.error('Error deleting setlist:', error)
      alert(`삭제 실패: ${error.message}`)
    }
  }

  const moveSong = async (index: number, direction: 'up' | 'down') => {
    if (!canEdit()) {
      alert('수정 권한이 없습니다.')
      return
    }

    const newSongs = [...songs]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newSongs.length) return

    // 순서 교환
    ;[newSongs[index], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[index]]

    // DB 업데이트
    try {
      const updates = newSongs.map((song, idx) => ({
        id: song.id,
        order_number: idx + 1
      }))

      for (const update of updates) {
        await supabase
          .from('team_setlist_songs')
          .update({ order_number: update.order_number })
          .eq('id', update.id)
      }

      setSongs(newSongs)
    } catch (error) {
      console.error('Error moving song:', error)
      alert('순서 변경에 실패했습니다.')
    }
  }

  const removeSongFromSetlist = async (songId: string) => {
    if (!canEdit()) {
      alert('삭제 권한이 없습니다.')
      return
    }

    if (!confirm('이 곡을 콘티에서 제거하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('team_setlist_songs')
        .delete()
        .eq('id', songId)

      if (error) throw error

      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error removing song:', error)
      alert(`제거 실패: ${error.message}`)
    }
  }

  const openAddSongModal = async () => {
    if (!canEdit()) {
      alert('추가 권한이 없습니다.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('song_name', { ascending: true })

      if (error) throw error
      setAvailableSongs(data || [])
      setShowAddSongModal(true)
    } catch (error) {
      console.error('Error fetching songs:', error)
      alert('곡 목록을 불러오는데 실패했습니다.')
    }
  }

  const addSongToSetlist = async (song: Song) => {
    try {
      const maxOrder = songs.length > 0 
        ? Math.max(...songs.map(s => s.order_number)) 
        : 0

      const { error } = await supabase
        .from('team_setlist_songs')
        .insert({
          setlist_id: setlistId,
          song_id: song.id,
          order_number: maxOrder + 1
        })

      if (error) throw error

      setShowAddSongModal(false)
      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error adding song:', error)
      alert(`곡 추가 실패: ${error.message}`)
    }
  }

  const filteredAvailableSongs = availableSongs.filter(song =>
    song.song_name.toLowerCase().includes(searchText.toLowerCase()) ||
    song.team_name?.toLowerCase().includes(searchText.toLowerCase())
  )

  // 송폼 편집 열기
  const openSongFormModal = (song: SetlistSong) => {
    if (!canEdit()) {
      alert('수정 권한이 없습니다.')
      return
    }
    setSelectedSongForForm(song)
    setTempSongForm(song.selected_form || [])
    setCustomFormInput('')
    setShowSongFormModal(true)
  }

  // 송폼 추가
  const addSongForm = (form: string) => {
    if (!tempSongForm.includes(form)) {
      setTempSongForm([...tempSongForm, form])
    }
  }

  // 커스텀 송폼 추가
  const addCustomSongForm = () => {
    const trimmed = customFormInput.trim()
    if (trimmed && !tempSongForm.includes(trimmed)) {
      setTempSongForm([...tempSongForm, trimmed])
      setCustomFormInput('')
    }
  }

  // 송폼 제거
  const removeSongForm = (form: string) => {
    setTempSongForm(tempSongForm.filter(f => f !== form))
  }

  // 송폼 순서 변경
  const moveSongForm = (index: number, direction: 'up' | 'down') => {
    const newForms = [...tempSongForm]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newForms.length) return
    ;[newForms[index], newForms[targetIndex]] = [newForms[targetIndex], newForms[index]]
    setTempSongForm(newForms)
  }

  // 송폼 저장
  const saveSongForm = async () => {
    if (!selectedSongForForm) return

    try {
      const { error } = await supabase
        .from('team_setlist_songs')
        .update({ selected_form: tempSongForm })
        .eq('id', selectedSongForForm.id)

      if (error) throw error

      alert('✅ 송폼이 저장되었습니다.')
      setShowSongFormModal(false)
      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error saving song form:', error)
      alert(`송폼 저장 실패: ${error.message}`)
    }
  }

  // PPT 다운로드
  const handleDownloadPPT = async () => {
    if (!setlist || songs.length === 0) {
      alert('다운로드할 곡이 없습니다.')
      return
    }

    setDownloadingPPT(true)

    try {
      const ppt = new pptxgen()

      // 표지 슬라이드
      const coverSlide = ppt.addSlide()
      coverSlide.background = { color: '1F2937' }
      coverSlide.addText(setlist.title, {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1.5,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
      })
      coverSlide.addText(
        `${new Date(setlist.service_date).toLocaleDateString('ko-KR')} • ${setlist.service_type || ''}`,
        {
          x: 0.5,
          y: 4.2,
          w: 9,
          h: 0.5,
          fontSize: 20,
          color: 'D1D5DB',
          align: 'center'
        }
      )

      // 각 곡 슬라이드
      songs.forEach((setlistSong, index) => {
        const song = setlistSong.songs
        const slide = ppt.addSlide()
        
        // 배경색
        slide.background = { color: 'FFFFFF' }

        // 곡 번호 및 제목
        slide.addText(`${index + 1}. ${song.song_name}`, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.8,
          fontSize: 32,
          bold: true,
          color: '1F2937'
        })

        // 아티스트
        if (song.team_name) {
          slide.addText(song.team_name, {
            x: 0.5,
            y: 1.4,
            w: 9,
            h: 0.4,
            fontSize: 18,
            color: '6B7280'
          })
        }

        // Key & 송폼
        let infoText = ''
        if (setlistSong.key_transposed || song.key) {
          infoText += `Key: ${setlistSong.key_transposed || song.key}`
        }
        if (setlistSong.selected_form && setlistSong.selected_form.length > 0) {
          infoText += `  |  송폼: ${setlistSong.selected_form.join(' - ')}`
        }
        if (infoText) {
          slide.addText(infoText, {
            x: 0.5,
            y: 1.9,
            w: 9,
            h: 0.4,
            fontSize: 14,
            color: '9CA3AF'
          })
        }

        // 가사
        if (song.lyrics) {
          slide.addText(song.lyrics, {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 4.5,
            fontSize: 16,
            color: '374151',
            valign: 'top'
          })
        }

        // 노트
        if (setlistSong.notes) {
          slide.addText(`메모: ${setlistSong.notes}`, {
            x: 0.5,
            y: 7.2,
            w: 9,
            h: 0.3,
            fontSize: 12,
            color: 'EF4444',
            italic: true
          })
        }
      })

      // 파일 저장
      const fileName = `${setlist.title}_${new Date(setlist.service_date).toLocaleDateString('ko-KR').replace(/\./g, '')}.pptx`
      await ppt.writeFile({ fileName })

      // 다운로드 로그
      await logDownload({
        userId: user.id,
        setlistId: setlist.id,
        downloadType: 'ppt',
        fileName: fileName,
        teamId: teamId,
        metadata: { songCount: songs.length }
      })

      alert('✅ PPT 파일이 다운로드되었습니다!')
    } catch (error: any) {
      console.error('Error generating PPT:', error)
      alert(`PPT 생성 실패: ${error.message}`)
    } finally {
      setDownloadingPPT(false)
    }
  }

  // PDF 다운로드 (메인 페이지와 동일한 방식)
  const handleDownloadPDF = async () => {
    if (!setlist || songs.length === 0) {
      alert('다운로드할 곡이 없습니다.')
      return
    }

    setDownloadingPDF(true)

    try {
      // 곡 데이터 변환
      const pdfSongs: PDFSong[] = songs.map(setlistSong => ({
        id: setlistSong.id,
        song_name: setlistSong.songs.song_name,
        team_name: setlistSong.songs.team_name,
        key: setlistSong.songs.key,
        file_url: setlistSong.songs.file_url,
        file_type: setlistSong.songs.file_type,
        lyrics: setlistSong.songs.lyrics,
        selectedForm: setlistSong.selected_form || [],
        keyTransposed: setlistSong.key_transposed,
        notes: setlistSong.notes
      }))

      // 송폼 데이터 변환
      const songForms: { [key: string]: string[] } = {}
      songs.forEach(setlistSong => {
        if (setlistSong.selected_form && setlistSong.selected_form.length > 0) {
          songForms[setlistSong.id] = setlistSong.selected_form
        }
      })

      // PDF 생성
      await generatePDF({
        title: setlist.title,
        date: new Date(setlist.service_date).toLocaleDateString('ko-KR'),
        songs: pdfSongs,
        songForms: songForms
      })

      // 다운로드 로그
      await logDownload({
        userId: user.id,
        setlistId: setlist.id,
        downloadType: 'pdf',
        fileName: `${setlist.title}_${new Date(setlist.service_date).toLocaleDateString('ko-KR').replace(/\./g, '')}.pdf`,
        teamId: teamId,
        metadata: { songCount: songs.length }
      })

      alert('✅ PDF 파일이 다운로드되었습니다!')
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      alert(`PDF 생성 실패: ${error.message}`)
    } finally {
      setDownloadingPDF(false)
    }
  }

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

  if (!setlist) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push(`/my-team/${teamId}`)}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold border-b-2 border-blue-500 focus:outline-none"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">{setlist.title}</h1>
              )}
            </div>

            {canEdit() && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <Save className="mr-2" size={18} />
                      저장
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    {/* 다운로드 버튼 */}
                    <button
                      onClick={handleDownloadPPT}
                      disabled={downloadingPPT || songs.length === 0}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center disabled:opacity-50"
                      title="PPT 다운로드"
                    >
                      <Download className="mr-2" size={18} />
                      {downloadingPPT ? 'PPT 생성 중...' : 'PPT'}
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      disabled={downloadingPDF || songs.length === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50"
                      title="PDF 다운로드"
                    >
                      <FileDown className="mr-2" size={18} />
                      {downloadingPDF ? 'PDF 생성 중...' : 'PDF'}
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <Edit className="mr-2" size={18} />
                      수정
                    </button>
                    <button
                      onClick={handleDeleteSetlist}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                    >
                      <Trash2 className="mr-2" size={18} />
                      삭제
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 콘티 정보 */}
          {isEditing ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">예배 날짜</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">예배 유형</label>
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-600">
              {new Date(setlist.service_date).toLocaleDateString('ko-KR')} • {setlist.service_type} • {songs.length}곡
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">곡 목록</h2>
            {canEdit() && (
              <button
                onClick={openAddSongModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="mr-2" size={18} />
                곡 추가
              </button>
            )}
          </div>

          {songs.length === 0 ? (
            <div className="p-12 text-center">
              <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">아직 추가된 곡이 없습니다.</p>
              {canEdit() && (
                <button
                  onClick={openAddSongModal}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  첫 곡 추가하기
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {songs.map((song, index) => (
                <div key={song.id} className="p-4 hover:bg-gray-50 print-song">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <span className="text-lg font-bold text-blue-600 w-8">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-xl mb-2">
                          {song.songs.song_name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {song.songs.team_name} • Key: {song.key_transposed || song.songs.key || '-'}
                        </p>
                        {song.selected_form && song.selected_form.length > 0 && (
                          <p className="text-sm text-purple-600 mt-1 mb-3">
                            송폼: {song.selected_form.join(' - ')}
                          </p>
                        )}
                        {song.songs.lyrics && (
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap mt-3 mb-3 font-sans">
                            {song.songs.lyrics}
                          </pre>
                        )}
                        {song.songs.file_url && (
                          <img 
                            src={song.songs.file_url} 
                            alt={`${song.songs.song_name} 악보`}
                            className="max-w-full h-auto my-4"
                          />
                        )}
                        {song.notes && (
                          <p className="text-sm text-red-600 italic mt-3">
                            메모: {song.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 no-print">
                      {song.songs.file_url && (
                        <button
                          onClick={() => setPreviewSong(song.songs)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                          title="악보 보기"
                        >
                          <Eye size={18} />
                        </button>
                      )}
                      {canEdit() && (
                        <>
                          <button
                            onClick={() => openSongFormModal(song)}
                            className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
                            title="송폼 편집"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => moveSong(index, 'up')}
                            disabled={index === 0}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                          >
                            <ChevronUp size={18} />
                          </button>
                          <button
                            onClick={() => moveSong(index, 'down')}
                            disabled={index === songs.length - 1}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                          >
                            <ChevronDown size={18} />
                          </button>
                          <button
                            onClick={() => removeSongFromSetlist(song.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
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
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">곡 추가</h2>
                <button
                  onClick={() => setShowAddSongModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                placeholder="곡 제목 또는 아티스트 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full mt-4 px-4 py-2 border rounded-lg"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {filteredAvailableSongs.length === 0 ? (
                <p className="text-center text-gray-600">검색 결과가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableSongs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => addSongToSetlist(song)}
                      className="w-full p-4 border rounded-lg hover:bg-blue-50 text-left"
                    >
                      <h3 className="font-semibold">{song.song_name}</h3>
                      <p className="text-sm text-gray-600">
                        {song.team_name} • Key: {song.key || '-'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 악보 미리보기 모달 */}
      {previewSong && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{previewSong.song_name}</h2>
              <button
                onClick={() => setPreviewSong(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {previewSong.file_url ? (
                previewSong.file_type === 'pdf' ? (
                  <iframe
                    src={previewSong.file_url}
                    className="w-full h-full min-h-[600px]"
                  />
                ) : (
                  <img
                    src={previewSong.file_url}
                    alt={previewSong.song_name}
                    className="max-w-full h-auto mx-auto"
                  />
                )
              ) : (
                <p className="text-center text-gray-600">악보가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 송폼 편집 모달 */}
      {showSongFormModal && selectedSongForForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">송폼 편집: {selectedSongForForm.songs.song_name}</h2>
                <button
                  onClick={() => setShowSongFormModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {/* 선택된 송폼 */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">선택된 송폼 순서</h3>
                {tempSongForm.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">아직 선택된 송폼이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {tempSongForm.map((form, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                        <span className="font-semibold text-purple-900 min-w-[40px]">{index + 1}.</span>
                        <span className="flex-1 font-medium">{form}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveSongForm(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-purple-200 rounded disabled:opacity-30"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={() => moveSongForm(index, 'down')}
                            disabled={index === tempSongForm.length - 1}
                            className="p-1 hover:bg-purple-200 rounded disabled:opacity-30"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            onClick={() => removeSongForm(form)}
                            className="p-1 hover:bg-red-200 rounded text-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 송폼 옵션 */}
              <div className="mb-4">
                <h3 className="font-semibold mb-3">송폼 추가</h3>
                <div className="grid grid-cols-4 gap-2">
                  {songFormOptions.map((form) => (
                    <button
                      key={form}
                      onClick={() => addSongForm(form)}
                      className="px-3 py-2 bg-gray-100 hover:bg-purple-100 rounded-lg text-sm font-medium"
                    >
                      {form}
                    </button>
                  ))}
                </div>
              </div>

              {/* 커스텀 송폼 */}
              <div>
                <h3 className="font-semibold mb-3">커스텀 송폼</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFormInput}
                    onChange={(e) => setCustomFormInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomSongForm()}
                    placeholder="예: Special, Transition..."
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={addCustomSongForm}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex gap-2">
              <button
                onClick={() => setShowSongFormModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={saveSongForm}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 프린트용 스타일 (전역)
if (typeof window !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @media print {
      /* 네비게이션, 버튼 숨기기 */
      header, nav, button, .no-print {
        display: none !important;
      }
      
      /* 페이지 여백 */
      @page {
        margin: 2cm;
      }
      
      /* 콘티 제목 페이지 */
      .print-cover {
        page-break-after: always;
        text-align: center;
        padding-top: 30%;
      }
      
      /* 각 곡마다 페이지 나누기 */
      .print-song {
        page-break-after: always;
        padding: 20px 0;
      }
      
      .print-song:last-child {
        page-break-after: auto;
      }
      
      /* 악보 이미지 */
      .print-song img {
        max-width: 100%;
        height: auto;
        margin: 20px 0;
      }
      
      /* 배경색 프린트 */
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `
  if (!document.getElementById('print-styles')) {
    style.id = 'print-styles'
    document.head.appendChild(style)
  }
}