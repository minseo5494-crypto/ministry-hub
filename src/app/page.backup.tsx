'use client'

import { useState, useEffect } from 'react'
import { supabase, Song } from '@/lib/supabase'
import { Search, Music, FileText, Presentation, FolderOpen, Plus } from 'lucide-react'
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
  
  // 콘티 저장 관련 상태
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [setlistTitle, setSetlistTitle] = useState('')
  const [setlistDate, setSetlistDate] = useState(new Date().toISOString().split('T')[0])
  const [setlistType, setSetlistType] = useState('주일예배')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [folders, setFolders] = useState<any[]>([])
  
  // 필터 상태
  const [filters, setFilters] = useState({
    theme: '',
    key: '',
    timeSignature: '',
    tempo: '',
    searchText: ''
  })

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

  // Supabase에서 찬양 데이터 가져오기
  const fetchSongs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('song_name', { ascending: true })
      
      if (error) throw error
      
      setSongs(data || [])
      setFilteredSongs(data || [])
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
        .eq('user_id', TEMP_USER_ID)
        .order('type', { ascending: true })
        .order('order_number', { ascending: true })

      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
    }
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

    try {
      // 1. 콘티 생성
      const { data: setlist, error: setlistError } = await supabase
        .from('setlists')
        .insert({
          user_id: TEMP_USER_ID,
          folder_id: selectedFolderId || null,
          title: setlistTitle,
          service_date: setlistDate,
          service_type: setlistType,
        })
        .select()
        .single()

      if (setlistError) throw setlistError

      // 2. 선택한 곡들 추가
      const setlistSongs = selectedSongs.map((song, index) => ({
        setlist_id: setlist.id,
        song_id: song.id,
        order_number: index + 1,
      }))

      const { error: songsError } = await supabase
        .from('setlist_songs')
        .insert(setlistSongs)

      if (songsError) throw songsError

      alert(`✅ "${setlistTitle}" 콘티가 저장되었습니다!`)
      setShowSaveModal(false)
      setSetlistTitle('')
      setSelectedSongs([])
    } catch (error) {
      console.error('Error saving setlist:', error)
      alert('콘티 저장에 실패했습니다.')
    }
  }

  // 필터 적용
  useEffect(() => {
    let filtered = [...songs]
    
    // ✅ 1단계: 팀명만 있는 항목 제거
    filtered = filtered.filter(song => {
      // 곡 제목이 없으면 제외
      if (!song.song_name || song.song_name.trim() === '') return false
      
      // 팀명과 곡명이 동일하면 제외 (팀명만 있는 경우)
      if (song.song_name === song.team_name) return false
      
      // Key 정보가 없으면 제외
      if (!song.key || song.key.trim() === '') return false
      
      return true
    })
    
    // ✅ 2단계: 기존 필터 적용
    if (filters.theme) {
      filtered = filtered.filter(song => 
        song.theme1?.includes(filters.theme) || 
        song.theme2?.includes(filters.theme)
      )
    }
    
    if (filters.key) {
      filtered = filtered.filter(song => song.key === filters.key)
    }
    
    if (filters.timeSignature) {
      filtered = filtered.filter(song => song.time_signature === filters.timeSignature)
    }
    
    if (filters.tempo) {
      filtered = filtered.filter(song => song.tempo === filters.tempo)
    }
    
    if (filters.searchText) {
      filtered = filtered.filter(song => 
        song.song_name.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        song.team_name?.toLowerCase().includes(filters.searchText.toLowerCase())
      )
    }
    
    setFilteredSongs(filtered)
  }, [filters, songs])

  // 찬양 선택/해제
  const toggleSongSelection = (song: Song) => {
    const isSelected = selectedSongs.some(s => s.id === song.id)
    
    if (isSelected) {
      setSelectedSongs(selectedSongs.filter(s => s.id !== song.id))
    } else {
      if (selectedSongs.length < 10) {
        setSelectedSongs([...selectedSongs, song])
      } else {
        alert('최대 10개까지 선택 가능합니다.')
      }
    }
  }

  // PDF 생성 (기존 코드 그대로 유지 - 여기서는 생략)
  const generatePDF = async () => {
    console.log('=== PDF 생성 시작 ===')
    console.log('선택된 곡:', selectedSongs)
    console.log('선택된 곡 개수:', selectedSongs.length)

    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    try {
      // 라이브러리 동적 import
      const pdfLib = await import('pdf-lib')
      const PDFDocument = pdfLib.PDFDocument
    
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      
      // ✅ HTML2Canvas import 추가
      const html2canvas = (await import('html2canvas')).default
      
      // 새 PDF 문서 생성
      const mergedPdf = await PDFDocument.create()
      
      // ✅ 표지 페이지를 HTML로 생성
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
            ${new Date().toLocaleDateString('ko-KR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
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
      
      // ✅ HTML을 임시로 화면에 추가 (보이지 않게)
      coverDiv.style.position = 'fixed'
      coverDiv.style.left = '-9999px'
      document.body.appendChild(coverDiv)
      
      // ✅ HTML을 이미지로 변환
      console.log('표지 페이지를 이미지로 변환 중...')
      const canvas = await html2canvas(coverDiv, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      })
      
      // ✅ 화면에서 제거
      document.body.removeChild(coverDiv)
      
      // ✅ Canvas 이미지를 PDF로 변환
      console.log('이미지를 PDF로 변환 중...')
      const coverPdf = new jsPDF('p', 'mm', 'a4')
      const imgData = canvas.toDataURL('image/png')
      coverPdf.addImage(imgData, 'PNG', 0, 0, 210, 297)
      
      // ✅ 표지를 메인 PDF에 병합
      const coverPdfBytes = coverPdf.output('arraybuffer') as ArrayBuffer
      const coverDoc = await PDFDocument.load(coverPdfBytes)
      const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices())
      coverPages.forEach(page => mergedPdf.addPage(page))
      
      console.log('✅ 표지 페이지 생성 완료')
      
      // 악보가 있는 곡만 필터링
      const songsWithSheets = selectedSongs.filter(song => song.file_url && song.file_url.trim() !== '')
      
      if (songsWithSheets.length === 0) {
        alert('⚠️ 선택한 찬양 중 악보가 업로드된 곡이 없습니다.')
        return
      }
      
      console.log(`${songsWithSheets.length}개의 악보를 추가합니다...`)
      
      // 각 악보를 PDF에 추가
      for (let i = 0; i < songsWithSheets.length; i++) {
        const song = songsWithSheets[i]
        console.log(`[${i+1}/${songsWithSheets.length}] ${song.song_name} 처리 중...`)
        
        try {
          const response = await fetch(song.file_url!)
          
          if (!response.ok) {
            console.error(`악보 다운로드 실패: ${song.song_name}`)
            continue
          }
          
          const fileType = song.file_type || 'pdf'
          
          if (fileType === 'pdf') {
            const arrayBuffer = await response.arrayBuffer()
            const sheetPdf = await PDFDocument.load(arrayBuffer)
            const copiedPages = await mergedPdf.copyPages(sheetPdf, sheetPdf.getPageIndices())
            copiedPages.forEach(page => mergedPdf.addPage(page))
            console.log(`✅ ${song.song_name} PDF 추가 완료`)
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
            console.log(`✅ ${song.song_name} 이미지 추가 완료`)
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
      
      console.log('✅ PDF 생성 완료!')
      alert(`✅ PDF가 생성되었습니다!\n총 ${songsWithSheets.length}곡의 악보가 포함되었습니다.`)
      
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다: ' + (error as Error).message)
    }
  }

  // PPT 생성 (기존 코드 유지 - 생략)
  const generatePPT = async () => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    try {
      const ppt = new PptxGenJS()
      
      // 표지 슬라이드
      const titleSlide = ppt.addSlide()
      titleSlide.background = { color: '1E3A8A' }
      titleSlide.addText('찬양 콘티', {
        x: 0.5,
        y: 2,
        w: 9,
        h: 1.5,
        fontSize: 60,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
      })
      
      titleSlide.addText(new Date().toLocaleDateString('ko-KR'), {
        x: 0.5,
        y: 3.5,
        w: 9,
        h: 0.5,
        fontSize: 24,
        color: 'E5E7EB',
        align: 'center'
      })
      
      // 각 찬양에 대한 슬라이드 추가
      selectedSongs.forEach((song, index) => {
        const slide = ppt.addSlide()
        slide.background = { color: '1F2937' }
        
        slide.addText(`${index + 1}. ${song.song_name}`, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 1,
          fontSize: 44,
          bold: true,
          color: 'FFFFFF'
        })
        
        slide.addText(`키: ${song.key || '-'} | BPM: ${song.bpm || '-'}`, {
          x: 0.5,
          y: 1.7,
          w: 9,
          h: 0.5,
          fontSize: 24,
          color: '93C5FD'
        })
        
        if (song.lyrics) {
          slide.addText(song.lyrics, {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 4,
            fontSize: 28,
            color: 'F3F4F6',
            valign: 'top'
          })
        }
      })
      
      // 파일 저장
      await ppt.writeFile({ fileName: `찬양콘티_${new Date().toISOString().split('T')[0]}.pptx` })
      alert('✅ PPT가 생성되었습니다!')
      
    } catch (error) {
      console.error('PPT 생성 오류:', error)
      alert('❌ PPT 생성 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                <Music className="inline-block mr-2 mb-1" />
                Ministry Hub
              </h1>
              <p className="text-gray-600">찬양 검색 및 콘티 작성</p>
            </div>
            <Link href="/setlists">
              <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center">
                <FolderOpen className="mr-2" size={20} />
                내 콘티 관리
              </button>
            </Link>
          </div>
        </div>

        {/* 필터 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">검색 필터</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* 검색어 입력 */}
            <div className="col-span-full md:col-span-2">
              <label className="block text-sm font-medium text-gray-900 mb-1">
                찬양 제목 / 팀명 검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="검색어를 입력하세요"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium placeholder-gray-400"
                  value={filters.searchText}
                  onChange={(e) => setFilters({...filters, searchText: e.target.value})}
                />
              </div>
            </div>

            {/* 주제 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                주제
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                value={filters.theme}
                onChange={(e) => setFilters({...filters, theme: e.target.value})}
              >
                <option value="">전체</option>
                {themes.map(theme => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </div>

            {/* 키 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                키(Key)
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                value={filters.key}
                onChange={(e) => setFilters({...filters, key: e.target.value})}
              >
                <option value="">전체</option>
                {keys.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            {/* 박자 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                박자
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                value={filters.timeSignature}
                onChange={(e) => setFilters({...filters, timeSignature: e.target.value})}
              >
                <option value="">전체</option>
                {timeSignatures.map(ts => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
            </div>

            {/* 템포 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                템포
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                value={filters.tempo}
                onChange={(e) => setFilters({...filters, tempo: e.target.value})}
              >
                <option value="">전체</option>
                {tempos.map(tempo => (
                  <option key={tempo} value={tempo}>{tempo}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 필터 초기화 버튼 */}
          <button
            onClick={() => setFilters({
              theme: '',
              key: '',
              timeSignature: '',
              tempo: '',
              searchText: ''
            })}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            필터 초기화
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 검색 결과 */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              검색 결과 ({filteredSongs.length}곡)
            </h2>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-gray-600">데이터 불러오는 중...</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-96 space-y-2">
                {filteredSongs.map(song => {
                  const isSelected = selectedSongs.some(s => s.id === song.id)
                  return (
                    <div
                      key={song.id}
                      onClick={() => toggleSongSelection(song)}
                      className={`p-3 border rounded-lg cursor-pointer transition ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-800">
                            {song.song_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {song.team_name && `${song.team_name} | `}
                            {song.key && `Key: ${song.key} | `}
                            {song.tempo || song.bpm && `Tempo: ${song.tempo || song.bpm + 'BPM'}`}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {song.theme1 && `#${song.theme1} `}
                            {song.theme2 && `#${song.theme2}`}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-blue-500 text-sm font-medium">선택됨</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 선택한 찬양 & 다운로드 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              선택한 찬양 ({selectedSongs.length}/10)
            </h2>
            
            <div className="space-y-2 mb-6">
              {selectedSongs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  찬양을 선택해주세요
                </p>
              ) : (
                selectedSongs.map((song, index) => (
                  <div key={song.id} className="p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        {index + 1}. {song.song_name}
                      </span>
                      <button
                        onClick={() => toggleSongSelection(song)}
                        className="text-red-500 hover:text-red-600 text-sm"
                      >
                        제거
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 콘티로 저장 버튼 추가 */}
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={selectedSongs.length === 0}
              className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center mb-3 ${
                selectedSongs.length > 0
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Plus className="mr-2" size={20} />
              콘티로 저장
            </button>

            {/* 다운로드 버튼들 */}
            <div className="space-y-3">
              <button
                onClick={generatePDF}
                disabled={selectedSongs.length === 0}
                className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center ${
                  selectedSongs.length > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <FileText className="mr-2" size={20} />
                PDF 악보 다운로드
              </button>
              
              <button
                onClick={generatePPT}
                disabled={selectedSongs.length === 0}
                className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center ${
                  selectedSongs.length > 0
                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Presentation className="mr-2" size={20} />
                PPT 자막 다운로드
              </button>
            </div>

            <div className="mt-6 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 선택한 찬양들이 하나의 PDF와 PPT로 생성됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 콘티 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">콘티로 저장</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                콘티 제목 *
              </label>
              <input
                type="text"
                value={setlistTitle}
                onChange={(e) => setSetlistTitle(e.target.value)}
                placeholder="예: 2025년 10월 27일 주일예배"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                날짜 *
              </label>
              <input
                type="date"
                value={setlistDate}
                onChange={(e) => setSetlistDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                예배 유형
              </label>
              <select
                value={setlistType}
                onChange={(e) => setSetlistType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700"
              >
                <option value="주일예배">주일예배</option>
                <option value="수요예배">수요예배</option>
                <option value="금요예배">금요예배</option>
                <option value="새벽기도">새벽기도</option>
                <option value="청년부">청년부</option>
                <option value="중고등부">중고등부</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                폴더 선택 (선택사항)
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-700"
              >
                <option value="">폴더 없음</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.type === 'church' ? '📁' : '  └─'} {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700 font-medium mb-2">선택한 곡 ({selectedSongs.length}곡)</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {selectedSongs.map((song, index) => (
                  <li key={song.id}>
                    {index + 1}. {song.song_name} ({song.key})
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setSetlistTitle('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={saveSetlist}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
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