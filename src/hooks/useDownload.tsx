// src/hooks/useDownload.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Song } from '@/lib/supabase'
import { generatePDF as generatePDFFile, generatePDFFromCanvas, PDFSong } from '@/lib/pdfGenerator'
import { logPDFDownload, logPPTDownload } from '@/lib/activityLogger'
import { SECTION_ABBREVIATIONS } from '@/lib/supabase'
import { SongFormStyle, PartTagStyle } from '@/components/SongFormPositionModal'
import { DownloadProgress } from '@/components/DownloadLoadingModal'

// 모바일 기기 감지
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// 파일명에서 사용 불가능한 문자 제거
const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[\\/:*?"<>|]/g, '_')
}

interface UseDownloadProps {
  selectedSongs: Song[]
  songForms: { [songId: string]: string[] }
  userId?: string
  setlistTitle?: string
  setlistDate?: string
}

export interface DownloadOptions {
  includeCover: boolean
  includeSongForm: boolean
  marginPercent: number
  customFileName: string  // 사용자 지정 파일명
}

// 미리보기 이미지 타입
export interface PreviewImage {
  url: string
  filename: string
  blob: Blob
}

interface UseDownloadReturn {
  downloadingPDF: boolean
  downloadingImage: boolean
  downloadingPPT: boolean
  showFormatModal: boolean
  showPositionModal: boolean
  showPPTModal: boolean

  // 진행률 상태
  downloadProgress: DownloadProgress | null

  // 미리보기 상태
  previewImages: PreviewImage[]
  showPreview: boolean
  setShowPreview: (show: boolean) => void
  handlePreviewSave: (index: number) => void
  handlePreviewShare: (index: number) => void

  setShowFormatModal: (show: boolean) => void
  setShowPositionModal: (show: boolean) => void
  setShowPPTModal: (show: boolean) => void

  downloadOptions: DownloadOptions
  setDownloadOptions: React.Dispatch<React.SetStateAction<DownloadOptions>>
  hasSongsWithForms: () => boolean

  handleDownload: () => void
  onPositionConfirm: (
    songFormStyles: { [key: string]: SongFormStyle },
    partTagStyles: { [songId: string]: PartTagStyle[] },
    canvasDataUrls: { [songId: string]: string[] }
  ) => void
  onPositionCancel: () => void
  startDownloadWithFormat: (format: 'pdf' | 'image') => void
  startPPTDownload: () => void
  generatePPTWithOptions: (mode: 'form' | 'original') => Promise<void>

  // ✅ 새로 추가: 공통 모달 컴포넌트
  DownloadFormatModal: () => React.ReactElement | null
}

