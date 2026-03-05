// src/hooks/useDownload.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Song } from '@/lib/supabase'
import { generatePDF as generatePDFFile, generatePDFFromCanvas, PDFSong } from '@/lib/pdfGenerator'
import { logPDFDownload, logPPTDownload } from '@/lib/activityLogger'
import { SECTION_ABBREVIATIONS } from '@/lib/supabase'
import { SongFormStyle, PartTagStyle } from '@/components/SongFormPositionModal'
import { DownloadProgress } from '@/components/DownloadLoadingModal'
import { trackSongDownload } from '@/lib/analytics'

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
  handlePreviewSaveAll: () => void

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
  generatePPTWithOptions: (options: { includeTitleSlides: boolean; showFormLabels: boolean }) => Promise<void>
  hasMultipleSongs: boolean
  hasSongForms: boolean

  // ✅ 렌더 헬퍼 함수 (컴포넌트 아님 - input 포커스 유지)
  renderDownloadFormatModal: () => React.ReactElement | null
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

  // 미리보기에서 저장 (Web Share API 사용하여 iOS 사진첩에 바로 저장)
  const handlePreviewSave = useCallback(async (index: number) => {
    const image = previewImages[index]
    if (!image) return

    try {
      // Web Share API가 지원되면 공유 시트로 저장 (iOS에서 "이미지 저장" 옵션 제공)
      if (navigator.share && navigator.canShare) {
        const file = new File([image.blob], image.filename, { type: 'image/jpeg' })
        const shareData = { files: [file] }

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      }

      // Web Share API 미지원 시 기존 다운로드 방식
      const url = URL.createObjectURL(image.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = image.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      // 사용자가 공유 취소한 경우 무시
      if ((error as Error).name !== 'AbortError') {
        console.error('저장 실패:', error)
        alert('저장에 실패했습니다.')
      }
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

  // 미리보기에서 전체 이미지 저장 (Web Share API로 여러 파일 한번에 공유)
  const handlePreviewSaveAll = useCallback(async () => {
    if (previewImages.length === 0) return

    try {
      // Web Share API가 지원되면 모든 파일을 한번에 공유
      if (navigator.share && navigator.canShare) {
        const files = previewImages.map(img =>
          new File([img.blob], img.filename, { type: 'image/jpeg' })
        )
        const shareData = { files }

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      }

      // Web Share API 미지원 시 개별 다운로드
      for (let i = 0; i < previewImages.length; i++) {
        const image = previewImages[i]
        const url = URL.createObjectURL(image.blob)
        const a = document.createElement('a')
        a.href = url
        a.download = image.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // 다운로드 간 딜레이
        if (i < previewImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    } catch (error) {
      // 사용자가 공유 취소한 경우 무시
      if ((error as Error).name !== 'AbortError') {
        console.error('전체 저장 실패:', error)
        alert('저장에 실패했습니다.')
      }
    }
  }, [previewImages])

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
  // ✅ 렌더 헬퍼 함수 (컴포넌트 아님 - input 포커스 유지)
  // ========================================
  const renderDownloadFormatModal = () => {
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
              <div
                onClick={() => setDownloadOptions(prev => ({
                  ...prev, includeCover: !prev.includeCover
                }))}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                  downloadOptions.includeCover
                    ? 'bg-blue-100 border-blue-500'
                    : 'bg-white border-gray-300'
                }`}
              >
                {downloadOptions.includeCover && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <span className="font-medium">📄 표지 포함</span>
                <p className="text-xs text-gray-500">콘티 제목과 곡 목록이 포함된 표지</p>
              </div>
            </label>
            
            {/* 송폼 포함 - 송폼이 설정된 곡이 있을 때만 표시 */}
            {hasSongsWithForms() && (
              <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition">
                <div
                  onClick={() => setDownloadOptions(prev => ({
                    ...prev, includeSongForm: !prev.includeSongForm
                  }))}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                    downloadOptions.includeSongForm
                      ? 'bg-blue-100 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {downloadOptions.includeSongForm && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
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
  }
  
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

      // GA4 트래킹
      currentSongs.forEach(song => {
        trackSongDownload(song.id, 'image')
      })

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

      // GA4 트래킹
      currentSongs.forEach(song => {
        trackSongDownload(song.id, 'pdf')
      })

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

      // GA4 트래킹
      currentSongs.forEach(song => {
        trackSongDownload(song.id, 'pdf')
      })

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

      // GA4 트래킹
      currentSongs.forEach(song => {
        trackSongDownload(song.id, 'pdf')
      })

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
  // 송폼 없이 이미지 다운로드 (모바일 미리보기 지원)
  // ========================================
  const downloadAsImageFilesNoForm = async () => {
    setDownloadingImage(true)

    const currentSongs = selectedSongsRef.current
    const opts = downloadOptionsRef.current
    const isMobile = isMobileDevice()

    // 모바일용 미리보기 이미지 수집
    const collectedImages: PreviewImage[] = []

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
            const images = await convertPdfToImages(song, i, opts.customFileName)
            if (isMobile) {
              collectedImages.push(...images)
            } else {
              // 데스크톱: 바로 다운로드
              for (const img of images) {
                downloadBlob(img.blob, img.filename)
                URL.revokeObjectURL(img.url)
              }
            }
          } else {
            const image = await convertImageToJpg(song, i, opts.customFileName)
            if (image) {
              if (isMobile) {
                collectedImages.push(image)
              } else {
                downloadBlob(image.blob, image.filename)
                URL.revokeObjectURL(image.url)
              }
            }
          }
          downloadCount++
        } catch (error) {
          console.error(`❌ ${song.song_name} 다운로드 실패:`, error)
        }

        if (i < currentSongs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }

      // GA4 트래킹
      currentSongs.forEach(song => {
        trackSongDownload(song.id, 'image')
      })

      // 모바일에서 미리보기 모달 표시
      if (isMobile && collectedImages.length > 0) {
        setPreviewImages(collectedImages)
        setShowPreview(true)
      } else if (!isMobile) {
        alert(`✅ 총 ${downloadCount}개 곡이 다운로드되었습니다!`)
      }
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('❌ 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloadingImage(false)
      setDownloadProgress(null)
    }
  }

  // 헬퍼: Blob 다운로드
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 이미지를 JPG로 변환하여 PreviewImage 반환
  const convertImageToJpg = async (song: Song, index: number, customFileName?: string): Promise<PreviewImage | null> => {
    return new Promise((resolve, reject) => {
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

            const currentSongs = selectedSongsRef.current
            const baseFilename = currentSongs.length === 1 && customFileName
              ? customFileName
              : `${String(index + 1).padStart(2, '0')}_${song.song_name}`
            const filename = sanitizeFilename(baseFilename) + '.jpg'
            const url = URL.createObjectURL(blob)

            resolve({ url, filename, blob })
          }, 'image/jpeg', 0.95)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = song.file_url!
    })
  }

  // PDF를 이미지들로 변환하여 PreviewImage[] 반환
  const convertPdfToImages = async (song: Song, index: number, customFileName?: string): Promise<PreviewImage[]> => {
    const images: PreviewImage[] = []

    try {
      const pdfjsLib = (window as any).pdfjsLib
      if (!pdfjsLib) {
        throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.')
      }

      const loadingTask = pdfjsLib.getDocument({ url: song.file_url, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true, standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/' })
      const pdf = await loadingTask.promise
      const pageCount = pdf.numPages

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

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
        })

        if (blob) {
          const pageSuffix = pageCount > 1 ? `_p${pageNum}` : ''
          const filename = sanitizeFilename(`${baseFilename}${pageSuffix}`) + '.jpg'
          const url = URL.createObjectURL(blob)
          images.push({ url, filename, blob })
        }
      }
    } catch (error) {
      console.error('PDF 변환 오류:', error)
      throw error
    }

    return images
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

  // 가사에서 섹션별로 파싱하는 헬퍼 함수
  const parseLyricsToSections = (lyrics: string): { [section: string]: string } => {
    const sections: { [section: string]: string } = {}
    if (!lyrics) return sections

    // 섹션 태그 패턴: [Verse1], [Chorus], [Bridge] 등
    const sectionPattern = /\[(Intro|Verse\s?\d?|PreChorus\s?\d?|Pre-Chorus\s?\d?|Chorus\s?\d?|Bridge\s?\d?|Interlude|Outro|Tag)\]/gi

    const parts = lyrics.split(sectionPattern)
    let currentSection = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim()
      if (!part) continue

      // 섹션 태그인지 확인
      if (sectionPattern.test(`[${part}]`)) {
        // 섹션 이름 정규화
        currentSection = part.replace(/\s+/g, '')
        sectionPattern.lastIndex = 0 // regex 상태 리셋
      } else if (currentSection) {
        sections[currentSection] = part
        currentSection = ''
      } else {
        // 태그 없이 시작하는 가사
        if (!sections['Verse1']) {
          sections['Verse1'] = part
        }
      }
    }

    return sections
  }

  // 섹션 약어를 전체 이름으로 매핑
  const getFullSectionName = (abbr: string): string[] => {
    const mapping: { [key: string]: string[] } = {
      'I': ['Intro'],
      'V': ['Verse', 'Verse1'],
      'V1': ['Verse1', 'Verse'],
      'V2': ['Verse2'],
      'V3': ['Verse3'],
      'Pc': ['PreChorus', 'Pre-Chorus', 'PreChorus1'],
      'C': ['Chorus', 'Chorus1'],
      'C2': ['Chorus2'],
      'B': ['Bridge', 'Bridge1'],
      '간주': ['Interlude'],
      'Int': ['Interlude'],
      'T': ['Tag'],
      'Out': ['Outro']
    }
    return mapping[abbr] || [abbr]
  }

  const generatePPTWithOptions = useCallback(async (options: { includeTitleSlides: boolean; showFormLabels: boolean }) => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    setDownloadingPPT(true)
    setShowPPTModal(false)

    try {
      const PptxGenJS = (await import('pptxgenjs')).default
      const prs = new PptxGenJS()

      // 한글 폰트 설정
      const koreanFont = 'NanumGothic'

      // 표지 슬라이드
      const coverSlide = prs.addSlide()
      coverSlide.background = { color: '1F2937' }
      coverSlide.addText(setlistTitle || '찬양 콘티', {
        x: 0.5, y: 2.0, w: 9, h: 1.5,
        fontSize: 60, bold: true, color: 'FFFFFF', align: 'center', fontFace: koreanFont
      })
      coverSlide.addText(setlistDate || new Date().toLocaleDateString('ko-KR'), {
        x: 0.5, y: 3.8, w: 9, h: 0.5,
        fontSize: 24, color: '9CA3AF', align: 'center', fontFace: koreanFont
      })

      // 각 곡 처리
      for (let songIndex = 0; songIndex < selectedSongs.length; songIndex++) {
        const song = selectedSongs[songIndex]
        const forms = songForms[song.id]

        // 곡 제목 슬라이드 (옵션이 켜져 있고 여러 곡일 때)
        if (options.includeTitleSlides && selectedSongs.length > 1) {
          const titleSlide = prs.addSlide()
          titleSlide.background = { color: '374151' }
          titleSlide.addText(`${songIndex + 1}`, {
            x: 0.5, y: 1.5, w: 9, h: 1,
            fontSize: 48, bold: true, color: '9CA3AF', align: 'center', fontFace: koreanFont
          })
          titleSlide.addText(song.song_name, {
            x: 0.5, y: 2.5, w: 9, h: 1.5,
            fontSize: 48, bold: true, color: 'FFFFFF', align: 'center', fontFace: koreanFont
          })
          if (song.team_name) {
            titleSlide.addText(song.team_name, {
              x: 0.5, y: 4.2, w: 9, h: 0.5,
              fontSize: 24, color: '9CA3AF', align: 'center', fontFace: koreanFont
            })
          }
        }

        // 1. song_structure가 있으면 사용
        // 2. 없으면 lyrics를 파싱해서 사용
        let lyricsData: { [section: string]: string } = {}

        if (song.song_structure && Object.keys(song.song_structure).length > 0) {
          lyricsData = song.song_structure
        } else if (song.lyrics) {
          lyricsData = parseLyricsToSections(song.lyrics)
        }

        // 송폼이 설정되어 있고 가사 데이터가 있으면
        if (forms && forms.length > 0 && Object.keys(lyricsData).length > 0) {
          for (const abbr of forms) {
            // 약어에 해당하는 섹션 이름들 찾기
            const possibleNames = getFullSectionName(abbr)
            let sectionLyrics = ''

            for (const name of possibleNames) {
              // 대소문자 무시하고 찾기
              const foundKey = Object.keys(lyricsData).find(
                k => k.toLowerCase() === name.toLowerCase()
              )
              if (foundKey && lyricsData[foundKey]) {
                sectionLyrics = lyricsData[foundKey]
                break
              }
            }

            if (sectionLyrics) {
              // 가사 처리: /를 줄바꿈으로 변환하고 2줄씩 슬라이드 분할
              const processedLyrics = sectionLyrics
                .replace(/\s*\/\s*/g, '\n')
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line.length > 0)

              const LINES_PER_SLIDE = 2
              for (let i = 0; i < processedLyrics.length; i += LINES_PER_SLIDE) {
                const slideLines = processedLyrics.slice(i, i + LINES_PER_SLIDE)
                const slideText = slideLines.join('\n')

                const slide = prs.addSlide()
                slide.background = { color: 'FFFFFF' }

                // 송폼 라벨 표시 (옵션이 켜져 있을 때만)
                if (options.showFormLabels) {
                  const slideIndex = Math.floor(i / LINES_PER_SLIDE) + 1
                  const totalSlides = Math.ceil(processedLyrics.length / LINES_PER_SLIDE)
                  const sectionLabel = totalSlides > 1 ? `${abbr} (${slideIndex}/${totalSlides})` : abbr

                  slide.addText(sectionLabel, {
                    x: 0.5, y: 0.3, w: 9, h: 0.5,
                    fontSize: 16, bold: true, color: '6B7280', align: 'left', fontFace: koreanFont
                  })
                }

                slide.addText(slideText, {
                  x: 0.5, y: 2, w: 9, h: 3,
                  fontSize: 36, color: '111827', align: 'center', valign: 'middle', fontFace: koreanFont
                })

                slide.addText(song.song_name, {
                  x: 0.5, y: 6.5, w: 9, h: 0.3,
                  fontSize: 14, color: '9CA3AF', align: 'center', fontFace: koreanFont
                })
              }
            }
          }
        } else if (song.lyrics) {
          // 송폼이 없지만 가사가 있으면 전체 가사를 슬라이드로
          const processedLyrics = song.lyrics
            .replace(/\[.*?\]/g, '') // 섹션 태그 제거
            .replace(/\s*\/\s*/g, '\n')
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)

          const LINES_PER_SLIDE = 2
          for (let i = 0; i < processedLyrics.length; i += LINES_PER_SLIDE) {
            const slideLines = processedLyrics.slice(i, i + LINES_PER_SLIDE)
            const slideText = slideLines.join('\n')

            const slide = prs.addSlide()
            slide.background = { color: 'FFFFFF' }

            const slideIndex = Math.floor(i / LINES_PER_SLIDE) + 1
            const totalSlides = Math.ceil(processedLyrics.length / LINES_PER_SLIDE)

            slide.addText(`${slideIndex}/${totalSlides}`, {
              x: 0.5, y: 0.3, w: 9, h: 0.5,
              fontSize: 16, bold: true, color: '6B7280', align: 'left', fontFace: koreanFont
            })

            slide.addText(slideText, {
              x: 0.5, y: 2, w: 9, h: 3,
              fontSize: 36, color: '111827', align: 'center', valign: 'middle', fontFace: koreanFont
            })

            slide.addText(song.song_name, {
              x: 0.5, y: 6.5, w: 9, h: 0.3,
              fontSize: 14, color: '9CA3AF', align: 'center', fontFace: koreanFont
            })
          }
        } else {
          // 가사가 없으면 안내 슬라이드
          const slide = prs.addSlide()
          slide.background = { color: 'FFFFFF' }
          slide.addText(song.song_name, {
            x: 0.5, y: 2, w: 9, h: 1,
            fontSize: 36, bold: true, color: '111827', align: 'center', fontFace: koreanFont
          })
          slide.addText('가사 정보가 없습니다', {
            x: 0.5, y: 3.5, w: 9, h: 0.5,
            fontSize: 18, color: '9CA3AF', align: 'center', fontFace: koreanFont
          })
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

      // GA4 트래킹
      selectedSongs.forEach(song => {
        trackSongDownload(song.id, 'ppt')
      })

      alert('✅ PPT가 생성되었습니다!')
    } catch (error) {
      console.error('PPT 생성 오류:', error)
      alert('❌ PPT 생성 중 오류가 발생했습니다.')
    } finally {
      setDownloadingPPT(false)
    }
  }, [selectedSongs, songForms, userId, setlistTitle, setlistDate])
  
  // 여러 곡 선택 여부
  const hasMultipleSongs = selectedSongs.length > 1

  // 송폼 설정된 곡 있는지
  const hasSongFormsForPPT = selectedSongs.some(song =>
    songForms[song.id] && songForms[song.id].length > 0
  )

  // PPT 다운로드 시작
  const startPPTDownload = useCallback(() => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    // 가사가 있는 곡이 있으면 모달 표시
    const hasLyrics = selectedSongs.some(song =>
      song.lyrics ||
      (song.song_structure && Object.keys(song.song_structure).length > 0)
    )

    if (hasLyrics) {
      setShowPPTModal(true)
    } else {
      alert('가사가 있는 곡이 없습니다.')
    }
  }, [selectedSongs])
  
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
    handlePreviewSaveAll,

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
    hasMultipleSongs,
    hasSongForms: hasSongFormsForPPT,

    // ✅ 렌더 헬퍼 함수 (input 포커스 유지)
    renderDownloadFormatModal,
  }
}