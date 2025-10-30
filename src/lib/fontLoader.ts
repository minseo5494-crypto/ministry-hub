// src/lib/fontLoader.ts

/**
 * 폰트 파일을 ArrayBuffer로 로드하는 함수
 * @param fontPath - 폰트 파일 경로 (예: '/fonts/NotoSansKR-Regular.ttf')
 * @returns 폰트 데이터 (ArrayBuffer)
 */
export async function loadFont(fontPath: string): Promise<ArrayBuffer> {
  try {
    console.log(`📥 폰트 로드 시도: ${fontPath}`)
    
    // fetch로 폰트 파일 다운로드
    const response = await fetch(fontPath)
    
    // 응답이 성공했는지 확인
    if (!response.ok) {
      throw new Error(`폰트 로드 실패: ${response.status} ${response.statusText}`)
    }
    
    // ArrayBuffer로 변환
    const fontData = await response.arrayBuffer()
    console.log(`✅ 폰트 로드 성공: ${fontPath} (${fontData.byteLength} bytes)`)
    
    return fontData
  } catch (error) {
    console.error(`❌ 폰트 로드 오류 (${fontPath}):`, error)
    throw error
  }
}

/**
 * 여러 폰트 경로 중 사용 가능한 첫 번째 폰트를 로드
 * @param fontPaths - 시도할 폰트 경로 배열
 * @returns 성공한 폰트 데이터 또는 null
 */
export async function loadFontWithFallback(fontPaths: string[]): Promise<ArrayBuffer | null> {
  console.log(`🔍 폰트 로드 시작 (${fontPaths.length}개 경로 시도)`)
  
  for (let i = 0; i < fontPaths.length; i++) {
    const fontPath = fontPaths[i]
    
    try {
      console.log(`[${i + 1}/${fontPaths.length}] ${fontPath} 시도 중...`)
      const fontData = await loadFont(fontPath)
      console.log(`✅ 폰트 로드 성공!`)
      return fontData
    } catch (error) {
      console.warn(`⚠️ ${fontPath} 로드 실패, 다음 폰트 시도...`)
      
      // 마지막 폰트까지 실패하면 에러 출력
      if (i === fontPaths.length - 1) {
        console.error('❌ 모든 폰트 로드 실패')
      }
    }
  }
  
  return null
}

/**
 * 한글 폰트 전용 로더 (자주 사용하는 폰트들 미리 정의)
 * @returns 한글 폰트 데이터 또는 null
 */
export async function loadKoreanFont(): Promise<ArrayBuffer | null> {
  const koreanFontPaths = [
    '/fonts/NotoSansKR-Regular.ttf',      // 1순위: Noto Sans KR
    '/fonts/NanumGothic.ttf',             // 2순위: 나눔고딕
    '/fonts/NanumGothicBold.ttf',         // 3순위: 나눔고딕 Bold
  ]
  
  return await loadFontWithFallback(koreanFontPaths)
}