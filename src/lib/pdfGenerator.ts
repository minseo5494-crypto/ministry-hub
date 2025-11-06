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

export interface PDFGenerateOptions {
  title: string
  date: string
  songs: PDFSong[]
  songForms: { [key: string]: string[] }
}

/**
 * PDF 생성 함수 (메인 페이지와 동일한 로직)
 */
export const generatePDF = async (options: PDFGenerateOptions) => {
  const { title, date, songs, songForms } = options

  if (songs.length === 0) {
    throw new Error('곡이 없습니다.')
  }

  console.log('==================== PDF 생성 시작 ====================')
  console.log('선택된 곡 목록:', songs.map(s => ({ id: s.id, name: s.song_name })))
  console.log('각 곡별 송폼:', songForms)

  try {
    const pdfLib = await import('pdf-lib')
    const { PDFDocument, rgb } = pdfLib
    const jsPDFModule = await import('jspdf')
    const jsPDF = jsPDFModule.default
    const html2canvas = (await import('html2canvas')).default

    const mergedPdf = await PDFDocument.create()

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
      console.log(`\n🎵 처리 중: ${i + 1}/${songs.length} - ${song.song_name}`)

      if (!song.file_url) {
        console.warn(`⚠️ "${song.song_name}"에 악보 파일이 없습니다. 건너뜁니다.`)
        continue
      }

      try {
        const response = await fetch(song.file_url)
        const arrayBuffer = await response.arrayBuffer()

        // PDF 파일 처리
        if (song.file_type === 'pdf' || song.file_url.toLowerCase().endsWith('.pdf')) {
          const sheetPdf = await PDFDocument.load(arrayBuffer)
          const pageCount = sheetPdf.getPageCount()
          console.log(`📄 PDF 페이지 수: ${pageCount}`)

          const copiedPages = await mergedPdf.copyPages(sheetPdf, Array.from({ length: pageCount }, (_, i) => i))

          for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
            const page = copiedPages[pageIdx]
            mergedPdf.addPage(page)

            // 송폼 오버레이 (각 곡의 첫 페이지에)
            if (pageIdx === 0) {
              const selectedForms = songForms[song.id] || song.selectedForm || []
              if (selectedForms.length > 0 && koreanFont) {
                console.log(`✅ PDF 송폼 오버레이 시작: ${song.song_name} (곡 ${i + 1}, 페이지 ${pageIdx + 1})`)
                console.log(`   송폼 내용: ${selectedForms.join(' - ')}`)

                // 방금 추가한 페이지 가져오기
                const pages = mergedPdf.getPages()
                const currentPage = pages[pages.length - 1]
                
                const formText = selectedForms.join(' - ')
                const { width, height } = currentPage.getSize()

                const fontSize = 14
                const textWidth = koreanFont.widthOfTextAtSize(formText, fontSize)
                const x = width - textWidth - 30
                const y = height - 30

                currentPage.drawRectangle({
                  x: x - 10,
                  y: y - 5,
                  width: textWidth + 20,
                  height: fontSize + 10,
                  color: rgb(1, 1, 1),
                  opacity: 0.9,
                })

                currentPage.drawText(formText, {
                  x: x,
                  y: y,
                  size: fontSize,
                  font: koreanFont,
                  color: rgb(0.4, 0.2, 0.8),
                })

                console.log(`✅ PDF 송폼 표시 성공! (곡 ${i + 1}: ${song.song_name})`)
              } else {
                console.log(`⚠️ 송폼 없음 또는 폰트 없음: ${song.song_name}`)
                console.log(`   - 송폼: ${JSON.stringify(selectedForms)}`)
                console.log(`   - 폰트: ${koreanFont ? '있음' : '없음'}`)
              }
            }
          }

          console.log(`✅ PDF 악보 처리 완료: ${song.song_name}`)
        } 
        // 이미지 파일 처리 (PNG, JPG)
        else {
          console.log('🖼️ 이미지 파일 처리 중...')
          
          let image
          if (song.file_url.toLowerCase().endsWith('.png')) {
            image = await mergedPdf.embedPng(arrayBuffer)
          } else {
            image = await mergedPdf.embedJpg(arrayBuffer)
          }

          const page = mergedPdf.addPage([595.28, 841.89])
          const { width, height } = page.getSize()

          const imgWidth = image.width
          const imgHeight = image.height
          const scale = Math.min(width / imgWidth, height / imgHeight) * 0.9

          const scaledWidth = imgWidth * scale
          const scaledHeight = imgHeight * scale

          const x = (width - scaledWidth) / 2
          const y = (height - scaledHeight) / 2

          page.drawImage(image, {
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight,
          })

          // 송폼 오버레이
          const selectedForms = songForms[song.id] || song.selectedForm || []
          if (selectedForms.length > 0 && koreanFont) {
            const formText = selectedForms.join(' - ')
            const fontSize = 14
            const textWidth = koreanFont.widthOfTextAtSize(formText, fontSize)
            const textX = width - textWidth - 30
            const textY = height - 30

            page.drawRectangle({
              x: textX - 10,
              y: textY - 5,
              width: textWidth + 20,
              height: fontSize + 10,
              color: rgb(1, 1, 1),
              opacity: 0.9,
            })

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