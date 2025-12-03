// src/hooks/useDownload.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Song } from '@/lib/supabase'
import { SongFormPosition } from '@/lib/types'
import { generatePDF as generatePDFFile, PDFSong } from '@/lib/pdfGenerator'
import { logPDFDownload, logPPTDownload } from '@/lib/activityLogger'
import { SECTION_ABBREVIATIONS } from '@/lib/supabase'
import { PartTag } from '@/components/SongFormPositionModal'

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
  setlistTitle?: string  // 콘티 제목 (my-team용)
  setlistDate?: string   // 콘티 날짜 (my-team용)
}

// 🆕 다운로드 옵션 인터페이스
export interface DownloadOptions {
  includeCover: boolean       // 표지 포함 여부
  includeSongForm: boolean    // 송폼 표시 여부
  marginPercent: number       // 여백 축소 퍼센트 (0-30)
}

interface UseDownloadReturn {
  // 상태
  downloadingPDF: boolean
  downloadingImage: boolean
  downloadingPPT: boolean           // 🆕 추가
  showFormatModal: boolean
  showPositionModal: boolean
  showPPTModal: boolean             // 🆕 추가
  
  // 상태 설정
  setShowFormatModal: (show: boolean) => void
  setShowPositionModal: (show: boolean) => void
  setShowPPTModal: (show: boolean) => void  // 🆕 추가

  // 🆕 다운로드 옵션
  downloadOptions: DownloadOptions
  setDownloadOptions: React.Dispatch<React.SetStateAction<DownloadOptions>>
  hasSongsWithForms: () => boolean
  
  // 액션
  handleDownload: () => void
  onPositionConfirm: (positions: { [key: string]: SongFormPosition }) => void
  onPositionCancel: () => void
  startDownloadWithFormat: (format: 'pdf' | 'image') => void
  startPPTDownload: () => void               // 🆕 추가
  generatePPTWithOptions: (mode: 'form' | 'original') => Promise<void>  // 🆕 추가
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
  const [downloadingPPT, setDownloadingPPT] = useState(false)  // 🆕 추가
  
  // 모달 상태
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [showPositionModal, setShowPositionModal] = useState(false)
  const [showPPTModal, setShowPPTModal] = useState(false) // 🆕 추가

