'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Song } from '@/lib/supabase'
import { loadKoreanFont } from '@/lib/fontLoader'
import { ArrowLeft, Edit, Trash2, Plus, FileText, Calendar, Music, X, Save, Eye, Presentation } from 'lucide-react'
import Link from 'next/link'

interface SetlistSong {
  id: string
  order_number: number
  key_transposed?: string
  notes?: string
  selected_form?: string[]
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

  // 🔥 악보 미리보기 모달
  const [previewSong, setPreviewSong] = useState<Song | null>(null)

  // 🔥 송폼 편집 모달
  const [showSongFormModal, setShowSongFormModal] = useState(false)
  const [selectedSongForForm, setSelectedSongForForm] = useState<SetlistSong | null>(null)
  const [tempSongForm, setTempSongForm] = useState<string[]>([])
  const [customFormInput, setCustomFormInput] = useState('')

  // 송폼 옵션
  const songFormOptions = [
    'Intro', 'V1', 'V2', 'V3', 'Pc', 'Pc1', 'Pc2', 'C', 'C1', 'C2',
    '간주', 'Interlude', 'B', 'Bridge', 'Out', 'Outro', 'Ending'
  ]

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

  // 🔥 송폼 편집 모달 열기
  const openSongFormModal = (item: SetlistSong) => {
    setSelectedSongForForm(item)
    setTempSongForm(item.selected_form || [])
    setCustomFormInput('')
    setShowSongFormModal(true)
  }

  // 🔥 송폼 토글
  const toggleFormItem = (item: string) => {
    setTempSongForm(prev => [...prev, item])
  }

  // 🔥 커스텀 송폼 추가
  const addCustomFormItem = () => {
    if (customFormInput.trim()) {
      setTempSongForm(prev => [...prev, customFormInput.trim()])
      setCustomFormInput('')
    }
  }

  // 🔥 송폼 저장
  const saveSongForm = async () => {
    if (!selectedSongForForm) return

    try {
      const { error } = await supabase
        .from('setlist_songs')
        .update({ selected_form: tempSongForm })
        .eq('id', selectedSongForForm.id)

      if (error) throw error

      alert('✅ 송폼이 저장되었습니다!')
      setShowSongFormModal(false)
      fetchSetlistDetail()
    } catch (error) {
      console.error('Error saving song form:', error)
      alert('송폼 저장에 실패했습니다.')
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
      const { PDFDocument, rgb } = pdfLib

      const mergedPdf = await PDFDocument.create()

      // 🔥 fontkit 등록
      const fontkit = await import('@pdf-lib/fontkit')
      mergedPdf.registerFontkit(fontkit.default)
      console.log('✅ fontkit 등록 완료')

      // 🔥 한글 폰트 로드
      console.log('📥 한글 폰트 로딩 시작...')
      let koreanFont = null
      try {
        const fontBytes = await loadKoreanFont()
        
        if (fontBytes) {
          koreanFont = await mergedPdf.embedFont(fontBytes)
          console.log('✅ 한글 폰트 임베드 성공!')
        } else {
          console.warn('⚠️ 한글 폰트를 찾을 수 없습니다.')
        }
      } catch (fontError) {
        console.error('❌ 한글 폰트 로드 실패:', fontError)
      }

      // A4 크기
      const A4_WIDTH = 595.28
      const A4_HEIGHT = 841.89

      // 악보가 있는 곡만 필터링
      const songsWithSheets = songs.filter(item => 
        item.song.file_url && item.song.file_url.trim() !== ''
      )

      if (songsWithSheets.length === 0) {
        alert('⚠️ 악보가 업로드된 곡이 없습니다.')
        return
      }

      console.log('==================== PDF 생성 시작 ====================')
      console.log('선택된 곡 목록:', songsWithSheets.map(item => ({ id: item.song.id, name: item.song.song_name })))
      console.log('각 곡별 송폼:')
      songsWithSheets.forEach(item => {
        console.log(`  - ${item.song.song_name} (${item.song.id}):`, item.selected_form || '❌ 설정 안됨')
      })
      console.log('======================================================')

      // 각 곡의 악보 추가
      for (const item of songsWithSheets) {
        const song = item.song
        const currentSongForm = item.selected_form || []

        try {
          const response = await fetch(song.file_url!)
          if (!response.ok) continue

          const fileType = song.file_type || 'pdf'

          console.log('========================================')
          console.log(`🎵 현재 처리 중인 곡: ${song.song_name}`)
          console.log(`📋 곡 ID: ${song.id}`)
          console.log(`📝 저장된 송폼:`, currentSongForm)
          console.log(`📄 파일 타입: ${fileType}`)
          console.log('========================================')

          // PDF 파일 처리
          if (fileType === 'pdf') {
            const arrayBuffer = await response.arrayBuffer()
            const sheetPdf = await PDFDocument.load(arrayBuffer)
            const pageCount = sheetPdf.getPageCount()

            console.log(`📑 PDF 페이지 수: ${pageCount}`)

            for (let i = 0; i < pageCount; i++) {
              const [embeddedPage] = await mergedPdf.embedPdf(sheetPdf, [i])
              const { width, height } = embeddedPage

              const scaleX = A4_WIDTH / width
              const scaleY = A4_HEIGHT / height
              const scale = Math.min(scaleX, scaleY)

              const scaledWidth = width * scale
              const scaledHeight = height * scale

              const a4Page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])

              const x = (A4_WIDTH - scaledWidth) / 2
              const y = (A4_HEIGHT - scaledHeight) / 2

              // 🔥 1. 먼저 악보 그리기
              a4Page.drawPage(embeddedPage, {
                x: x,
                y: y,
                width: scaledWidth,
                height: scaledHeight,
              })
              console.log(`✅ PDF 악보 그리기 완료 (페이지 ${i + 1})`)

              // 🔥 2. 그 다음 송폼 오버레이 (첫 페이지에만)
              if (i === 0 && currentSongForm && currentSongForm.length > 0) {
                console.log(`✅ PDF 송폼 오버레이 시작: ${song.song_name}`)

                const formText = currentSongForm.join(' - ')
                console.log(`   📝 송폼 텍스트: "${formText}"`)

                try {
                  a4Page.drawText(formText, {
                    x: 30,
                    y: A4_HEIGHT - 25,
                    size: 14,
                    color: rgb(0.23, 0.51, 0.96),
                    font: koreanFont || undefined,
                  })
                  console.log(`✅ PDF 송폼 표시 성공!`)
                } catch (textError) {
                  console.error('❌ 송폼 텍스트 렌더링 실패:', textError)
                }
              }
            }
          }
          // 🔥 이미지 파일 처리
          else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
            console.log(`🖼️ 이미지 파일 처리 중: ${song.song_name}`)

            const imageBytes = await response.arrayBuffer()
            let image

            if (fileType === 'png') {
              image = await mergedPdf.embedPng(imageBytes)
            } else {
              image = await mergedPdf.embedJpg(imageBytes)
            }

            const imgWidth = image.width
            const imgHeight = image.height
            const scaleX = A4_WIDTH / imgWidth
            const scaleY = A4_HEIGHT / imgHeight
            const scale = Math.min(scaleX, scaleY)

            const scaledWidth = imgWidth * scale
            const scaledHeight = imgHeight * scale

            const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])