export function useDownload({
  selectedSongs,
  songForms,
  userId,
  setlistTitle,
  setlistDate
}: UseDownloadProps): UseDownloadReturn {
  // 로딩 상태
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [downloadingImage, setDownloadingImage] = useState(false)
  const [downloadingPPT, setDownloadingPPT] = useState(false)

  // 진행률 상태
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  
  // 모달 상태
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [showPositionModal, setShowPositionModal] = useState(false)
  const [showPPTModal, setShowPPTModal] = useState(false)

  // 미리보기 상태 (모바일용)
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // 미리보기에서 저장
  const handlePreviewSave = useCallback(async (index: number) => {
    const image = previewImages[index]
    if (!image) return

    try {
      // iOS Safari에서는 다운로드 링크 생성
      const url = URL.createObjectURL(image.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = image.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장에 실패했습니다.')
    }
  }, [previewImages])

  // 미리보기에서 공유
  const handlePreviewShare = useCallback(async (index: number) => {
    const image = previewImages[index]
    if (!image) return

    try {
      if (navigator.share) {
        const file = new File([image.blob], image.filename, { type: 'image/jpeg' })
        await navigator.share({ files: [file] })
      } else {
        // 공유 API 미지원 시 다운로드
        handlePreviewSave(index)
      }
    } catch (error) {
      // 사용자가 공유 취소한 경우 무시
      if ((error as Error).name !== 'AbortError') {
        console.error('공유 실패:', error)
      }
    }
  }, [previewImages, handlePreviewSave])

  // 미리보기 닫기 시 정리
  const closePreview = useCallback(() => {
    setShowPreview(false)
    // URL 해제
    previewImages.forEach(img => {
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url)
      }
    })
    setPreviewImages([])
  }, [previewImages])

  // 기본 파일명 생성
  const getDefaultFileName = useCallback(() => {
    if (selectedSongs.length === 1) {
      // 단일 곡: 곡 이름
      return selectedSongs[0].song_name
    } else {
      // 콘티: 콘티 제목 + 예배 날짜
      const title = setlistTitle || '찬양 콘티'
      const date = setlistDate || new Date().toLocaleDateString('ko-KR')
      return `${title}_${date}`
    }
  }, [selectedSongs, setlistTitle, setlistDate])

  // 다운로드 옵션 상태
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
    includeCover: true,
    includeSongForm: true,
    marginPercent: 0,
    customFileName: ''
  })
  
  // Ref로 최신 값 유지 (클로저 문제 해결)
  const downloadOptionsRef = useRef<DownloadOptions>(downloadOptions)
  const selectedSongsRef = useRef<Song[]>(selectedSongs)
  const songFormsRef = useRef<{ [songId: string]: string[] }>(songForms)
  
  // 형식 선택 대기
  const pendingFormatRef = useRef<'pdf' | 'image' | null>(null)
  
  // 값이 변경될 때마다 ref 업데이트
  useEffect(() => {
    downloadOptionsRef.current = downloadOptions
  }, [downloadOptions])
  
  useEffect(() => {
    selectedSongsRef.current = selectedSongs
  }, [selectedSongs])
  
  useEffect(() => {
    songFormsRef.current = songForms
  }, [songForms])
  
  // 송폼이 있는 곡이 있는지 확인
  const hasSongsWithForms = useCallback(() => {
    return selectedSongs.some(song => {
      const forms = songForms[song.id] || []
      return forms.length > 0
    })
  }, [selectedSongs, songForms])
  
  // 다운로드 버튼 클릭
  const handleDownload = useCallback(() => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }
    // 모달 열 때 기본 파일명 설정
    setDownloadOptions(prev => ({
      ...prev,
      customFileName: getDefaultFileName()
    }))
    setShowFormatModal(true)
  }, [selectedSongs.length, getDefaultFileName])
  
  // 송폼 위치 선택 완료 → canvasDataUrls를 PDF/이미지 모두 사용
  const onPositionConfirm = useCallback((
    songFormStyles: { [key: string]: SongFormStyle },
    partTagStyles: { [songId: string]: PartTagStyle[] },
    canvasDataUrls: { [songId: string]: string[] }
  ): void => {
    console.log('📦 useDownload - songFormStyles 받음:', songFormStyles)
    console.log('🏷️ useDownload - partTagStyles 받음:', partTagStyles)
    console.log('🖼️ useDownload - canvasDataUrls 받음:', canvasDataUrls ? Object.keys(canvasDataUrls).length + '개' : 'undefined')
    
    setShowPositionModal(false)
    
    const format = pendingFormatRef.current
    pendingFormatRef.current = null
    
    if (format === 'pdf') {
      if (canvasDataUrls && Object.keys(canvasDataUrls).length > 0) {
        generatePDFFromCanvasData(canvasDataUrls)
      } else {
        generatePDFLegacy(songFormStyles, partTagStyles)
      }
    } else if (format === 'image') {
      if (canvasDataUrls && Object.keys(canvasDataUrls).length > 0) {
        downloadImagesFromCanvas(canvasDataUrls)
      } else {
        downloadAsImageFilesLegacy(songFormStyles, partTagStyles)
      }
    }
  }, [])
  
  // 송폼 위치 선택 취소
  const onPositionCancel = useCallback(() => {
    setShowPositionModal(false)
  }, [])
  
  // 형식 선택 후 다운로드 시작
  const startDownloadWithFormat = useCallback((format: 'pdf' | 'image') => {
    setShowFormatModal(false)
    
    // 송폼 옵션이 켜져 있고, 송폼이 설정된 곡이 있으면 위치 선택 모달
    if (downloadOptions.includeSongForm && hasSongsWithForms()) {
      pendingFormatRef.current = format
      setShowPositionModal(true)
    } else {
      // 바로 다운로드 진행 (송폼 없이)
      if (format === 'pdf') {
        generatePDFNoForm()
      } else {
        downloadAsImageFilesNoForm()
      }
    }
  }, [downloadOptions.includeSongForm, hasSongsWithForms])
  
  // ========================================
  // ✅ 공통 다운로드 형식 선택 모달 컴포넌트
  // ========================================
  const DownloadFormatModal = useCallback(() => {
    if (!showFormatModal) return null
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-md p-6">
          <h3 className="text-xl font-bold mb-4">다운로드 설정</h3>

          {/* 파일명 입력 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📁 파일명
            </label>
            <input
              type="text"
              value={downloadOptions.customFileName}
              onChange={(e) => setDownloadOptions(prev => ({
                ...prev,
                customFileName: e.target.value
              }))}
              placeholder="파일명을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              확장자(.pdf, .jpg 등)는 자동으로 추가됩니다
            </p>
          </div>

          {/* 옵션 섹션 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-700 mb-2">다운로드 옵션</h4>
            
            {/* 표지 포함 */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition">
              <input
                type="checkbox"
                checked={downloadOptions.includeCover}
                onChange={(e) => setDownloadOptions(prev => ({
                  ...prev, includeCover: e.target.checked
                }))}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium">📄 표지 포함</span>
                <p className="text-xs text-gray-500">콘티 제목과 곡 목록이 포함된 표지</p>
              </div>
            </label>
            
            {/* 송폼 포함 - 송폼이 설정된 곡이 있을 때만 표시 */}
            {hasSongsWithForms() && (
              <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition">
                <input
                  type="checkbox"
                  checked={downloadOptions.includeSongForm}
                  onChange={(e) => setDownloadOptions(prev => ({
                    ...prev, includeSongForm: e.target.checked
                  }))}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium">🎵 송폼 표시</span>
                  <p className="text-xs text-gray-500">악보에 송폼(V1-C-B 등) 오버레이</p>
                </div>
              </label>
            )}
          </div>
          
          {/* 형식 선택 */}
          <p className="text-gray-600 mb-3 font-medium">다운로드 형식</p>
          <div className="space-y-3">
            <button
              onClick={() => startDownloadWithFormat('pdf')}
              className="w-full p-4 border-2 border-blue-600 rounded-lg hover:bg-blue-50 text-left transition"
            >
              <div className="font-bold text-blue-900 mb-1">📑 PDF 파일</div>
              <div className="text-sm text-gray-600">
                모든 곡을 하나의 PDF 문서로 통합
              </div>
            </button>
            
            <button
              onClick={() => startDownloadWithFormat('image')}
              className="w-full p-4 border-2 border-green-600 rounded-lg hover:bg-green-50 text-left transition"
            >
              <div className="font-bold text-green-900 mb-1">🖼️ 사진파일 (JPG/PNG)</div>
              <div className="text-sm text-gray-600">
                각 곡을 개별 이미지 파일로 다운로드
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ※ PDF 악보는 JPG로 변환됩니다
              </div>
            </button>
          </div>
          
          <button
            onClick={() => setShowFormatModal(false)}
            className="w-full mt-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            취소
          </button>
        </div>
      </div>
    )
  }, [showFormatModal, downloadOptions, hasSongsWithForms, startDownloadWithFormat])
  
  // ========================================
  // 🆕 canvasDataUrls에서 이미지 다운로드 (다중 페이지 지원)
  // ========================================
  const downloadImagesFromCanvas = async (canvasDataUrls: { [songId: string]: string[] }) => {
    setDownloadingImage(true)

    const currentSongs = selectedSongsRef.current
    const opts = downloadOptionsRef.current
    const isMobile = isMobileDevice()

    // 모바일용 미리보기 이미지 수집
    const collectedImages: PreviewImage[] = []

    try {
      console.log(`✅ 캔버스 이미지 다운로드 시작: ${Object.keys(canvasDataUrls).length}개 곡`)

      let downloadCount = 0

      for (let i = 0; i < currentSongs.length; i++) {
        const song = currentSongs[i]
        const canvasDataUrlArray = canvasDataUrls[song.id]

        // 진행률 업데이트
        setDownloadProgress({
          current: i + 1,
          total: currentSongs.length,
          songName: song.song_name,
          stage: '이미지 변환 중...'
        })

        if (!canvasDataUrlArray || canvasDataUrlArray.length === 0) {
          if (song.file_url) {
            await downloadOriginalFile(song, i, opts.customFileName)
            downloadCount++
          }
          continue
        }

        try {
          // 🆕 모든 페이지 다운로드
          for (let pageIdx = 0; pageIdx < canvasDataUrlArray.length; pageIdx++) {
            const canvasDataUrl = canvasDataUrlArray[pageIdx]

            // 다중 페이지 진행률 업데이트
            if (canvasDataUrlArray.length > 1) {
              setDownloadProgress({
                current: i + 1,
                total: currentSongs.length,
                songName: song.song_name,
                stage: `페이지 ${pageIdx + 1}/${canvasDataUrlArray.length} 변환 중...`
              })
            }

            const jpgBlob = await convertToJpg(canvasDataUrl)

            const pageSuffix = canvasDataUrlArray.length > 1 ? `_p${pageIdx + 1}` : ''
            // 단일 곡: 사용자 지정 파일명, 다중 곡: 번호_곡이름 형식
            const baseFilename = currentSongs.length === 1 && opts.customFileName
              ? opts.customFileName
              : `${String(i + 1).padStart(2, '0')}_${song.song_name}`
            const filename = sanitizeFilename(`${baseFilename}${pageSuffix}`) + '.jpg'

            if (isMobile) {
              // 모바일: 미리보기용으로 수집
              const url = URL.createObjectURL(jpgBlob)
              collectedImages.push({ url, filename, blob: jpgBlob })
            } else {
              // 데스크톱: 바로 다운로드
              const url = URL.createObjectURL(jpgBlob)
              const a = document.createElement('a')
              a.href = url
              a.download = filename
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }

            // 페이지 간 딜레이
            if (pageIdx < canvasDataUrlArray.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }

          downloadCount++
          console.log(`✅ 다운로드 완료: ${song.song_name} (${canvasDataUrlArray.length}페이지)`)

          if (i < currentSongs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
          }
        } catch (error) {
          console.error(`❌ ${song.song_name} 다운로드 실패:`, error)
        }
      }

      // 모바일에서 미리보기 모달 표시
      if (isMobile && collectedImages.length > 0) {
        setPreviewImages(collectedImages)
        setShowPreview(true)
      } else {
        alert(`✅ 총 ${downloadCount}개 곡이 다운로드되었습니다!\n\n※ 브라우저에서 여러 파일 다운로드를 차단한 경우\n설정에서 허용해주세요.`)
      }
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('❌ 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloadingImage(false)
      setDownloadProgress(null)
    }
  }
  
  // PNG 데이터를 JPG로 변환
  const convertToJpg = (dataUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Blob 생성 실패'))
          },
          'image/jpeg',
          0.95
        )
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = dataUrl
    })
  }
  
  // 원본 파일 다운로드 (송폼 없는 곡용)
  const downloadOriginalFile = async (song: Song, index: number, customFileName?: string): Promise<void> => {
    if (!song.file_url) return

    try {
      const response = await fetch(song.file_url)
      const blob = await response.blob()

      // 단일 곡이고 사용자 지정 파일명이 있으면 사용
      const currentSongs = selectedSongsRef.current
      const baseFilename = currentSongs.length === 1 && customFileName
        ? customFileName
        : `${String(index + 1).padStart(2, '0')}_${song.song_name}`
      const filename = sanitizeFilename(baseFilename)
      const extension = song.file_type === 'pdf' ? 'pdf' : 'jpg'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(`원본 파일 다운로드 실패: ${song.song_name}`, error)
    }
  }
  
  // ========================================
  // 🆕 WYSIWYG PDF 생성 (다중 페이지 지원)
  // ========================================
  const generatePDFFromCanvasData = async (canvasDataUrls: { [songId: string]: string[] }) => {
    setDownloadingPDF(true)

    try {
      const currentSongs = selectedSongsRef.current
      const opts = downloadOptionsRef.current

      // 진행률 초기화 (1부터 시작하여 바로 진행 중임을 표시)
      setDownloadProgress({ current: 1, total: currentSongs.length, stage: 'PDF 준비 중...' })

      const pdfSongs: PDFSong[] = currentSongs.map(song => ({
        id: song.id,
        song_name: song.song_name,
        team_name: song.team_name,
        key: song.key,
        file_url: song.file_url,
        file_type: song.file_type,
        lyrics: song.lyrics,
        selectedForm: songFormsRef.current[song.id] || [],
      }))

      console.log('🖼️ WYSIWYG PDF 생성 시작')
      console.log('📊 곡 수:', pdfSongs.length)
      console.log('📊 캔버스 데이터:', Object.keys(canvasDataUrls).length)

      // 진행률 콜백 전달
      await generatePDFFromCanvas({
        title: setlistTitle || '찬양 콘티',
        date: setlistDate || new Date().toLocaleDateString('ko-KR'),
        songs: pdfSongs,
        canvasDataUrls,
        includeCover: opts.includeCover,
        customFileName: opts.customFileName || undefined,
        onProgress: (current, total, songName) => {
          setDownloadProgress({
            current,
            total,
            songName,
            stage: 'PDF 페이지 생성 중...'
          })
        }
      })

      if (userId) {
        const songIds = currentSongs.map(s => s.id)
        await logPDFDownload(songIds, undefined, userId).catch(err =>
          console.error('PDF 로깅 실패:', err)
        )
      }

      alert('✅ PDF가 생성되었습니다!')
    } catch (error) {
      console.error('WYSIWYG PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setDownloadingPDF(false)
      setDownloadProgress(null)
    }
  }
  
  // ========================================
  // 송폼 없이 PDF 생성
  // ========================================
  const generatePDFNoForm = async () => {
    setDownloadingPDF(true)

    try {
      const currentSongs = selectedSongsRef.current
      const opts = downloadOptionsRef.current

      const pdfSongs: PDFSong[] = currentSongs.map(song => ({
        id: song.id,
        song_name: song.song_name,
        team_name: song.team_name,
        key: song.key,
        file_url: song.file_url,
        file_type: song.file_type,
        lyrics: song.lyrics,
        selectedForm: [],
      }))

      // 진행률 초기화
      setDownloadProgress({ current: 1, total: currentSongs.length, songName: pdfSongs[0]?.song_name, stage: 'PDF 준비 중...' })

      await generatePDFFile({
        title: setlistTitle || '찬양 콘티',
        date: setlistDate || new Date().toLocaleDateString('ko-KR'),
        songs: pdfSongs,
        songForms: {},
        songFormPositions: undefined,
        partTags: {},
        includeCover: opts.includeCover,
        marginPercent: opts.marginPercent,
        customFileName: opts.customFileName || undefined,
        onProgress: (current, total, songName) => {
          setDownloadProgress({
            current,
            total,
            songName,
            stage: 'PDF 페이지 생성 중...'
          })
        }
      })

      if (userId) {
        const songIds = currentSongs.map(s => s.id)
        await logPDFDownload(songIds, undefined, userId).catch(err =>
          console.error('PDF 로깅 실패:', err)
        )
      }

      alert('✅ PDF가 생성되었습니다!')
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setDownloadingPDF(false)
      setDownloadProgress(null)
    }
  }
  
  // ========================================
  // 레거시: 기존 방식 PDF 생성 (fallback)
  // ========================================
  const generatePDFLegacy = async (
    _songFormStyles: { [key: string]: SongFormStyle },
    partTagStyles: { [songId: string]: PartTagStyle[] }
  ) => {
    setDownloadingPDF(true)

    try {
      const currentSongs = selectedSongsRef.current
      const currentSongForms = songFormsRef.current
      const opts = downloadOptionsRef.current

      const pdfSongs: PDFSong[] = currentSongs.map(song => ({
        id: song.id,
        song_name: song.song_name,
        team_name: song.team_name,
        key: song.key,
        file_url: song.file_url,
        file_type: song.file_type,
        lyrics: song.lyrics,
        selectedForm: currentSongForms[song.id] || [],
      }))

      // 진행률 초기화
      setDownloadProgress({ current: 1, total: currentSongs.length, songName: pdfSongs[0]?.song_name, stage: 'PDF 준비 중...' })

      await generatePDFFile({
        title: setlistTitle || '찬양 콘티',
        date: setlistDate || new Date().toLocaleDateString('ko-KR'),
        songs: pdfSongs,
        songForms: opts.includeSongForm ? currentSongForms : {},
        songFormPositions: undefined,
        partTags: opts.includeSongForm ? partTagStyles : {},
        includeCover: opts.includeCover,
        marginPercent: opts.marginPercent,
        customFileName: opts.customFileName || undefined,
        onProgress: (current, total, songName) => {
          setDownloadProgress({
            current,
            total,
            songName,
            stage: 'PDF 페이지 생성 중...'
          })
        }
      })

      if (userId) {
        const songIds = currentSongs.map(s => s.id)
        await logPDFDownload(songIds, undefined, userId).catch(err =>
          console.error('PDF 로깅 실패:', err)
        )
      }

      alert('✅ PDF가 생성되었습니다!')
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      alert('❌ PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setDownloadingPDF(false)
      setDownloadProgress(null)
    }
  }
  
  // ========================================
  // 송폼 없이 이미지 다운로드
  // ========================================
  const downloadAsImageFilesNoForm = async () => {
    setDownloadingImage(true)

    const currentSongs = selectedSongsRef.current
    const opts = downloadOptionsRef.current

    try {
      let downloadCount = 0
      console.log(`✅ 총 ${currentSongs.length}개 곡 다운로드 시작 (송폼 없음)`)

      for (let i = 0; i < currentSongs.length; i++) {
        const song = currentSongs[i]

        // 진행률 업데이트
        setDownloadProgress({
          current: i + 1,
          total: currentSongs.length,
          songName: song.song_name,
          stage: song.file_type === 'pdf' ? 'PDF 변환 중...' : '이미지 다운로드 중...'
        })

        if (!song.file_url) {
          console.warn(`⚠️ ${song.song_name}: 파일이 없어서 건너뜁니다`)
          continue
        }

        try {
          if (song.file_type === 'pdf') {
            await downloadPdfAsJpgNoForm(song, i, opts.customFileName)
          } else {
            await downloadImageNoForm(song, i, opts.customFileName)
          }
          downloadCount++
        } catch (error) {
          console.error(`❌ ${song.song_name} 다운로드 실패:`, error)
        }

        if (i < currentSongs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      alert(`✅ 총 ${downloadCount}개 곡이 다운로드되었습니다!`)
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('❌ 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloadingImage(false)
      setDownloadProgress(null)
    }
  }

  // 이미지 다운로드 (송폼 없음)
  const downloadImageNoForm = async (song: Song, index: number, customFileName?: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas context not available'))
            return
          }

          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          ctx.drawImage(img, 0, 0)

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Blob 생성 실패'))
              return
            }

            // 단일 곡이고 사용자 지정 파일명이 있으면 사용
            const currentSongs = selectedSongsRef.current
            const baseFilename = currentSongs.length === 1 && customFileName
              ? customFileName
              : `${String(index + 1).padStart(2, '0')}_${song.song_name}`
            const filename = sanitizeFilename(baseFilename)

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${filename}.jpg`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            resolve()
          }, 'image/jpeg', 0.95)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = song.file_url!
    })
  }
  
  // PDF를 JPG로 변환 (송폼 없음)
  const downloadPdfAsJpgNoForm = async (song: Song, index: number, customFileName?: string): Promise<void> => {
    try {
      const pdfjsLib = (window as any).pdfjsLib
      if (!pdfjsLib) {
        throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.')
      }

      const loadingTask = pdfjsLib.getDocument(song.file_url)
      const pdf = await loadingTask.promise
      const pageCount = pdf.numPages

      // 단일 곡이고 사용자 지정 파일명이 있으면 사용
      const currentSongs = selectedSongsRef.current
      const baseFilename = currentSongs.length === 1 && customFileName
        ? customFileName
        : `${String(index + 1).padStart(2, '0')}_${song.song_name}`

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const scale = 2.0
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({ canvasContext: ctx, viewport }).promise

        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve()
              return
            }

            const pageSuffix = pageCount > 1 ? `_p${pageNum}` : ''
            const filename = sanitizeFilename(`${baseFilename}${pageSuffix}`)

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${filename}.jpg`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            resolve()
          }, 'image/jpeg', 0.95)
        })

        if (pageNum < pageCount) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    } catch (error) {
      console.error('PDF 변환 오류:', error)
      throw error
    }
  }
  
  // 레거시: 기존 방식 이미지 다운로드 (fallback)
  const downloadAsImageFilesLegacy = async (
    _songFormStyles: { [key: string]: SongFormStyle },
    _partTagStyles: { [songId: string]: PartTagStyle[] }
  ) => {
    await downloadAsImageFilesNoForm()
  }
  
  // ========================================
  // PPT 생성
  // ========================================
  const generatePPTWithOptions = useCallback(async (mode: 'form' | 'original') => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }
    
    setDownloadingPPT(true)
    setShowPPTModal(false)
    
    try {
      const PptxGenJS = (await import('pptxgenjs')).default
      const prs = new PptxGenJS()
      
      // 표지 슬라이드
      const coverSlide = prs.addSlide()
      coverSlide.background = { color: '1F2937' }
      coverSlide.addText(setlistTitle || '찬양 콘티', {
        x: 0.5, y: 2.0, w: 9, h: 1.5,
        fontSize: 60, bold: true, color: 'FFFFFF', align: 'center'
      })
      coverSlide.addText(setlistDate || new Date().toLocaleDateString('ko-KR'), {
        x: 0.5, y: 3.8, w: 9, h: 0.5,
        fontSize: 24, color: '9CA3AF', align: 'center'
      })
      
      // 각 곡 처리
      for (const song of selectedSongs) {
        const forms = songForms[song.id]
        
        if (mode === 'form' && forms && forms.length > 0 && song.song_structure) {
          for (const abbr of forms) {
            const fullName = Object.keys(SECTION_ABBREVIATIONS).find(
              key => SECTION_ABBREVIATIONS[key] === abbr
            )
            
            if (fullName && song.song_structure[fullName]) {
              const slide = prs.addSlide()
              slide.background = { color: 'FFFFFF' }
              
              slide.addText(abbr, {
                x: 0.5, y: 0.3, w: 9, h: 0.5,
                fontSize: 16, bold: true, color: '6B7280', align: 'left'
              })
              
              slide.addText(song.song_structure[fullName], {
                x: 1, y: 1.5, w: 8, h: 4,
                fontSize: 28, color: '111827', align: 'center', valign: 'middle'
              })
              
              slide.addText(song.song_name, {
                x: 0.5, y: 6.5, w: 9, h: 0.3,
                fontSize: 14, color: '9CA3AF', align: 'center'
              })
            }
          }
        } else {
          if (song.file_url) {
            const slide = prs.addSlide()
            slide.addImage({
              path: song.file_url,
              x: 0, y: 0, w: '100%', h: '100%',
              sizing: { type: 'contain', w: '100%', h: '100%' }
            })
          }
        }
      }
      
      const fileName = `${setlistTitle || '찬양콘티'}_${new Date().toISOString().split('T')[0]}.pptx`
      await prs.writeFile({ fileName })
      
      if (userId) {
        await logPPTDownload(
          selectedSongs.map(s => s.id),
          undefined,
          userId,
          undefined
        ).catch(error => {
          console.error('Error logging PPT download:', error)
        })
      }
      
      alert('✅ PPT가 생성되었습니다!')
    } catch (error) {
      console.error('PPT 생성 오류:', error)
      alert('❌ PPT 생성 중 오류가 발생했습니다.')
    } finally {
      setDownloadingPPT(false)
    }
  }, [selectedSongs, songForms, userId, setlistTitle, setlistDate])
  
  // PPT 다운로드 시작
  const startPPTDownload = useCallback(() => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }
    
    const hasSongForm = selectedSongs.some(song =>
      songForms[song.id] && songForms[song.id].length > 0
    )
    
    if (hasSongForm) {
      setShowPPTModal(true)
    } else {
      generatePPTWithOptions('original')
    }
  }, [selectedSongs, songForms, generatePPTWithOptions])
  
  return {
    downloadingPDF,
    downloadingImage,
    downloadingPPT,
    showFormatModal,
    showPositionModal,
    showPPTModal,

    // 진행률 상태
    downloadProgress,

    // 미리보기 상태 (모바일용)
    previewImages,
    showPreview,
    setShowPreview: closePreview,
    handlePreviewSave,
    handlePreviewShare,

    setShowFormatModal,
    setShowPositionModal,
    setShowPPTModal,

    downloadOptions,
    setDownloadOptions,
    hasSongsWithForms,

    handleDownload,
    onPositionConfirm,
    onPositionCancel,
    startDownloadWithFormat,
    startPPTDownload,
    generatePPTWithOptions,

    // ✅ 공통 모달 컴포넌트
    DownloadFormatModal,
  }
}