    // 🆕 다운로드 옵션 상태
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
    includeCover: true,
    includeSongForm: true,
    marginPercent: 0
  })

  // 🆕 downloadOptions를 ref로도 유지 (내부 함수에서 최신 값 참조용)
  const downloadOptionsRef = useRef<DownloadOptions>(downloadOptions)
  
  // 🆕 selectedSongs와 songForms도 ref로 관리 (클로저 문제 해결)
  const selectedSongsRef = useRef<Song[]>(selectedSongs)
  const songFormsRef = useRef<{ [songId: string]: string[] }>(songForms)
  const partTagsRef = useRef<{ [songId: string]: PartTag[] }>({})
  
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

  // 🆕 형식 선택 대기 (위치 선택 후 사용)
  const pendingFormatRef = useRef<'pdf' | 'image' | null>(null)

  // 송폼 위치 저장 (위치 선택 후 형식 선택까지 유지)
  const positionsRef = useRef<{ [key: string]: SongFormPosition }>({})

  // 송폼이 있는 곡이 있는지 확인
  const hasSongsWithForms = useCallback(() => {
    return selectedSongs.some(song => {
      const forms = songForms[song.id] || []
      return forms.length > 0
    })
  }, [selectedSongs, songForms])

  // 다운로드 버튼 클릭 - 🆕 항상 형식+옵션 선택 모달 먼저
  const handleDownload = useCallback(() => {
    if (selectedSongs.length === 0) {
      alert('찬양을 선택해주세요.')
      return
    }

    // 항상 형식+옵션 선택 모달 먼저 표시
    setShowFormatModal(true)
  }, [selectedSongs.length])

  // 🆕 송폼 위치 선택 완료 → 바로 다운로드 진행
  const onPositionConfirm = useCallback((
    positions: { [key: string]: SongFormPosition },
    partTags: { [songId: string]: PartTag[] } = {}
  ) => {
    console.log('🏷️ useDownload - partTags 받음:', partTags)  // 🆕 디버깅
    positionsRef.current = positions
    partTagsRef.current = partTags
    setShowPositionModal(false)
    
    // 대기 중인 형식으로 다운로드 진행
    const format = pendingFormatRef.current
    pendingFormatRef.current = null
    
    if (format === 'pdf') {
      generatePDF(positions)
    } else if (format === 'image') {
      downloadAsImageFiles(positions)
    }
  }, [])

  // 송폼 위치 선택 취소
  const onPositionCancel = useCallback(() => {
    positionsRef.current = {}
    setShowPositionModal(false)
  }, [])

  // 🆕 형식 선택 후 다운로드 시작 - 옵션에 따라 분기
  const startDownloadWithFormat = useCallback((format: 'pdf' | 'image') => {
    setShowFormatModal(false)

    // 송폼 옵션이 켜져 있고, 송폼이 설정된 곡이 있으면 위치 선택 모달
    if (downloadOptions.includeSongForm && hasSongsWithForms()) {
      pendingFormatRef.current = format
      setShowPositionModal(true)
    } else {
      // 바로 다운로드 진행 (송폼 없이)
      if (format === 'pdf') {
        generatePDF({})
      } else {
        downloadAsImageFiles({})
      }
    }
  }, [downloadOptions.includeSongForm, hasSongsWithForms])

  // PDF 생성
  const generatePDF = async (positions: { [key: string]: SongFormPosition }) => {
    setDownloadingPDF(true)

    try {
      // 🆕 ref에서 최신 값 가져오기
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

      console.log('🏷️ generatePDF - partTagsRef.current:', partTagsRef.current)  // 🆕 디버깅
      
      await generatePDFFile({
        title: setlistTitle || '찬양 콘티',
        date: setlistDate || new Date().toLocaleDateString('ko-KR'),
        songs: pdfSongs,
        songForms: opts.includeSongForm ? currentSongForms : {},
        songFormPositions: opts.includeSongForm ? positions : undefined,
        partTags: opts.includeSongForm ? partTagsRef.current : {},  // 🆕 추가
        includeCover: opts.includeCover,
        marginPercent: opts.marginPercent
      })

      // PDF 다운로드 로깅
      if (userId) {
        const songIds = currentSongs.map(s => s.id)  // 🆕 ref 사용
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
      positionsRef.current = {}
    }
  }

  // 이미지 파일로 다운로드
  const downloadAsImageFiles = async (positions: { [key: string]: SongFormPosition }) => {
    setDownloadingImage(true)
    
    // 🆕 ref에서 최신 값 가져오기
    const currentSongs = selectedSongsRef.current

    // 모바일 안내
    if (isMobileDevice()) {
      // ... 생략
    }

    try {
      let downloadCount = 0
      console.log(`✅ 총 ${currentSongs.length}개 곡 다운로드 시작`)

      for (let i = 0; i < currentSongs.length; i++) {
        const song = currentSongs[i]

        if (!song.file_url) {
          console.warn(`⚠️ ${song.song_name}: 파일이 없어서 건너뜁니다`)
          continue
        }

        console.log(`\n📥 처리 중 (${i + 1}/${selectedSongs.length}): ${song.song_name}`)

        try {
          // 🆕 송폼 옵션이 꺼져 있으면 위치 정보 무시
            const position = downloadOptionsRef.current.includeSongForm ? positions[song.id] : undefined
          
          if (song.file_type === 'pdf') {
            await downloadPdfAsJpg(song, i, position)
          } else {
            await downloadImageWithForm(song, i, position)
          }
          downloadCount++
        } catch (error) {
          console.error(`❌ ${song.song_name} 다운로드 실패:`, error)
          alert(`⚠️ ${song.song_name} 다운로드 중 오류가 발생했습니다.\n계속 진행합니다.`)
        }

        // 다음 파일 다운로드 전 대기
        if (i < currentSongs.length - 1) {  // 🆕 ref 사용
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      alert(`✅ 총 ${downloadCount}개 곡이 다운로드되었습니다!\n\n※ 브라우저에서 여러 파일 다운로드를 차단한 경우\n설정에서 허용해주세요.`)
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('❌ 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloadingImage(false)
      positionsRef.current = {}
    }
  }

  // 이미지 파일 다운로드 (송폼 포함)
  const downloadImageWithForm = async (
    song: Song, 
    index: number, 
    position?: SongFormPosition
  ): Promise<void> => {
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

          // 송폼 옵션이 켜져 있고 송폼이 있으면 추가
          const forms = downloadOptionsRef.current.includeSongForm ? songForms[song.id] : undefined
          if (forms && forms.length > 0) {
            const formText = forms.join(' - ')
            
            // 크기 설정
            const sizeMap = {
              small: 14,
              medium: 18,
              large: 24
            }
            const sizeMapLarge = {
              small: 48,
              medium: 64,
              large: 80
            }
            const baseFontSize = position?.size ? sizeMapLarge[position.size] : 64
            const fontSize = Math.max(baseFontSize, canvas.width / 15)
            
            ctx.font = `bold ${fontSize}px Arial, sans-serif`
            
            const textWidth = ctx.measureText(formText).width
            const padding = 12
            const boxHeight = fontSize + padding * 2
            const boxWidth = textWidth + padding * 2
            
            // 위치 계산 (position 사용)
            let x: number
            let y: number
            
            if (position) {
              x = (canvas.width * position.x / 100) - boxWidth / 2
              y = canvas.height * (100 - position.y) / 100
            } else {
              x = canvas.width - boxWidth - 20
              y = 20
            }
            
            // 화면 밖으로 나가지 않게 조정
            x = Math.max(10, Math.min(x, canvas.width - boxWidth - 10))
            y = Math.max(10, Math.min(y, canvas.height - boxHeight - 10))

            // 텍스트 (흰색 외곽선 + 보라색 본문) - 배경 없음
            ctx.font = `900 ${fontSize}px Arial, sans-serif`
            ctx.textBaseline = 'middle'
            ctx.lineWidth = 24
            ctx.strokeStyle = '#ffffff'
            ctx.strokeText(formText, x + padding, y + boxHeight / 2)
            ctx.fillStyle = '#7C3AED'
            ctx.fillText(formText, x + padding, y + boxHeight / 2)
          }

          // 파트 태그 그리기
          const songPartTags = partTagsRef.current?.[song.id] || []
          if (songPartTags.length > 0) {
            for (const tag of songPartTags) {
              const tagFontSize = Math.max(48, canvas.width / 18)
              const tagPadding = 16
              
              ctx.font = `bold ${tagFontSize}px Arial, sans-serif`
              const tagTextWidth = ctx.measureText(tag.label).width
              const tagBoxWidth = tagTextWidth + tagPadding * 2
              const tagBoxHeight = tagFontSize + tagPadding
              
              // 퍼센트를 캔버스 좌표로 변환
              const tagX = (canvas.width * tag.x / 100) - tagBoxWidth / 2
              const tagY = (canvas.height * tag.y / 100) - tagBoxHeight / 2
              
              // 파트 태그 색상
              const tagColors: { [key: string]: string } = {
                'I': '#ef4444', 'V': '#3b82f6', 'V1': '#3b82f6', 'V2': '#2563eb', 'V3': '#1d4ed8',
                'PC': '#eab308', 'C': '#22c55e', 'C1': '#22c55e', 'C2': '#16a34a',
                'B': '#a855f7', '간주': '#f97316', 'Out': '#6b7280'
              }
              const tagColor = tagColors[tag.label] || '#6b7280'
              
              // 텍스트 (흰색 외곽선 + 색상 본문) - 배경 없음
              ctx.font = `900 ${tagFontSize}px Arial, sans-serif`
              ctx.textBaseline = 'middle'
              ctx.lineWidth = 20
              ctx.strokeStyle = '#ffffff'
              ctx.strokeText(tag.label, tagX + tagPadding, tagY + tagBoxHeight / 2)
              ctx.fillStyle = tagColor
              ctx.fillText(tag.label, tagX + tagPadding, tagY + tagBoxHeight / 2)
            }
          }

          // 다운로드
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Blob 생성 실패'))
              return
            }

            const filename = sanitizeFilename(`${String(index + 1).padStart(2, '0')}_${song.song_name}`)
            
            if (isMobileDevice() && navigator.share) {
              const file = new File([blob], `${filename}.jpg`, { type: 'image/jpeg' })
              navigator.share({ files: [file] }).then(resolve).catch(reject)
            } else {
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${filename}.jpg`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
              resolve()
            }
          }, 'image/jpeg', 0.95)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = song.file_url!
    })
  }

  // PDF를 JPG로 변환 다운로드
  const downloadPdfAsJpg = async (
    song: Song, 
    index: number,
    position?: SongFormPosition
  ): Promise<void> => {
    try {
      const pdfjsLib = (window as any).pdfjsLib
      if (!pdfjsLib) {
        throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.')
      }

      const loadingTask = pdfjsLib.getDocument(song.file_url)
      const pdf = await loadingTask.promise
      const pageCount = pdf.numPages

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

        // 🆕 송폼 옵션이 켜져 있을 때만 추가 (첫 페이지에만)
      if (pageNum === 1 && downloadOptionsRef.current.includeSongForm) {
        const forms = songForms[song.id]
        if (forms && forms.length > 0) {
            const formText = forms.join(' - ')
            
            // 크기 설정
            const sizeMap = {
              small: 14,
              medium: 18,
              large: 24
            }
            const sizeMapLarge = {
              small: 48,
              medium: 64,
              large: 80
            }
            const baseFontSize = position?.size ? sizeMapLarge[position.size] : 64
            const fontSize = Math.max(baseFontSize, canvas.width / 15)
            
            ctx.font = `bold ${fontSize}px Arial, sans-serif`
            
            const textWidth = ctx.measureText(formText).width
            const padding = 12
            const boxHeight = fontSize + padding * 2
            const boxWidth = textWidth + padding * 2
            
            // 위치 계산
            let x: number
            let y: number
            
            if (position) {
              x = (canvas.width * position.x / 100) - boxWidth / 2
              y = canvas.height * (100 - position.y) / 100
            } else {
              x = canvas.width - boxWidth - 20
              y = 20
            }
            
            x = Math.max(10, Math.min(x, canvas.width - boxWidth - 10))
            y = Math.max(10, Math.min(y, canvas.height - boxHeight - 10))

            // 텍스트 (흰색 외곽선 + 보라색 본문) - 배경 없음
            ctx.font = `900 ${fontSize}px Arial, sans-serif`
            ctx.textBaseline = 'middle'
            ctx.lineWidth = 24
            ctx.strokeStyle = '#ffffff'
            ctx.strokeText(formText, x + padding, y + boxHeight / 2)
            ctx.fillStyle = '#7C3AED'
            ctx.fillText(formText, x + padding, y + boxHeight / 2)
          }
        }

        // 🆕 파트 태그 그리기 (첫 페이지에만)
        if (pageNum === 1) {
          const songPartTags = partTagsRef.current?.[song.id] || []
          if (songPartTags.length > 0) {
            for (const tag of songPartTags) {
              const tagFontSize = Math.max(48, canvas.width / 18)
              const tagPadding = 16
              
              ctx.font = `bold ${tagFontSize}px Arial, sans-serif`
              const tagTextWidth = ctx.measureText(tag.label).width
              const tagBoxWidth = tagTextWidth + tagPadding * 2
              const tagBoxHeight = tagFontSize + tagPadding
              
              const tagX = (canvas.width * tag.x / 100) - tagBoxWidth / 2
              const tagY = (canvas.height * tag.y / 100) - tagBoxHeight / 2
              
              const tagColors: { [key: string]: string } = {
                'I': '#ef4444', 'V': '#3b82f6', 'V1': '#3b82f6', 'V2': '#2563eb', 'V3': '#1d4ed8',
                'PC': '#eab308', 'C': '#22c55e', 'C1': '#22c55e', 'C2': '#16a34a',
                'B': '#a855f7', '간주': '#f97316', 'Out': '#6b7280'
              }
              const tagColor = tagColors[tag.label] || '#6b7280'
              
              // 텍스트 (흰색 외곽선 + 색상 본문) - 배경 없음
              ctx.font = `900 ${tagFontSize}px Arial, sans-serif`
              ctx.textBaseline = 'middle'
              ctx.lineWidth = 20
              ctx.strokeStyle = '#ffffff'
              ctx.strokeText(tag.label, tagX + tagPadding, tagY + tagBoxHeight / 2)
              ctx.fillStyle = tagColor
              ctx.fillText(tag.label, tagX + tagPadding, tagY + tagBoxHeight / 2)
            }
          }
        }

        // 다운로드
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve()
              return
            }

            const pageSuffix = pageCount > 1 ? `_p${pageNum}` : ''
            const filename = sanitizeFilename(`${String(index + 1).padStart(2, '0')}_${song.song_name}${pageSuffix}`)

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

  // 🆕 PPT 생성 (이것을 먼저!)
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

  // 🆕 PPT 다운로드 시작 (이것을 나중에!)
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
    // 상태
    downloadingPDF,
    downloadingImage,
    downloadingPPT, // 🆕 추가
    showFormatModal,
    showPositionModal,
    showPPTModal, // 🆕 추가

    // 상태 설정
    setShowFormatModal,
    setShowPositionModal,
    setShowPPTModal, // 🆕 추가

    // 🆕 다운로드 옵션
    downloadOptions,
    setDownloadOptions,
    hasSongsWithForms,

    // 액션
    handleDownload,
    onPositionConfirm,
    onPositionCancel,
    startDownloadWithFormat,
    startPPTDownload,         // 🆕 추가
    generatePPTWithOptions,   // 🆕 추가
  }
}