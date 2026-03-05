import { loadKoreanFont } from './fontLoader'
import { NotebookPage } from '@/types/notebook'

// XSS 방어: HTML 이스케이프
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export interface PDFSong {
  id: string
  song_name: string
  team_name?: string
  key?: string
  file_url?: string
  file_type?: string
  lyrics?: string
  selectedForm?: string[]
  keyTransposed?: string
  notes?: string
}

// 송폼 크기 타입
type SizeType = 'small' | 'medium' | 'large'

// 송폼 위치를 퍼센트로 저장 (0~100)
export interface SongFormPosition {
  x: number // 0~100 (왼쪽 0%, 오른쪽 100%)
  y: number // 0~100 (위쪽 100%, 아래쪽 0%) 
  size?: SizeType // 크기 정보
}

// 🆕 파트 태그 타입
export interface PartTag {
  id: string
  label: string
  x: number
  y: number
}

export interface PDFGenerateOptions {
  title: string
  date: string
  songs: PDFSong[]
  songForms: { [key: string]: string[] }
  songFormPositions?: { [key: string]: SongFormPosition }
  partTags?: { [songId: string]: PartTag[] }  // 🆕 추가
  includeCover?: boolean
  marginPercent?: number
  customFileName?: string  // 사용자 지정 파일명
  onProgress?: (current: number, total: number, songName?: string) => void  // 진행률 콜백
}

const getSizeConfig = (size: string) => {
  switch (size) {
    case 'small':
      return { fontSize: 36, padding: 18 }
    case 'large':
      return { fontSize: 56, padding: 28 }
    default: // medium
      return { fontSize: 46, padding: 22 }
  }
}

// 🆕 파트 태그 색상 매핑
const getPartTagColor = (label: string) => {
  const colorMap: { [key: string]: { r: number; g: number; b: number } } = {
    'I': { r: 0.94, g: 0.27, b: 0.27 },      // 빨강
    'V': { r: 0.23, g: 0.51, b: 0.96 },      // 파랑
    'V1': { r: 0.23, g: 0.51, b: 0.96 },
    'V2': { r: 0.19, g: 0.45, b: 0.86 },
    'V3': { r: 0.15, g: 0.39, b: 0.76 },
    'PC': { r: 0.92, g: 0.69, b: 0.15 },     // 노랑
    'C': { r: 0.22, g: 0.80, b: 0.45 },      // 초록
    'C1': { r: 0.22, g: 0.80, b: 0.45 },
    'C2': { r: 0.16, g: 0.70, b: 0.38 },
    'B': { r: 0.58, g: 0.34, b: 0.92 },      // 보라
    '간주': { r: 0.96, g: 0.49, b: 0.13 },   // 주황
    'Out': { r: 0.42, g: 0.45, b: 0.49 },    // 회색
  }
  return colorMap[label] || { r: 0.5, g: 0.5, b: 0.5 }
}

/**
 * 퍼센트 좌표를 실제 좌표로 변환 - 전체 A4 페이지 기준으로 수정
 */
const calculatePositionFromPercent = (
  percentX: number,
  percentY: number,
  sheetX: number,      // 🆕 악보 시작 X 좌표
  sheetY: number,      // 🆕 악보 시작 Y 좌표
  sheetWidth: number,  // 🆕 악보 너비
  sheetHeight: number, // 🆕 악보 높이
  textWidth: number,
  boxHeight: number
): { x: number; y: number } => {
  // X 좌표: 악보 영역 기준으로 계산
  let x
  if (percentX <= 20) { // 왼쪽
    x = sheetX + 20 // 악보 왼쪽에서 20포인트
  } else if (percentX >= 80) { // 오른쪽
    x = sheetX + sheetWidth - textWidth - 20 // 악보 오른쪽에서 20포인트
  } else { // 가운데
    x = sheetX + (sheetWidth - textWidth) / 2 // 악보 중앙
  }

  // Y 좌표: 악보 상단에서 15포인트 아래 (PDF 좌표계는 아래가 0)
  const y = sheetY + sheetHeight - boxHeight - 15

  return { x, y }
}

/**
 * PDF 생성 함수
 */
