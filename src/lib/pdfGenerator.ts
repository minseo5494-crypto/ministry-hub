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

export interface PDFGenerateOptions {
  title: string
  date: string
  songs: PDFSong[]
  songForms: { [key: string]: string[] }
  songFormPositions?: { [key: string]: SongFormPosition }
}

/**
 * 크기에 따른 폰트 크기와 패딩 반환 - 일관성 있게 수정
 */
const getSizeConfig = (size: SizeType = 'medium') => {
  const sizeMap = {
    small: { fontSize: 14, padding: 10 },   // 더 일관성 있는 크기
    medium: { fontSize: 18, padding: 12 },  // 표준 크기
    large: { fontSize: 24, padding: 16 }    // 큰 크기
  }
  return sizeMap[size]
}

/**
 * 퍼센트 좌표를 실제 좌표로 변환 - 전체 A4 페이지 기준으로 수정
 */
const calculatePositionFromPercent = (
  percentX: number,
  percentY: number,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number
): { x: number; y: number } => {
  // X 좌표: 전체 A4 페이지 기준으로 계산
  let x
  if (percentX <= 20) { // 왼쪽
    x = 40 // 페이지 왼쪽 여백
  } else if (percentX >= 80) { // 오른쪽
    x = pageWidth - textWidth - 40 // 페이지 오른쪽 여백
  } else { // 가운데
    x = (pageWidth - textWidth) / 2 // 페이지 정중앙
  }
  
  // Y 좌표: 상단에서 15포인트만 떨어진 위치 (더 상단으로)
  const y = pageHeight - fontSize - 15 // 상단에서 15포인트만 아래
  
  return { x, y }
}

/**
 * PDF 생성 함수
 */
export const generatePDF = async (options: PDFGenerateOptions) => {
  const { title, date, songs, songForms, songFormPositions } = options

  if (songs.length === 0) {
    throw new Error('곡이 없습니다.')
  }

  console.log('==================== PDF 생성 시작 ====================')
  console.log('선택된 곡 목록:', songs.map(s => ({ id: s.id, name: s.song_name })))
  console.log('각 곡별 송폼:', songForms)
  console.log('각 곡별 송폼 위치:', songFormPositions)

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
            
            // 원본 페이지를 A4에 맞게 스케일 조정
            const scale = Math.min(
              A4_WIDTH / srcWidth,
              A4_HEIGHT / srcHeight
            ) * 0.95 // 95%로 여백 확보
            
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

              // 전체 A4 페이지 기준으로 위치 계산
              let textX, textY
              if (songPosition) {
                const position = calculatePositionFromPercent(
                  songPosition.x,
                  songPosition.y,
                  A4_WIDTH,
                  A4_HEIGHT,
                  textWidth,
                  fontSize
                )
                textX = position.x
                textY = position.y
                console.log(` 📍 저장된 위치 사용: ${songPosition.x}%, ${songPosition.y}%`)
                console.log(` 📍 실제 좌표: x=${textX}, y=${textY}`)
              } else {
                // 기본값: 우측 상단
                textX = A4_WIDTH - textWidth - 40
                textY = A4_HEIGHT - fontSize - 15
                console.log(` 📍 기본 위치 사용: 우측 상단`)
              }

              // 배경 박스
              newPage.drawRectangle({
                x: textX - padding,
                y: textY - (padding * 0.5),
                width: textWidth + (padding * 2),
                height: fontSize + padding,
                color: rgb(1, 1, 1),
                opacity: 0.9,
              })

              // 텍스트
              newPage.drawText(formText, {
                x: textX,
                y: textY,
                size: fontSize,
                font: koreanFont,
                color: rgb(0.4, 0.2, 0.8),
              })

              console.log(`✅ PDF 송폼 표시 성공! (곡 ${i + 1}: ${song.song_name})`)
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
          const scale = Math.min(A4_WIDTH / imgWidth, A4_HEIGHT / imgHeight) * 0.95 // 95%로 여백 확보

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

            // 전체 A4 페이지 기준으로 위치 계산
            let textX, textY
            if (songPosition) {
              const position = calculatePositionFromPercent(
                songPosition.x,
                songPosition.y,
                A4_WIDTH,
                A4_HEIGHT,
                textWidth,
                fontSize
              )
              textX = position.x
              textY = position.y
              console.log(` 📍 이미지: 저장된 위치 사용: ${songPosition.x}%, ${songPosition.y}%`)
              console.log(` 📍 이미지: 실제 좌표: x=${textX}, y=${textY}`)
            } else {
              // 기본값: 우측 상단
              textX = A4_WIDTH - textWidth - 40
              textY = A4_HEIGHT - fontSize - 15
              console.log(` 📍 이미지: 기본 위치 사용: 우측 상단`)
            }

            // 배경 박스
            page.drawRectangle({
              x: textX - padding,
              y: textY - (padding * 0.5),
              width: textWidth + (padding * 2),
              height: fontSize + padding,
              color: rgb(1, 1, 1),
              opacity: 0.9,
            })

            // 텍스트
            page.drawText(formText, {
              x: textX,
              y: textY,
              size: fontSize,
              font: koreanFont,
              color: rgb(0.4, 0.2, 0.8),
            })
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