            const x = (A4_WIDTH - scaledWidth) / 2
            const y = (A4_HEIGHT - scaledHeight) / 2

            // 🔥 1. 먼저 이미지 그리기
            page.drawImage(image, {
              x: x,
              y: y,
              width: scaledWidth,
              height: scaledHeight,
            })
            console.log(`✅ 이미지 그리기 완료`)

            // 🔥 2. 그 다음 송폼 오버레이
            if (currentSongForm && currentSongForm.length > 0) {
              console.log(`✅ 이미지 송폼 오버레이 시작: ${song.song_name}`)

              const formText = currentSongForm.join(' - ')
              console.log(`   📝 송폼 텍스트: "${formText}"`)

              try {
                page.drawText(formText, {
                  x: 30,
                  y: A4_HEIGHT - 35,
                  size: 14,
                  color: rgb(0.23, 0.51, 0.96),
                  font: koreanFont || undefined,
                })
                console.log(`✅ 이미지 송폼 표시 성공!`)
              } catch (textError) {
                console.error('❌ 송폼 텍스트 렌더링 실패:', textError)
              }
            }
          }
        } catch (error) {
          console.error(`${song.song_name} 처리 중 오류:`, error)
        }
      }

      // PDF 저장 및 다운로드
      const pdfBytes = await mergedPdf.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${setlist?.title || '찬양콘티'}_${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      alert('✅ PDF가 생성되었습니다!')
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다.')
    }
  }

  // 🔥 PPT 생성
  const generatePPT = async () => {
    if (songs.length === 0) {
      alert('콘티에 곡이 없습니다.')
      return
    }

    try {
      const pptxgen = (await import('pptxgenjs')).default
      const pres = new pptxgen()

      // 표지 슬라이드
      const coverSlide = pres.addSlide()
      coverSlide.background = { color: '2d3748' }
      
      coverSlide.addText(setlist?.title || '찬양 콘티', {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1.5,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
      })

      coverSlide.addText(new Date(setlist?.service_date || '').toLocaleDateString('ko-KR'), {
        x: 0.5,
        y: 4,
        w: 9,
        h: 0.5,
        fontSize: 24,
        color: 'CBD5E0',
        align: 'center'
      })

      if (setlist?.service_type) {
        coverSlide.addText(setlist.service_type, {
          x: 0.5,
          y: 4.7,
          w: 9,
          h: 0.4,
          fontSize: 18,
          color: '90CDF4',
          align: 'center'
        })
      }

      // 가사가 있는 곡만 필터링
      const songsWithLyrics = songs.filter(item => item.song.lyrics && item.song.lyrics.trim() !== '')

      if (songsWithLyrics.length === 0) {
        alert('⚠️ 가사가 있는 곡이 없습니다.')
        return
      }

      // 각 곡의 가사 슬라이드
      for (const item of songsWithLyrics) {
        const song = item.song
        
        if (song.lyrics) {
          const lines = song.lyrics.split('\n').filter(line => line.trim() !== '')
          const chunks: string[][] = []
          let currentChunk: string[] = []

          for (const line of lines) {
            currentChunk.push(line)
            if (currentChunk.length >= 8) {
              chunks.push([...currentChunk])
              currentChunk = []
            }
          }
          if (currentChunk.length > 0) {
            chunks.push(currentChunk)
          }

          chunks.forEach((chunk, index) => {
            const slide = pres.addSlide()
            slide.background = { color: '1a202c' }

            // 제목
            slide.addText(`${song.song_name}${chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : ''}`, {
              x: 0.5,
              y: 0.3,
              w: 9,
              h: 0.6,
              fontSize: 24,
              bold: true,
              color: 'FFFFFF',
              align: 'center'
            })

            // 가사
            slide.addText(chunk.join('\n'), {
              x: 1,
              y: 1.5,
              w: 8,
              h: 4.5,
              fontSize: 28,
              color: 'FFFFFF',
              align: 'center',
              valign: 'middle'
            })
          })
        }
      }

      const fileName = `${setlist?.title || '찬양콘티'}_${new Date().toISOString().split('T')[0]}.pptx`
      await pres.writeFile({ fileName })

      alert('✅ PPT가 생성되었습니다!')
    } catch (error) {
      console.error('PPT 생성 오류:', error)
      alert('❌ PPT 생성 중 오류가 발생했습니다.')
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
                    <option value="주일집회">주일집회</option>
                    <option value="중보기도회">중보기도회</option>
                    <option value="기도회">기도회</option>
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
              <button
                onClick={generatePPT}
                disabled={songs.length === 0}
                className={`px-4 py-2 rounded-lg flex items-center ${
                  songs.length > 0
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Presentation className="mr-2" size={18} />
                PPT 다운로드
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
                          {item.selected_form && item.selected_form.length > 0 && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              송폼: {item.selected_form.join(' - ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {item.song.file_url && (
                          <button
                            onClick={() => setPreviewSong(item.song)}
                            className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center"
                          >
                            <Eye size={14} className="mr-1" />
                            악보 보기
                          </button>
                        )}
                        <button
                          onClick={() => openSongFormModal(item)}
                          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center"
                        >
                          <Edit size={14} className="mr-1" />
                          송폼 수정
                        </button>
                      </div>
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

      {/* 🔥 악보 미리보기 모달 */}
      {previewSong && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">{previewSong.song_name}</h3>
              <button
                onClick={() => setPreviewSong(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewSong.file_type === 'pdf' ? (
                <iframe
                  src={previewSong.file_url}
                  className="w-full h-full min-h-[600px]"
                  title="악보 미리보기"
                />
              ) : (
                <img
                  src={previewSong.file_url}
                  alt={previewSong.song_name}
                  className="w-full h-auto"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 송폼 편집 모달 */}
      {showSongFormModal && selectedSongForForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">송폼 설정: {selectedSongForForm.song.song_name}</h2>
              <button
                onClick={() => setShowSongFormModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <h3 className="font-semibold mb-2">송폼 선택</h3>
                <div className="flex flex-wrap gap-2">
                  {songFormOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => toggleFormItem(option)}
                      className="px-3 py-1 rounded-lg border-2 transition bg-white text-gray-700 border-gray-300 hover:border-blue-300 hover:bg-blue-50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold mb-2">직접 입력</h3>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={customFormInput}
                    onChange={(e) => setCustomFormInput(e.target.value)}
                    placeholder="예: 기도회, 멘트"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomFormItem()}
                  />
                  <button
                    onClick={addCustomFormItem}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    추가
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">선택된 송폼 순서</h3>
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 min-h-[80px]">
                  {tempSongForm.length > 0 ? (
                    <div className="space-y-3">
                      {/* 개별 태그로 표시 */}
                      <div className="flex flex-wrap gap-2">
                        {tempSongForm.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg font-medium"
                          >
                            <span>{item}</span>
                            <button
                              onClick={() => {
                                setTempSongForm(prev => prev.filter((_, i) => i !== index))
                              }}
                              className="ml-1 hover:bg-blue-600 rounded-full p-0.5 transition"
                              title="삭제"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {/* 미리보기 텍스트 */}
                      <div className="pt-3 border-t border-blue-200">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">미리보기:</span>{' '}
                          <span className="text-blue-800">{tempSongForm.join(' - ')}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">송폼을 선택하세요</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowSongFormModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={saveSongForm}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

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
