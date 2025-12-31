import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// 검색 필터 타입 정의
interface SearchFilters {
  keywords: string[]        // 검색 키워드 (곡명, 아티스트 등)
  themes: string[]          // 테마 (감사, 찬양, 은혜 등)
  season: string | null     // 시즌 (크리스마스, 부활절 등)
  tempo: string | null      // 템포 (slow, medium, fast)
  key: string | null        // 조성 (C, D, E 등)
  mood: string | null       // 분위기 설명 (차분한, 힘찬 등)
  lyricsKeywords: string[]  // 가사에서 찾을 키워드
}

// 사용 가능한 필터 값들 (Claude에게 알려줄 정보)
const AVAILABLE_THEMES = [
  '감사', '찬양', '경배', '은혜', '사랑', '믿음', '소망', '치유',
  '회복', '승리', '평안', '기쁨', '헌신', '섬김', '선교', '전도',
  '성령', '십자가', '부활', '재림', '천국', '구원', '용서', '자유'
]

const AVAILABLE_SEASONS = [
  '크리스마스', '부활절', '추수감사절', '사순절', '대림절', '맥추감사절'
]

const AVAILABLE_TEMPOS = ['slow', 'medium', 'fast']

const AVAILABLE_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    const systemPrompt = `당신은 예배 찬양곡 검색을 도와주는 AI입니다.
사용자의 자연어 검색 요청을 분석하여 구조화된 검색 필터로 변환합니다.

사용 가능한 필터:
- themes: [${AVAILABLE_THEMES.join(', ')}]
- season: ${AVAILABLE_SEASONS.join(', ')} 또는 null
- tempo: slow(느린), medium(보통), fast(빠른) 또는 null
- key: ${AVAILABLE_KEYS.join(', ')} 또는 null
- keywords: 곡 제목이나 아티스트 이름에서 검색할 키워드 배열
- lyricsKeywords: 가사에서 찾을 키워드 배열
- mood: 분위기 설명 (예: "차분한", "힘찬", "감동적인") 또는 null

JSON 형식으로만 응답하세요. 다른 설명은 필요 없습니다.
매칭되지 않는 필터는 빈 배열([]) 또는 null로 설정하세요.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `다음 검색 요청을 분석해서 JSON 필터로 변환해주세요: "${query}"`
        }
      ]
    })

    // 응답에서 텍스트 추출
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSON 파싱 시도
    let filters: SearchFilters
    try {
      // JSON 블록 추출 (```json ... ``` 형식 처리)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        responseText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        filters = JSON.parse(jsonStr)
      } else {
        filters = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('JSON 파싱 실패:', responseText)
      // 파싱 실패 시 기본 키워드 검색으로 폴백
      filters = {
        keywords: query.split(' ').filter(k => k.length > 1),
        themes: [],
        season: null,
        tempo: null,
        key: null,
        mood: null,
        lyricsKeywords: []
      }
    }

    return NextResponse.json({
      success: true,
      query,
      filters,
      rawResponse: responseText
    })

  } catch (error) {
    console.error('AI 검색 오류:', error)
    return NextResponse.json(
      { error: 'AI 검색 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
