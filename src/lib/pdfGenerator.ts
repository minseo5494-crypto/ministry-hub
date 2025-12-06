import { loadKoreanFont } from './fontLoader'

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
    marginPercent = 0         // 🆕 기본값 0
  } = options

  if (songs.length === 0) {
    throw new Error('곡이 없습니다.')
  }

  console.log('==================== PDF 생성 시작 ====================')
  console.log('선택된 곡 목록:', songs.map(s => ({ id: s.id, name: s.song_name })))
  console.log('각 곡별 송폼:', songForms)
  console.log('각 곡별 송폼 위치:', songFormPositions)
  console.log('🏷️ 각 곡별 파트 태그:', partTags)  // 🆕 디버깅

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
    console.log('✅ fontkit 등록 완료')

    // 한글 폰트 로드
    console.log('📝 한글 폰트 로딩 시작...')
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
          ${title}
        </h1>
        <p style="font-size: 28px; color: #4a5568; margin-bottom: 60px;">
          ${date}
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
              <strong style="color: #2d3748;">${song.song_name}</strong>
              ${song.team_name ? `<span style="color: #718096;"> - ${song.team_name}</span>` : ''}
              ${song.keyTransposed || song.key ? `<span style="color: #805ad5; margin-left: 10px;">(Key: ${song.keyTransposed || song.key})</span>` : ''}
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
    console.log('✅ 표지 페이지 생성 완료')
  } // 🆕 if (includeCover) 닫기

    // 각 곡별 악보 페이지 추가
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      console.log(`\n📄 처리 중: ${i + 1}/${songs.length} - ${song.song_name}`)

      if (!song.file_url) {
        console.warn(`⚠️ "${song.song_name}"에 악보 파일이 없습니다. 건너뜁니다.`)
        continue
      }

      try {
        const response = await fetch(song.file_url)
        const arrayBuffer = await response.arrayBuffer()

        // 송폼 정보 가져오기
        const selectedForms = songForms[song.id] || song.selectedForm || []
        const songPosition = songFormPositions?.[song.id]
        const formSize = songPosition?.size || 'medium' // 크기 정보

        console.log(`📍 송폼 위치 정보:`, songPosition)
        console.log(`📐 송폼 크기:`, formSize)

        // PDF 파일 처리
        if (song.file_type === 'pdf' || song.file_url.toLowerCase().endsWith('.pdf')) {
          const sheetPdf = await PDFDocument.load(arrayBuffer)
          const pageCount = sheetPdf.getPageCount()
          console.log(`📄 PDF 페이지 수: ${pageCount}`)

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
              console.log(`✅ PDF 송폼 오버레이 시작: ${song.song_name}`)
              console.log(` 송폼 내용: ${selectedForms.join(' - ')}`)

              const formText = selectedForms.join(' - ')
              const { fontSize, padding } = getSizeConfig(formSize)
              const textWidth = koreanFont.widthOfTextAtSize(formText, fontSize)

              console.log(` 📐 폰트 크기: ${fontSize}, 패딩: ${padding}`)

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
                console.log(` 📍 저장된 위치 사용: ${songPosition.x}%, ${songPosition.y}%`)
                console.log(` 📍 실제 좌표: x=${textX}, y=${textY}`)
              } else {
                // 기본값: 악보 우측 상단
                const boxHeight = fontSize + padding
                textX = x + scaledWidth - textWidth - (padding * 2) - 20 + padding
                textY = y + scaledHeight - boxHeight - 15 + (padding * 0.25)
                console.log(` 📍 기본 위치 사용: 악보 우측 상단`)
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

              console.log(`✅ PDF 송폼 표시 성공! (곡 ${i + 1}: ${song.song_name})`)
              // 🆕 파트 태그 그리기
              const songPartTags = partTags?.[song.id] || []
              if (songPartTags.length > 0 && koreanFont) {
                console.log(`🏷️ 파트 태그 ${songPartTags.length}개 그리기`)
                
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
                console.log(`✅ 파트 태그 표시 완료`)
              }
            }
          }

          console.log(`✅ PDF 악보 처리 완료: ${song.song_name}`)
        }
        // 이미지 파일 처리
        else {
          console.log('🖼️ 이미지 파일 처리 중...')

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

            console.log(` 📐 이미지: 폰트 크기: ${fontSize}, 패딩: ${padding}`)

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
              console.log(` 📍 이미지: 저장된 위치 사용: ${songPosition.x}%, ${songPosition.y}%`)
              console.log(` 📍 이미지: 실제 좌표: x=${textX}, y=${textY}`)
            } else {
              // 기본값: 악보 우측 상단
              const defaultBoxHeight = fontSize + padding
              textX = x + scaledWidth - textWidth - (padding * 2) - 20 + padding
              textY = y + scaledHeight - defaultBoxHeight - 15 + (padding * 0.25)
              console.log(` 📍 이미지: 기본 위치 사용: 악보 우측 상단`)
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
            console.log(`🏷️ 이미지: 파트 태그 ${songPartTags.length}개 그리기`)
            
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
            console.log(`✅ 이미지: 파트 태그 표시 완료`)
          }

          console.log(`✅ 이미지 악보 처리 완료: ${song.song_name}`)
        }
      } catch (error) {
        console.error(`❌ "${song.song_name}" 처리 중 오류:`, error)
      }
    }

    // PDF 다운로드
    const pdfBytes = await mergedPdf.save()
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title}_${date.replace(/\./g, '')}.pdf`
    link.click()
    URL.revokeObjectURL(url)

    console.log('✅ PDF 생성 완료!')
    return true
  } catch (error) {
    console.error('PDF 생성 오류:', error)
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
}) => {
  const { title, date, songs, canvasDataUrls, includeCover = true } = options

  if (songs.length === 0) {
    throw new Error('곡이 없습니다.')
  }

  console.log('==================== WYSIWYG PDF 생성 시작 (다중 페이지) ====================')
  console.log('곡 수:', songs.length)
  console.log('캔버스 데이터:', Object.keys(canvasDataUrls))

  try {
    const pdfLib = await import('pdf-lib')
    const { PDFDocument } = pdfLib
    const jsPDFModule = await import('jspdf')
    const jsPDF = jsPDFModule.default
    const html2canvas = (await import('html2canvas')).default

    const mergedPdf = await PDFDocument.create()

    // A4 크기
    const A4_WIDTH = 595.28
    const A4_HEIGHT = 841.89

    // 표지 생성
    if (includeCover) {
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
            ${title}
          </h1>
          <p style="font-size: 28px; color: #4a5568; margin-bottom: 60px;">
            ${date}
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
                <strong style="color: #2d3748;">${song.song_name}</strong>
                ${song.team_name ? `<span style="color: #718096;"> - ${song.team_name}</span>` : ''}
                ${song.keyTransposed || song.key ? `<span style="color: #805ad5; margin-left: 10px;">(Key: ${song.keyTransposed || song.key})</span>` : ''}
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
      console.log('✅ 표지 페이지 생성 완료')
    }

    // 🆕 각 곡의 모든 페이지를 PDF에 추가
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      const canvasDataUrlArray = canvasDataUrls[song.id]

      if (!canvasDataUrlArray || canvasDataUrlArray.length === 0) {
        console.warn(`⚠️ "${song.song_name}"의 캔버스 데이터가 없습니다. 건너뜁니다.`)
        continue
      }

      console.log(`\n📄 처리 중: ${i + 1}/${songs.length} - ${song.song_name} (${canvasDataUrlArray.length}페이지)`)

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

          console.log(`  ✅ 페이지 ${pageIdx + 1}/${canvasDataUrlArray.length} 추가 완료`)
        }

        console.log(`✅ ${song.song_name} 완료 (${canvasDataUrlArray.length}페이지)`)

      } catch (error) {
        console.error(`❌ "${song.song_name}" 처리 중 오류:`, error)
      }
    }

    // PDF 다운로드
    const pdfBytes = await mergedPdf.save()
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title}_${date.replace(/\./g, '')}.pdf`
    link.click()
    URL.revokeObjectURL(url)

    console.log('✅ WYSIWYG PDF 생성 완료!')
    return true

  } catch (error) {
    console.error('PDF 생성 오류:', error)
    throw error
  }
}