export const generatePDF = async (options: PDFGenerateOptions) => {
  const {
    title,
    date,
    songs,
    songForms,
    songFormPositions,
    partTags,
    includeCover = true,      // 🆕 기본값 true
    marginPercent = 0,        // 🆕 기본값 0
    customFileName,           // 사용자 지정 파일명
    onProgress                // 진행률 콜백
  } = options

  if (songs.length === 0) {
    throw new Error('곡이 없습니다.')
  }

  try {
    const pdfLib = await import('pdf-lib')
    const { PDFDocument, rgb } = pdfLib
    const jsPDFModule = await import('jspdf')
    const jsPDF = jsPDFModule.default
    const html2canvas = (await import('html2canvas')).default

    const mergedPdf = await PDFDocument.create()
    
    // A4 크기 정의
    const A4_WIDTH = 595.28
    const A4_HEIGHT = 841.89

    // fontkit 등록
    const fontkit = await import('@pdf-lib/fontkit')
    mergedPdf.registerFontkit(fontkit.default)

    // 한글 폰트 로드
    let koreanFont = null
    try {
      const fontBytes = await loadKoreanFont()
      if (fontBytes) {
        koreanFont = await mergedPdf.embedFont(fontBytes)
      }
    } catch {
      // 폰트 로드 실패 시 기본 폰트 사용
    }

    // 🆕 표지 포함 옵션이 true일 때만 생성
  if (includeCover) {
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
          ${escapeHtml(title)}
        </h1>
        <p style="font-size: 28px; color: #4a5568; margin-bottom: 60px;">
          ${escapeHtml(date)}
        </p>
      </div>

      <div style="margin-top: 80px;">
        <h2 style="font-size: 24px; font-weight: 600; color: #2d3748; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
          곡 목록
        </h2>
        <ol style="list-style: none; padding: 0; margin: 0;">
          ${songs.map((song, i) => `
            <li style="font-size: 18px; color: #4a5568; margin-bottom: 16px; padding-left: 30px; position: relative;">
              <span style="position: absolute; left: 0; color: #3182ce; font-weight: 600;">${i + 1}.</span>
              <strong style="color: #2d3748;">${escapeHtml(song.song_name)}</strong>
              ${song.team_name ? `<span style="color: #718096;"> - ${escapeHtml(song.team_name)}</span>` : ''}
              ${song.keyTransposed || song.key ? `<span style="color: #805ad5; margin-left: 10px;">(Key: ${escapeHtml(song.keyTransposed || song.key || '')})</span>` : ''}
            </li>
          `).join('')}
        </ol>
      </div>
    `

    document.body.appendChild(coverDiv)
    const coverCanvas = await html2canvas(coverDiv, { scale: 2 })
    document.body.removeChild(coverDiv)

    const coverImgData = coverCanvas.toDataURL('image/png')
    const coverPdf = new jsPDF('p', 'mm', 'a4')
    coverPdf.addImage(coverImgData, 'PNG', 0, 0, 210, 297)
    const coverPdfBytes = coverPdf.output('arraybuffer')
    const coverDoc = await PDFDocument.load(coverPdfBytes)

    const [coverPage] = await mergedPdf.copyPages(coverDoc, [0])
    mergedPdf.addPage(coverPage)
  } // 🆕 if (includeCover) 닫기

    // 각 곡별 악보 페이지 추가
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]

      // 진행률 콜백 호출
      if (onProgress) {
        onProgress(i + 1, songs.length, song.song_name)
        // UI가 업데이트될 시간을 주기 위해 지연
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (!song.file_url) {
        continue
      }

      try {
        // 네트워크 오류 시 재시도 로직 (최대 3회)
        let arrayBuffer: ArrayBuffer | null = null
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            // cache: 'no-store'로 캐시 무시, 네트워크 직접 요청
            const response = await fetch(song.file_url, {
              cache: 'no-store',
              mode: 'cors',
            })
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }
            arrayBuffer = await response.arrayBuffer()
            break // 성공 시 루프 탈출
          } catch (fetchError) {
            lastError = fetchError as Error
            if (attempt < 3) {
              // 재시도 전 대기 (1초, 2초) - 더 긴 대기 시간
              await new Promise(resolve => setTimeout(resolve, attempt * 1000))
            }
          }
        }

        if (!arrayBuffer) {
          throw lastError || new Error('파일 다운로드 실패')
        }

        // 송폼 정보 가져오기
        const selectedForms = songForms[song.id] || song.selectedForm || []
        const songPosition = songFormPositions?.[song.id]
        const formSize = songPosition?.size || 'medium' // 크기 정보

        // PDF 파일 처리
        if (song.file_type === 'pdf' || song.file_url.toLowerCase().endsWith('.pdf')) {
          const sheetPdf = await PDFDocument.load(arrayBuffer)
          const pageCount = sheetPdf.getPageCount()

          for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
            const srcPage = sheetPdf.getPage(pageIdx)
            const { width: srcWidth, height: srcHeight } = srcPage.getSize()
            
            // A4 크기로 새 페이지 생성
            const newPage = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])
            
            // 🆕 원본 페이지를 A4에 맞게 스케일 조정 (여백 옵션 적용)
        // marginPercent가 0이면 0.95, 30이면 약 1.04 (더 크게)
        const baseMarginScale = 0.95 + (marginPercent / 100 * 0.15)
        const scale = Math.min(
          A4_WIDTH / srcWidth,
          A4_HEIGHT / srcHeight
        ) * baseMarginScale
            
            const scaledWidth = srcWidth * scale
            const scaledHeight = srcHeight * scale
            
            // 중앙 정렬
            const x = (A4_WIDTH - scaledWidth) / 2
            const y = (A4_HEIGHT - scaledHeight) / 2
            
            // PDF 페이지 임베드
            const embeddedPage = await mergedPdf.embedPage(srcPage)
            
            // 스케일된 PDF 그리기
            newPage.drawPage(embeddedPage, {
              x: x,
              y: y,
              width: scaledWidth,
              height: scaledHeight,
            })

            // 송폼 오버레이 (각 곡의 첫 페이지에만)
            if (pageIdx === 0 && selectedForms.length > 0 && koreanFont) {
              const formText = selectedForms.join(' - ')
              const { fontSize, padding } = getSizeConfig(formSize)
              const textWidth = koreanFont.widthOfTextAtSize(formText, fontSize)

              // 🆕 악보 영역 기준으로 위치 계산
              const boxHeight = fontSize + padding
              let textX, textY
              if (songPosition) {
                const position = calculatePositionFromPercent(
                  songPosition.x,
                  songPosition.y,
                  x,              // 🆕 악보 시작 X
                  y,              // 🆕 악보 시작 Y
                  scaledWidth,    // 🆕 악보 너비
                  scaledHeight,   // 🆕 악보 높이
                  textWidth + (padding * 2),  // 박스 전체 너비
                  boxHeight
                )
                textX = position.x + padding  // 텍스트는 패딩 안쪽
                textY = position.y + (padding * 0.25)
              } else {
                // 기본값: 악보 우측 상단
                const boxHeight = fontSize + padding
                textX = x + scaledWidth - textWidth - (padding * 2) - 20 + padding
                textY = y + scaledHeight - boxHeight - 15 + (padding * 0.25)
              }

              const outlineOffsets: [number, number][] = []
              const outlineThickness = 8
              for (let dx = -outlineThickness; dx <= outlineThickness; dx += 2) {
                for (let dy = -outlineThickness; dy <= outlineThickness; dy += 2) {
                  if (dx !== 0 || dy !== 0) {
                    outlineOffsets.push([dx, dy])
                  }
                }
              }
              for (const [ox, oy] of outlineOffsets) {
                newPage.drawText(formText, {
                  x: textX + ox,
                  y: textY + oy,
                  size: fontSize,
                  font: koreanFont,
                  color: rgb(1, 1, 1),
                })
              }
              // 본문 텍스트
              newPage.drawText(formText, {
                x: textX,
                y: textY,
                size: fontSize,
                font: koreanFont,
                color: rgb(0.49, 0.23, 0.93),
              })

              // 🆕 파트 태그 그리기
              const songPartTags = partTags?.[song.id] || []
              if (songPartTags.length > 0 && koreanFont) {
                
                for (const tag of songPartTags) {
                  const tagFontSize = 36
                  const tagPadding = 14

                  const tagText = tag.label
                  const tagTextWidth = koreanFont.widthOfTextAtSize(tagText, tagFontSize)
                  const tagBoxWidth = tagTextWidth + tagPadding * 2
                  const tagBoxHeight = tagFontSize + tagPadding
                  
                  // 퍼센트를 악보 영역 내 좌표로 변환
                  const tagX = x + (scaledWidth * tag.x / 100) - tagBoxWidth / 2
                  const tagY = y + scaledHeight - (scaledHeight * tag.y / 100) - tagBoxHeight / 2
                  
                  const color = getPartTagColor(tag.label)
                  
                  // 텍스트 (흰색 외곽선 + 색상 본문)
              const tagOutlineOffsets: [number, number][] = []
              const tagOutlineThickness = 6
              for (let dx = -tagOutlineThickness; dx <= tagOutlineThickness; dx += 2) {
                for (let dy = -tagOutlineThickness; dy <= tagOutlineThickness; dy += 2) {
                  if (dx !== 0 || dy !== 0) {
                    tagOutlineOffsets.push([dx, dy])
                  }
                }
              }
              for (const [ox, oy] of tagOutlineOffsets) {
                newPage.drawText(tagText, {
                  x: tagX + tagPadding + ox,
                  y: tagY + tagPadding * 0.3 + oy,
                  size: tagFontSize,
                  font: koreanFont,
                  color: rgb(1, 1, 1),
                })
              }
              // 본문 텍스트
              newPage.drawText(tagText, {
                x: tagX + tagPadding,
                y: tagY + tagPadding * 0.3,
                size: tagFontSize,
                font: koreanFont,
                color: rgb(color.r, color.g, color.b),
              })
                }
              }
            }
          }
        }
        // 이미지 파일 처리
        else {

          let image
          if (song.file_url.toLowerCase().endsWith('.png')) {
            image = await mergedPdf.embedPng(arrayBuffer)
          } else {
            image = await mergedPdf.embedJpg(arrayBuffer)
          }

          // A4 크기로 페이지 생성
          const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])

          const imgWidth = image.width
      const imgHeight = image.height
      // 🆕 여백 옵션 적용
      const baseMarginScale = 0.95 + (marginPercent / 100 * 0.15)
      const scale = Math.min(A4_WIDTH / imgWidth, A4_HEIGHT / imgHeight) * baseMarginScale

          const scaledWidth = imgWidth * scale
          const scaledHeight = imgHeight * scale

          const x = (A4_WIDTH - scaledWidth) / 2
          const y = (A4_HEIGHT - scaledHeight) / 2

          page.drawImage(image, {
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight,
          })

          // 송폼 오버레이
          if (selectedForms.length > 0 && koreanFont) {
            const formText = selectedForms.join(' - ')
            const { fontSize, padding } = getSizeConfig(formSize)
            const textWidth = koreanFont.widthOfTextAtSize(formText, fontSize)

            // 🆕 악보 영역 기준으로 위치 계산
            const boxHeight = fontSize + padding
            let textX, textY
            if (songPosition) {
              const position = calculatePositionFromPercent(
                songPosition.x,
                songPosition.y,
                x,              // 🆕 악보 시작 X
                y,              // 🆕 악보 시작 Y
                scaledWidth,    // 🆕 악보 너비
                scaledHeight,   // 🆕 악보 높이
                textWidth + (padding * 2),
                boxHeight
              )
              textX = position.x + padding
              textY = position.y + (padding * 0.25)
            } else {
              // 기본값: 악보 우측 상단
              const defaultBoxHeight = fontSize + padding
              textX = x + scaledWidth - textWidth - (padding * 2) - 20 + padding
              textY = y + scaledHeight - defaultBoxHeight - 15 + (padding * 0.25)
            }

            // 텍스트 (흰색 외곽선 효과)
              const outlineOffsets: [number, number][] = []
              const outlineThickness = 8
              for (let dx = -outlineThickness; dx <= outlineThickness; dx += 2) {
                for (let dy = -outlineThickness; dy <= outlineThickness; dy += 2) {
                  if (dx !== 0 || dy !== 0) {
                    outlineOffsets.push([dx, dy])
                  }
                }
              }
              for (const [ox, oy] of outlineOffsets) {
                page.drawText(formText, {
                  x: textX + ox,
                  y: textY + oy,
                  size: fontSize,
                  font: koreanFont,
                  color: rgb(1, 1, 1),
                })
              }
              // 본문 텍스트
              page.drawText(formText, {
                x: textX,
                y: textY,
                size: fontSize,
                font: koreanFont,
                color: rgb(0.49, 0.23, 0.93),
              })
          }

          // 🆕 파트 태그 그리기 (이미지)
          const songPartTags = partTags?.[song.id] || []
          if (songPartTags.length > 0 && koreanFont) {
            
            for (const tag of songPartTags) {
              const tagFontSize = 36
              const tagPadding = 14

              const tagText = tag.label
              const tagTextWidth = koreanFont.widthOfTextAtSize(tagText, tagFontSize)
              const tagBoxWidth = tagTextWidth + tagPadding * 2
              const tagBoxHeight = tagFontSize + tagPadding
              
              // 퍼센트를 악보 영역 내 좌표로 변환
              const tagX = x + (scaledWidth * tag.x / 100) - tagBoxWidth / 2
              const tagY = y + scaledHeight - (scaledHeight * tag.y / 100) - tagBoxHeight / 2
              
              const color = getPartTagColor(tag.label)
              
              const tagOutlineOffsets: [number, number][] = []
              const tagOutlineThickness = 6
              for (let dx = -tagOutlineThickness; dx <= tagOutlineThickness; dx += 2) {
                for (let dy = -tagOutlineThickness; dy <= tagOutlineThickness; dy += 2) {
                  if (dx !== 0 || dy !== 0) {
                    tagOutlineOffsets.push([dx, dy])
                  }
                }
              }
              for (const [ox, oy] of tagOutlineOffsets) {
                page.drawText(tagText, {
                  x: tagX + tagPadding + ox,
                  y: tagY + tagPadding * 0.3 + oy,
                  size: tagFontSize,
                  font: koreanFont,
                  color: rgb(1, 1, 1),
                })
              }
              // 본문 텍스트
              page.drawText(tagText, {
                x: tagX + tagPadding,
                y: tagY + tagPadding * 0.3,
                size: tagFontSize,
                font: koreanFont,
                color: rgb(color.r, color.g, color.b),
              })
            }
          }
        }
      } catch (songError) {
        // 개별 곡 처리 실패 시 로그 후 건너뜀
        console.warn(`PDF 생성 중 곡 처리 실패 (${song.song_name}):`, songError)
      }
    }

    // PDF 다운로드
    const pdfBytes = await mergedPdf.save()
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    // 사용자 지정 파일명 또는 기본 파일명 사용
    const fileName = customFileName
      ? `${customFileName.replace(/[\\/:*?"<>|]/g, '_')}.pdf`
      : `${title}_${date.replace(/\./g, '')}.pdf`
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)

    return true
  } catch (error) {
    throw error
  }
}

/**
 * 🆕 WYSIWYG 방식 PDF 생성 - 다중 페이지 지원
 */
export const generatePDFFromCanvas = async (options: {
  title: string
  date: string
  songs: PDFSong[]
  canvasDataUrls: { [songId: string]: string[] }  // 🆕 다중 페이지
  includeCover?: boolean
  customFileName?: string  // 사용자 지정 파일명
  onProgress?: (current: number, total: number, songName?: string) => void  // 진행률 콜백
}) => {
  const { title, date, songs, canvasDataUrls, includeCover = true, customFileName, onProgress } = options

  if (songs.length === 0) {
    throw new Error('곡이 없습니다.')
  }

  try {
    const pdfLib = await import('pdf-lib')
    const { PDFDocument } = pdfLib

    const mergedPdf = await PDFDocument.create()

    // A4 크기
    const A4_WIDTH = 595.28
    const A4_HEIGHT = 841.89

    // 표지 생성 (필요할 때만 jspdf, html2canvas 로드)
    if (includeCover) {
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const html2canvas = (await import('html2canvas')).default
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
            ${escapeHtml(title)}
          </h1>
          <p style="font-size: 28px; color: #4a5568; margin-bottom: 60px;">
            ${escapeHtml(date)}
          </p>
        </div>

        <div style="margin-top: 80px;">
          <h2 style="font-size: 24px; font-weight: 600; color: #2d3748; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
            곡 목록
          </h2>
          <ol style="list-style: none; padding: 0; margin: 0;">
            ${songs.map((song, i) => `
              <li style="font-size: 18px; color: #4a5568; margin-bottom: 16px; padding-left: 30px; position: relative;">
                <span style="position: absolute; left: 0; color: #3182ce; font-weight: 600;">${i + 1}.</span>
                <strong style="color: #2d3748;">${escapeHtml(song.song_name)}</strong>
                ${song.team_name ? `<span style="color: #718096;"> - ${escapeHtml(song.team_name)}</span>` : ''}
                ${song.keyTransposed || song.key ? `<span style="color: #805ad5; margin-left: 10px;">(Key: ${escapeHtml(song.keyTransposed || song.key || '')})</span>` : ''}
              </li>
            `).join('')}
          </ol>
        </div>
      `

      document.body.appendChild(coverDiv)
      const coverCanvas = await html2canvas(coverDiv, { scale: 2 })
      document.body.removeChild(coverDiv)

      const coverImgData = coverCanvas.toDataURL('image/png')
      const coverPdf = new jsPDF('p', 'mm', 'a4')
      coverPdf.addImage(coverImgData, 'PNG', 0, 0, 210, 297)
      const coverPdfBytes = coverPdf.output('arraybuffer')
      const coverDoc = await PDFDocument.load(coverPdfBytes)

      const [coverPage] = await mergedPdf.copyPages(coverDoc, [0])
      mergedPdf.addPage(coverPage)
    }

    // 🆕 각 곡의 모든 페이지를 PDF에 추가
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      const canvasDataUrlArray = canvasDataUrls[song.id]

      // 진행률 콜백 호출 (곡 처리 시작 전)
      if (onProgress) {
        onProgress(i + 1, songs.length, song.song_name)
        // UI가 업데이트될 시간을 주기 위해 지연
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (!canvasDataUrlArray || canvasDataUrlArray.length === 0) {
        continue
      }

      try {
        // 🆕 모든 페이지 순회
        for (let pageIdx = 0; pageIdx < canvasDataUrlArray.length; pageIdx++) {
          const canvasDataUrl = canvasDataUrlArray[pageIdx]

          // Base64 데이터에서 이미지 추출
          const base64Data = canvasDataUrl.split(',')[1]
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

          // PNG 이미지 임베드
          const image = await mergedPdf.embedPng(imageBytes)

          // A4 페이지 생성
          const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])

          // 이미지를 페이지 전체에 그리기
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: A4_WIDTH,
            height: A4_HEIGHT,
          })

          // 각 페이지 처리 후 UI 업데이트 시간 확보
          await new Promise(resolve => setTimeout(resolve, 30))
        }
      } catch (songError) {
        // 개별 곡 처리 실패 시 로그 후 건너뜀
        console.warn(`WYSIWYG PDF 생성 중 곡 처리 실패 (${song.song_name}):`, songError)
      }
    }

    // PDF 다운로드
    const pdfBytes = await mergedPdf.save()
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    // 사용자 지정 파일명 또는 기본 파일명 사용
    const fileName = customFileName
      ? `${customFileName.replace(/[\\/:*?"<>|]/g, '_')}.pdf`
      : `${title}_${date.replace(/\./g, '')}.pdf`
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)

    return true
  } catch (error) {
    throw error
  }
}
// 노트북 페이지 타입에 따른 표시 이름
function getNotebookPageLabel(page: NotebookPage): string {
  switch (page.pageType) {
    case 'sheet':  return page.songName || `악보 ${page.order + 1}`
    case 'blank':  return `빈 페이지 ${page.order + 1}`
    case 'staff':  return `오선지 ${page.order + 1}`
    case 'upload': return page.uploadFileName || `업로드 ${page.order + 1}`
  }
}

/**
 * 노트북 전용 PDF 생성
 * generatePDFFromCanvas 래퍼 — pageId 기반 canvasDataUrls 처리
 * 빈/오선지/업로드 페이지는 canvas 데이터가 canvasDataUrls에 있으면 그대로 처리됨
 */
export const generateNotebookPDF = async (options: {
  title: string
  pages: NotebookPage[]
  canvasDataUrls: { [pageId: string]: string[] }
  customFileName?: string
  onProgress?: (current: number, total: number, pageName?: string) => void
}): Promise<boolean> => {
  const { title, pages, canvasDataUrls, customFileName, onProgress } = options

  if (pages.length === 0) {
    throw new Error('페이지가 없습니다.')
  }

  // NotebookPage[] → PDFSong[] 변환 (id = pageId로 canvasDataUrls 키와 연결)
  const songs: PDFSong[] = pages
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(page => ({
      id: page.id,
      song_name: getNotebookPageLabel(page),
      team_name: page.teamName,
    }))

  return generatePDFFromCanvas({
    title,
    date: new Date().toLocaleDateString('ko-KR'),
    songs,
    canvasDataUrls,
    includeCover: false,
    customFileName,
    onProgress,
  })
}
