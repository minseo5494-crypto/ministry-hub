// 다운로드 내역에 저장되는 곡 정보
export type DownloadSong = {
  song_id: string
  song_name: string
  team_name: string
  file_url: string
  file_type: 'pdf' | 'image'
  songForms: string[]
}

// 다운로드 옵션
export type DownloadHistoryOptions = {
  includeCover?: boolean
  includeSongForm?: boolean
  marginPercent?: number
  customFileName?: string
}

// 다운로드 내역 (download_history 테이블 1행)
export type DownloadHistory = {
  id: string
  user_id: string
  title: string
  format: 'pdf' | 'ppt' | 'image'
  songs: DownloadSong[]
  options: DownloadHistoryOptions | null
  created_at: string
}
