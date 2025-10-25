'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Song } from '@/lib/supabase'
import { Search, Music, FileText, Presentation, FolderOpen, Plus, X, ChevronLeft, ChevronRight, Eye, Upload } from 'lucide-react'
import PptxGenJS from 'pptxgenjs'
import Link from 'next/link'

export default function Home() {
  // 임시 사용자 ID (실제로는 인증 시스템에서 가져와야 함)
  const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001'

  // 상태 관리
  const [songs, setSongs] = useState<Song[]>([])
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([])
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  
  // 악보 미리보기 상태
  const [previewSong, setPreviewSong] = useState<Song | null>(null)
  const [focusedSongIndex, setFocusedSongIndex] = useState<number>(-1)
  
  // 콘티 저장 관련 상태
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [setlistTitle, setSetlistTitle] = useState('')
  const [setlistDate, setSetlistDate] = useState(new Date().toISOString().split('T')[0])
  const [setlistType, setSetlistType] = useState('주일집회')
  const [customSetlistType, setCustomSetlistType] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [folders, setFolders] = useState<any[]>([])
  
  // 곡 추가 모달 상태
  const [showAddSongModal, setShowAddSongModal] = useState(false)
  const [newSong, setNewSong] = useState({
    song_name: '',
    team_name: '',
    key: '',
    time_signature: '',
    tempo: '',
    bpm: '',
    theme1: '',
    theme2: '',
    lyrics: ''
  })
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 필터 상태
  const [filters, setFilters] = useState({
    theme: '',
    key: '',
    timeSignature: '',
    tempo: '',
    searchText: ''
  })

  // Ref for song list container
  const songListRef = useRef<HTMLDivElement>(null)

  // 사용 가능한 옵션들
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  const timeSignatures = ['4/4', '3/4', '6/8', '12/8', '6/4', '2/4']
  const tempos = ['느림', '보통', '빠름']
  const themes = ['경배', '찬양', '회개', '감사', '헌신', '선교', '구원', '사랑', '소망', '믿음']

  // 데이터 불러오기
  useEffect(() => {
    fetchSongs()
    fetchFolders()
  }, [])

  // 키보드 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 키보드 단축키 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return
      }

      // 미리보기 모달이 열려있을 때
      if (previewSong) {
        if (e.key === 'Escape') {
          setPreviewSong(null)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          showPreviousSong()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          showNextSong()
        }
        return
      }

      // 곡 목록에서 포커스된 곡이 있을 때
      if (focusedSongIndex >= 0 && focusedSongIndex < filteredSongs.length) {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault()
          const song = filteredSongs[focusedSongIndex]
          if (song.file_url) {
            setPreviewSong(song)
          } else {
            alert('악보가 없는 곡입니다.')
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (focusedSongIndex > 0) {
            setFocusedSongIndex(focusedSongIndex - 1)
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (focusedSongIndex < filteredSongs.length - 1) {
            setFocusedSongIndex(focusedSongIndex + 1)
          }
        } else if (e.key === 'Enter') {
          e.preventDefault()
          toggleSongSelection(filteredSongs[focusedSongIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewSong, focusedSongIndex, filteredSongs])

  // 이전 곡 보기
  const showPreviousSong = () => {
    if (!previewSong) return
    const currentIndex = filteredSongs.findIndex(s => s.id === previewSong.id)
    if (currentIndex > 0) {
      const prevSong = filteredSongs[currentIndex - 1]
      if (prevSong.file_url) {
        setPreviewSong(prevSong)
      }
    }
  }

  // 다음 곡 보기
  const showNextSong = () => {
    if (!previewSong) return
    const currentIndex = filteredSongs.findIndex(s => s.id === previewSong.id)
    if (currentIndex < filteredSongs.length - 1) {
      const nextSong = filteredSongs[currentIndex + 1]
      if (nextSong.file_url) {
        setPreviewSong(nextSong)
      }
    }
  }

  // Supabase에서 찬양 데이터 가져오기
  const fetchSongs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('song_name', { ascending: true })
      
      if (error) throw error
      
      // 유효한 데이터만 필터링 (곡 제목이 있는 것만)
      const validSongs = (data || []).filter(song => {
        return song.song_name && 
               song.song_name.trim() !== '' &&
               song.song_name.length > 1
      })
      
      console.log(`총 ${data?.length || 0}개 중 ${validSongs.length}개의 유효한 곡`)
      
      setSongs(validSongs)
      setFilteredSongs(validSongs)
    } catch (error) {
      console.error('Error fetching songs:', error)
      alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 폴더 목록 가져오기
  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
       .from('folders')
       .select('*')
       .order('created_at', { ascending: false })

      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
      setFolders([])
    }
  }

  // 새 곡 추가 함수
  const addNewSong = async () => {
    if (!newSong.song_name.trim()) {
      alert('곡 제목을 입력하세요.')
      return
    }

    setUploading(true)

    try {
      let fileUrl = ''
      let fileType = ''

      // 파일 업로드가 있는 경우
      if (uploadingFile) {
        const fileExt = uploadingFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        
        // 안전한 파일명 생성 (한글, 특수문자, 공백 제거)
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 8)
        const safeFileName = `${timestamp}_${randomStr}.${fileExt}`
        const filePath = `${TEMP_USER_ID}/${safeFileName}`

        console.log('📤 파일 업로드 시작:', filePath)

        // Supabase Storage에 업로드
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('song-sheets')
          .upload(filePath, uploadingFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: uploadingFile.type
          })

        if (uploadError) {
          console.error('❌ 업로드 오류:', uploadError)
          throw new Error(`파일 업로드 실패: ${uploadError.message}`)
        }

        console.log('✅ 파일 업로드 성공:', uploadData)

        // Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('song-sheets')
          .getPublicUrl(filePath)

        fileUrl = urlData.publicUrl
        fileType = fileExt

        console.log('🔗 Public URL:', fileUrl)
      }

      // 데이터베이스에 곡 정보 저장
      console.log('💾 DB에 곡 정보 저장 중...')
      
      const songData = {
        song_name: newSong.song_name.trim(),
        team_name: newSong.team_name.trim() || null,
        key: newSong.key || null,
        time_signature: newSong.time_signature || null,
        tempo: newSong.tempo || null,
        bpm: newSong.bpm ? parseInt(newSong.bpm) : null,
        theme1: newSong.theme1 || null,
        theme2: newSong.theme2 || null,
        lyrics: newSong.lyrics.trim() || null,
        file_url: fileUrl || null,
        file_type: fileType || null,
        user_id: TEMP_USER_ID,
        created_at: new Date().toISOString()
      }

      console.log('📝 저장할 데이터:', songData)

      const { data: insertedSong, error: songError } = await supabase
        .from('songs')
        .insert(songData)
        .select()
        .single()

      if (songError) {
        console.error('❌ DB 저장 오류:', songError)
        throw songError
      }

      console.log('✅ 곡 추가 완료:', insertedSong)

      alert('✅ 곡이 추가되었습니다!')
      
      // 모달 닫고 초기화
      setShowAddSongModal(false)
      setNewSong({
        song_name: '',
        team_name: '',
        key: '',
        time_signature: '',
        tempo: '',
        bpm: '',
        theme1: '',
        theme2: '',
        lyrics: ''
      })
      setUploadingFile(null)
      
      // 곡 목록 새로고침
      fetchSongs()

    } catch (error: any) {
      console.error('❌ 곡 추가 오류:', error)
      alert(`❌ 곡 추가에 실패했습니다.\n\n오류: ${error.message}\n\n브라우저 콘솔(F12)을 확인하세요.`)
    } finally {
      setUploading(false)
    }
  }

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      return
    }

    // 파일 형식 체크
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      alert('PDF, JPG, PNG 파일만 업로드 가능합니다.')
      return
    }

    console.log('✅ 파일 선택됨:', file.name, file.type, (file.size / 1024 / 1024).toFixed(2) + 'MB')
    setUploadingFile(file)
  }

  // 콘티 저장 함수
  const saveSetlist = async () => {
    if (!setlistTitle.trim()) {
      alert('콘티 제목을 입력하세요.')
      return
    }

    if (selectedSongs.length === 0) {
      alert('곡을 선택해주세요.')
      return
    }

    if (setlistType === '직접입력' && !customSetlistType.trim()) {
      alert('예배 유형을 입력하세요.')
      return
    }

    try {
      // 1. 콘티 생성
      const { data: setlist, error: setlistError } = await supabase
        .from('setlists')
        .insert({
          user_id: TEMP_USER_ID,
          folder_id: selectedFolderId || null,
          title: setlistTitle,
          service_date: setlistDate,
          service_type: setlistType === '직접입력' ? customSetlistType : setlistType
        })
        .select()
        .single()

      if (setlistError) throw setlistError

      // 2. 선택한 곡들을 콘티에 추가
      const setlistSongs = selectedSongs.map((song, index) => ({
        setlist_id: setlist.id,
        song_id: song.id,
        order_number: index + 1
      }))

      const { error: songsError } = await supabase
        .from('setlist_songs')
        .insert(setlistSongs)

      if (songsError) throw songsError

      alert('✅ 콘티가 저장되었습니다!')
      setShowSaveModal(false)
      setSetlistTitle('')
      setCustomSetlistType('')
      setSelectedSongs([])
      
    } catch (error) {
      console.error('Error saving setlist:', error)
      alert('콘티 저장에 실패했습니다.')
    }
  }

  // 필터 적용
  useEffect(() => {
    let result = [...songs]

    if (filters.searchText) {
      result = result.filter(song =>
        song.song_name.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        song.team_name?.toLowerCase().includes(filters.searchText.toLowerCase())
      )
    }

    if (filters.theme) {
      result = result.filter(song =>
        song.theme1 === filters.theme || song.theme2 === filters.theme
      )
    }

    if (filters.key) {
      result = result.filter(song => song.key === filters.key)
    }

    if (filters.timeSignature) {
      result = result.filter(song => song.time_signature === filters.timeSignature)
    }

    if (filters.tempo) {
      result = result.filter(song => song.tempo === filters.tempo)
    }

    setFilteredSongs(result)
    setFocusedSongIndex(-1)
  }, [filters, songs])

  // 곡 선택/해제
  const toggleSongSelection = (song: Song) => {
    if (selectedSongs.find(s => s.id === song.id)) {
      setSelectedSongs(selectedSongs.filter(s => s.id !== song.id))
    } else {
      setSelectedSongs([...selectedSongs, song])
    }
  }

  // 선택한 곡 순서 변경
  const moveSong = (index: number, direction: 'up' | 'down') => {
    const newSelected = [...selectedSongs]
    if (direction === 'up' && index > 0) {
      [newSelected[index - 1], newSelected[index]] = [newSelected[index], newSelected[index - 1]]
    } else if (direction === 'down' && index < newSelected.length - 1) {
      [newSelected[index], newSelected[index + 1]] = [newSelected[index + 1], newSelected[index]]
    }
    setSelectedSongs(newSelected)
  }

  // PDF 생성 함수
  const generatePDF = async () => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    try {
      const pdfLib = await import('pdf-lib')
      const PDFDocument = pdfLib.PDFDocument
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const html2canvas = (await import('html2canvas')).default

      const mergedPdf = await PDFDocument.create()

      // 표지 페이지 생성
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
            찬양 콘티
          </h1>
          <p style="font-size: 28px; color: #4a5568; margin-bottom: 60px;">
            ${new Date().toLocaleDateString('ko-KR')}
          </p>
        </div>
        
        <div style="margin-top: 80px;">
          <h2 style="font-size: 32px; font-weight: 600; color: #2d3748; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
            선택한 찬양 목록
          </h2>
          <div style="font-size: 24px; line-height: 2.5; color: #1a202c;">
            ${selectedSongs.map((song, index) => `
              <div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                <span style="font-weight: 600; color: #3b82f6; margin-right: 15px;">
                  ${index + 1}.
                </span>
                <span style="font-weight: 500;">
                  ${song.song_name}
                </span>
                <span style="color: #718096; margin-left: 10px;">
                  (${song.key || '-'})
                </span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="position: absolute; bottom: 60px; left: 60px; right: 60px; text-align: center; color: #a0aec0; font-size: 18px;">
          총 ${selectedSongs.length}곡 선택됨
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
      const songsWithSheets = selectedSongs.filter(song => song.file_url && song.file_url.trim() !== '')

      if (songsWithSheets.length === 0) {
        alert('⚠️ 악보가 업로드된 곡이 없습니다. 표지만 다운로드됩니다.')
      }

      for (const song of songsWithSheets) {
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
      link.download = `찬양콘티_${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      alert(`✅ PDF가 생성되었습니다!`)
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다.')
    }
  }

  // PPT 생성 함수
  const generatePPT = async () => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    try {
      const prs = new PptxGenJS()
      
      const coverSlide = prs.addSlide()
      coverSlide.background = { color: '1F2937' }
      coverSlide.addText('찬양 콘티', {
        x: 0.5,
        y: 2.0,
        w: 9,
        h: 1.5,
        fontSize: 60,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
      })
      coverSlide.addText(new Date().toLocaleDateString('ko-KR'), {
        x: 0.5,
        y: 3.8,
        w: 9,
        h: 0.5,
        fontSize: 24,
        color: '9CA3AF',
        align: 'center'
      })

      for (const song of selectedSongs) {
        if (song.file_url) {
          const slide = prs.addSlide()
          slide.addImage({
            path: song.file_url,
            x: 0,
            y: 0,
            w: '100%',
            h: '100%',
            sizing: { type: 'contain', w: '100%', h: '100%' }
          })
        }
      }

      await prs.writeFile({ fileName: `찬양콘티_${new Date().toISOString().split('T')[0]}.pptx` })
      alert('✅ PPT가 생성되었습니다!')
      
    } catch (error) {
      console.error('PPT 생성 오류:', error)
      alert('❌ PPT 생성 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">🎵 Ministry Hub</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddSongModal(true)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center"
              >
                <Plus className="mr-2" size={18} />
                곡 추가
              </button>
              <Link href="/setlists">
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center">
                  <FolderOpen className="mr-2" size={18} />
                  내 콘티 관리
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 필터 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">🔍 찬양 검색</h2>
          
          {/* 검색창 */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="곡 제목이나 팀명으로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.searchText}
                onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
              />
            </div>
          </div>

          {/* 필터 옵션 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">테마</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={filters.theme}
                onChange={(e) => setFilters({ ...filters, theme: e.target.value })}
              >
                <option value="">전체</option>
                {themes.map(theme => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={filters.key}
                onChange={(e) => setFilters({ ...filters, key: e.target.value })}
              >
                <option value="">전체</option>
                {keys.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">박자</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={filters.timeSignature}
                onChange={(e) => setFilters({ ...filters, timeSignature: e.target.value })}
              >
                <option value="">전체</option>
                {timeSignatures.map(ts => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템포</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={filters.tempo}
                onChange={(e) => setFilters({ ...filters, tempo: e.target.value })}
              >
                <option value="">전체</option>
                {tempos.map(tempo => (
                  <option key={tempo} value={tempo}>{tempo}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 단축키 안내 */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>단축키:</strong> 곡 클릭 후 <kbd className="px-2 py-1 bg-white rounded border">Space</kbd> 악보 미리보기 | 
              <kbd className="px-2 py-1 bg-white rounded border ml-2">↑↓</kbd> 이동 | 
              <kbd className="px-2 py-1 bg-white rounded border ml-2">Enter</kbd> 선택/해제
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 곡 목록 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">
                📚 찬양 목록 ({filteredSongs.length}곡)
              </h2>
              
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  <p className="mt-4 text-gray-600">불러오는 중...</p>
                </div>
              ) : filteredSongs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Music size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div ref={songListRef} className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredSongs.map((song, index) => (
                    <div
                      key={song.id}
                      tabIndex={0}
                      onClick={() => {
                        toggleSongSelection(song)
                        setFocusedSongIndex(index)
                      }}
                      onFocus={() => setFocusedSongIndex(index)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedSongs.find(s => s.id === song.id)
                          ? 'border-blue-500 bg-blue-50'
                          : focusedSongIndex === index
                          ? 'border-blue-300 bg-blue-25'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{song.song_name}</h3>
                            
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {song.team_name && `${song.team_name} | `}
                            Key: {song.key || '-'} | 
                            박자: {song.time_signature || '-'} | 
                            템포: {song.tempo || '-'}
                            {song.bpm && ` (${song.bpm}BPM)`}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {song.theme1 && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                {song.theme1}
                              </span>
                            )}
                            {song.theme2 && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                {song.theme2}
                              </span>
                            )}
                          </div>
                        </div>
                        {song.file_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewSong(song)
                            }}
                            className="ml-4 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            title="악보 미리보기 (Space)"
                          >
                            <Eye size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 선택한 곡 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">
                ✅ 선택한 곡 ({selectedSongs.length})
              </h2>

              {selectedSongs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">선택한 곡이 없습니다.</p>
              ) : (
                <>
                  <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto">
                    {selectedSongs.map((song, index) => (
                      <div
                        key={song.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-bold text-sm text-gray-900">{index + 1}. {song.song_name}</p>
                          <p className="text-xs text-gray-700 font-medium">Key: {song.key || '-'}</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => moveSong(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveSong(index, 'down')}
                            disabled={index === selectedSongs.length - 1}
                            className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => toggleSongSelection(song)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center"
                    >
                      <Plus className="mr-2" size={18} />
                      콘티로 저장
                    </button>
                    <button
                      onClick={generatePDF}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center"
                    >
                      <FileText className="mr-2" size={18} />
                      PDF 다운로드
                    </button>
                    <button
                      onClick={generatePPT}
                      className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center justify-center"
                    >
                      <Presentation className="mr-2" size={18} />
                      PPT 다운로드
                    </button>
                    <button
                      onClick={() => setSelectedSongs([])}
                      className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      선택 초기화
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 곡 추가 모달 */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">새 곡 추가</h2>
              <button
                onClick={() => {
                  setShowAddSongModal(false)
                  setNewSong({
                    song_name: '',
                    team_name: '',
                    key: '',
                    time_signature: '',
                    tempo: '',
                    bpm: '',
                    theme1: '',
                    theme2: '',
                    lyrics: ''
                  })
                  setUploadingFile(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* 곡 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  곡 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSong.song_name}
                  onChange={(e) => setNewSong({ ...newSong, song_name: e.target.value })}
                  placeholder="예: 주의 이름 높이며"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 팀명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  팀명 / 아티스트
                </label>
                <input
                  type="text"
                  value={newSong.team_name}
                  onChange={(e) => setNewSong({ ...newSong, team_name: e.target.value })}
                  placeholder="예: 위러브(Welove)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Key, 박자, 템포, BPM */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                  <select
                    value={newSong.key}
                    onChange={(e) => setNewSong({ ...newSong, key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {keys.map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">박자</label>
                  <select
                    value={newSong.time_signature}
                    onChange={(e) => setNewSong({ ...newSong, time_signature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {timeSignatures.map(ts => (
                      <option key={ts} value={ts}>{ts}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">템포</label>
                  <select
                    value={newSong.tempo}
                    onChange={(e) => setNewSong({ ...newSong, tempo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {tempos.map(tempo => (
                      <option key={tempo} value={tempo}>{tempo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BPM</label>
                  <input
                    type="number"
                    value={newSong.bpm}
                    onChange={(e) => setNewSong({ ...newSong, bpm: e.target.value })}
                    placeholder="예: 120"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* 테마 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">테마 1</label>
                  <select
                    value={newSong.theme1}
                    onChange={(e) => setNewSong({ ...newSong, theme1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {themes.map(theme => (
                      <option key={theme} value={theme}>{theme}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">테마 2</label>
                  <select
                    value={newSong.theme2}
                    onChange={(e) => setNewSong({ ...newSong, theme2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">선택</option>
                    {themes.map(theme => (
                      <option key={theme} value={theme}>{theme}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 가사 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  가사 (선택사항)
                </label>
                <textarea
                  value={newSong.lyrics}
                  onChange={(e) => setNewSong({ ...newSong, lyrics: e.target.value })}
                  rows={4}
                  placeholder="곡의 가사를 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* 악보 파일 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  악보 파일 (선택사항)
                </label>
                <div className="mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition flex items-center justify-center"
                  >
                    <Upload className="mr-2" size={20} />
                    {uploadingFile ? (
                      <span className="text-green-600 font-medium">
                        ✅ {uploadingFile.name} ({(uploadingFile.size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    ) : (
                      '파일 선택 (PDF, JPG, PNG, 최대 10MB)'
                    )}
                  </button>
                  {uploadingFile && (
                    <button
                      onClick={() => setUploadingFile(null)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      파일 제거
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowAddSongModal(false)
                  setNewSong({
                    song_name: '',
                    team_name: '',
                    key: '',
                    time_signature: '',
                    tempo: '',
                    bpm: '',
                    theme1: '',
                    theme2: '',
                    lyrics: ''
                  })
                  setUploadingFile(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                disabled={uploading}
              >
                취소
              </button>
              <button
                onClick={addNewSong}
                disabled={uploading || !newSong.song_name.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2" size={18} />
                    곡 추가
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 악보 미리보기 모달 */}
      {previewSong && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{previewSong.song_name}</h2>
                <p className="text-sm text-gray-600">
                  {previewSong.team_name} | Key: {previewSong.key || '-'}
                </p>
              </div>
              <button
                onClick={() => setPreviewSong(null)}
                className="text-gray-500 hover:text-gray-700 p-2"
                title="닫기 (ESC)"
              >
                <X size={24} />
              </button>
            </div>

            {/* 악보 내용 */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {previewSong.file_url ? (
                previewSong.file_type === 'pdf' ? (
                  <iframe
                    src={previewSong.file_url}
                    className="w-full h-full min-h-[600px] border-0"
                    title={previewSong.song_name}
                  />
                ) : (
                  <img
                    src={previewSong.file_url}
                    alt={previewSong.song_name}
                    className="max-w-full h-auto mx-auto"
                  />
                )
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Music size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>악보가 없습니다.</p>
                </div>
              )}
            </div>

            {/* 모달 푸터 (네비게이션) */}
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <button
                onClick={showPreviousSong}
                disabled={filteredSongs.findIndex(s => s.id === previewSong.id) === 0}
                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} className="mr-1" />
                이전 곡
              </button>
              
              <div className="text-sm text-gray-600">
                <kbd className="px-2 py-1 bg-white rounded border">←</kbd> 이전 | 
                <kbd className="px-2 py-1 bg-white rounded border ml-2">→</kbd> 다음 | 
                <kbd className="px-2 py-1 bg-white rounded border ml-2">ESC</kbd> 닫기
              </div>

              <button
                onClick={showNextSong}
                disabled={filteredSongs.findIndex(s => s.id === previewSong.id) === filteredSongs.length - 1}
                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음 곡
                <ChevronRight size={20} className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 콘티 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">콘티 저장</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  콘티 제목
                </label>
                <input
                  type="text"
                  value={setlistTitle}
                  onChange={(e) => setSetlistTitle(e.target.value)}
                  placeholder="예: 1월 첫째 주 콘티 : 아버지의 마음"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 날짜
                </label>
                <input
                  type="date"
                  value={setlistDate}
                  onChange={(e) => setSetlistDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 유형
                </label>
                <select
                  value={setlistType}
                  onChange={(e) => setSetlistType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="주일집회">주일집회</option>
                  <option value="중보기도회">중보기도회</option>
                  <option value="기도회">기도회</option>
                  <option value="직접입력">직접입력</option>
                </select>
              </div>

              {/* 직접입력 선택 시 나타나는 입력 필드 */}
            {setlistType === '직접입력' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예배 유형 입력
                </label>
                <input
                  type="text"
                  value={customSetlistType}
                  onChange={(e) => setCustomSetlistType(e.target.value)}
                  placeholder="예: 또래 기도회"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  폴더 (선택사항)
                </label>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">폴더 없음</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setSetlistTitle('')
                  setCustomSetlistType('')
                  setSelectedFolderId('')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={saveSetlist}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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