import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
  '성탄절', '부활절', '추수감사절', '사순절', '고난주간', '오순절',
  '어버이주일', '송구영신'
]

const AVAILABLE_TEMPOS = ['slow', 'medium', 'fast']

const AVAILABLE_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')

    if (!accessToken) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // Supabase로 토큰 검증
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 })
    }

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

## 핵심 규칙:
1. keywords는 곡 제목/아티스트 검색용입니다. "추천해줘", "찾아줘" 같은 요청어는 제외하세요.
2. **lyricsKeywords가 가장 중요합니다!** 사용자 요청의 의미를 이해하고, 실제 찬양 가사에 나올법한 관련 단어들을 최대한 많이(10-15개) 생성하세요.
3. 단순 키워드 추출이 아닌, 개념을 확장하여 관련된 표현들을 포함하세요.

## lyricsKeywords 생성 예시:
- "선교 관련 찬양" → lyricsKeywords: ["복음", "전도", "열방", "민족", "세상 끝까지", "모든 족속", "가서", "전파", "증인", "빛", "소금", "보내소서", "일꾼"]
- "위로 관련 찬양" → lyricsKeywords: ["위로", "평안", "눈물", "아픔", "상처", "치유", "품", "안아", "함께", "두려움", "걱정", "염려", "쉼"]
- "감사 관련 찬양" → lyricsKeywords: ["감사", "은혜", "축복", "선하신", "베푸신", "주신", "감격", "눈물", "고마워", "풍성"]
- "회개 관련 찬양" → lyricsKeywords: ["회개", "용서", "죄", "돌아", "자백", "긍휼", "불쌍히", "씻어", "정결", "새롭게"]

## 성경 구절 처리:
- "시편 23편" → themes: ["평안"], lyricsKeywords: ["목자", "푸른 초장", "잔잔한 물", "인도", "지팡이", "막대기", "기름", "잔", "선하심", "따르리"]
- "요한복음 3:16" → themes: ["사랑", "구원"], lyricsKeywords: ["세상", "사랑", "독생자", "영생", "믿는 자", "멸망", "생명", "보내신"]

## 사용 가능한 필터:
- themes: [${AVAILABLE_THEMES.join(', ')}] (여러 개 선택 가능)
- season: ${AVAILABLE_SEASONS.join(', ')} 또는 null
- tempo: slow(느린), medium(보통), fast(빠른) 또는 null
- key: ${AVAILABLE_KEYS.join(', ')} 또는 null
- keywords: 곡 제목 검색용 (보통 비워두세요)
- lyricsKeywords: 가사 검색용 (관련 단어 10-15개 생성!)
- mood: 분위기 설명 또는 null

JSON 형식으로만 응답하세요.`

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
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
