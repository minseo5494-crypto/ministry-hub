import { PageAnnotation, StrokePoint } from '@/lib/supabase'

// ===== 도구 타입 =====
export type Tool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'pan' | 'lasso'

// ===== 송폼 스타일 =====
export interface SongFormStyle {
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  fontSize: number    // 10-80 (pt)
  color: string       // hex 색상
  opacity: number     // 0-1
}

// ===== 파트 태그 스타일 =====
export interface PartTagStyle {
  id: string
  label: string
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  fontSize: number    // 10-60 (pt)
  color: string       // hex 색상
  opacity: number     // 0-1
  pageIndex?: number  // 페이지 인덱스 (0부터 시작)
}

// ===== 피아노 악보 타입 =====
export interface PianoNote {
  pitch: string       // 음이름 (C4, D4, E4 등)
  position: number    // 마디 내 위치 (0부터 시작)
  duration?: 1 | 2 | 4 | 8 | 16  // 음표 길이
  beamGroup?: string  // 잇단음표 그룹 ID
}

export interface PianoChord {
  name: string        // 코드 이름 (예: "Bb7")
  position: number    // 마디 내 위치 (0-100)
}

export interface PianoScoreElement {
  id: string
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  pageIndex: number   // 페이지 인덱스
  measureCount: 1 | 2 | 3 | 4  // 마디 수
  measureWidths?: number[]  // 각 마디 너비
  chordName?: string  // 코드 이름 (deprecated)
  chords?: PianoChord[]  // 코드 배열
  notes: PianoNote[]  // 음표 배열
  scale?: number      // 크기 조절 (0.5-2.0)
}

// ===== 드럼 악보 타입 =====
export interface DrumNote {
  part: 'HH' | 'SN' | 'KK' | 'TH' | 'TM' | 'TL' | 'CY' | 'RD'
  position: number    // 마디 내 위치 (0-100)
  duration?: 4 | 8 | 16  // 음표 길이
  noteType?: 'normal' | 'x' | 'ghost'  // 음표 타입
  beamGroup?: string  // 잇단음표 그룹 ID
}

export interface DrumScoreElement {
  id: string
  x: number           // 0-100 (퍼센트)
  y: number           // 0-100 (퍼센트)
  pageIndex: number   // 페이지 인덱스
  measureCount: 1 | 2 | 3 | 4  // 마디 수
  measureWidths?: number[]  // 각 마디 너비
  notes: DrumNote[]   // 드럼 음표 배열
  scale?: number      // 크기 조절 (0.5-2.0)
}

// ===== 다중 곡 모드 타입 =====
export interface EditorSong {
  song_id: string
  song_name: string
  team_name?: string
  file_url: string
  file_type: 'pdf' | 'image'
  songForms?: string[]
}

// ===== 저장 데이터 타입 =====
export interface SavedNoteData {
  annotations: PageAnnotation[]
  songFormEnabled: boolean
  songFormStyle: SongFormStyle
  partTags: PartTagStyle[]
  pianoScores?: PianoScoreElement[]
  drumScores?: DrumScoreElement[]
}

// ===== 에디터 Props =====
export interface EditorProps {
  fileUrl: string
  fileType: 'pdf' | 'image'
  songName: string
  artistName?: string
  initialAnnotations?: PageAnnotation[]
  onSave?: (annotations: PageAnnotation[], extra?: {
    songFormEnabled: boolean
    songFormStyle: SongFormStyle
    partTags: PartTagStyle[]
    pianoScores?: PianoScoreElement[]
    drumScores?: DrumScoreElement[]
  }) => void
  onClose?: () => void
  queueInfo?: {
    current: number
    total: number
    nextSongName?: string
  }
  // 송폼 관련 props
  songForms?: string[]
  initialSongFormStyle?: SongFormStyle
  initialSongFormEnabled?: boolean
  initialPartTags?: PartTagStyle[]
  initialPianoScores?: PianoScoreElement[]
  initialDrumScores?: DrumScoreElement[]
  // 다중 곡 모드
  songs?: EditorSong[]
  setlistTitle?: string
  initialSongIndex?: number
  onSaveAll?: (data: {
    song: EditorSong
    annotations: PageAnnotation[]
    extra?: {
      songFormEnabled: boolean
      songFormStyle: SongFormStyle
      partTags: PartTagStyle[]
      pianoScores?: PianoScoreElement[]
      drumScores?: DrumScoreElement[]
    }
  }[]) => void
  // 보기/편집 모드 통합
  initialMode?: 'view' | 'edit'
}

// ===== 올가미 선택 영역 =====
export interface LassoSelection {
  points: StrokePoint[]
  boundingBox: { x: number; y: number; width: number; height: number } | null
  selectedStrokeIds: string[]
  selectedTextIds: string[]
}

// ===== 송폼 상태 =====
export interface SongFormState {
  enabled: boolean
  style: SongFormStyle
  partTags: PartTagStyle[]
}

// ===== 드래깅 아이템 =====
export interface DraggingFormItem {
  type: 'songForm' | 'partTag' | 'pianoScore' | 'drumScore'
  id?: string
}
