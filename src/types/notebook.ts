import { PageAnnotation } from '@/lib/supabase'
import {
  SongFormStyle,
  PartTagStyle,
  PianoScoreElement,
  DrumScoreElement,
} from '@/components/SheetMusicEditor/types'

// 페이지 종류
// sheet: 악보 (songs 테이블에서 가져온 곡)
// blank: 빈 백지
// staff: 오선지 (SVG 배경)
// upload: 사용자가 직접 업로드한 이미지/PDF
export type PageType = 'sheet' | 'blank' | 'staff' | 'upload'

// 노트북 내 개별 페이지
export type NotebookPage = {
  id: string                    // 페이지 고유 ID (UUID)
  pageType: PageType            // 페이지 종류
  order: number                 // 페이지 순서 (0부터)

  // 악보 페이지 (pageType: 'sheet')
  songId?: string               // songs 테이블 참조
  songName?: string
  teamName?: string
  fileUrl?: string              // 악보 PDF/이미지 URL
  fileType?: 'pdf' | 'image'
  songForms?: string[]

  // 다중 페이지 PDF 플랫 전개 (1-based, undefined면 기존 동작)
  pdfPageNumber?: number

  // 업로드 페이지 (pageType: 'upload')
  uploadUrl?: string            // Supabase Storage URL
  uploadFileName?: string       // 원본 파일명

  // 필기 데이터 (기존 PageAnnotation[] 호환)
  annotations: PageAnnotation[]
  songFormEnabled: boolean
  songFormStyle: SongFormStyle
  partTags: PartTagStyle[]
  pianoScores?: PianoScoreElement[]
  drumScores?: DrumScoreElement[]
}

// 노트북 전체 (notebooks 테이블 1행)
export type Notebook = {
  id: string
  user_id: string
  title: string
  source_setlist_id?: string | null
  source_setlist_title?: string | null
  team_id?: string | null
  pages: NotebookPage[]
  created_at: string
  updated_at: string
  deleted_at?: string | null
}
