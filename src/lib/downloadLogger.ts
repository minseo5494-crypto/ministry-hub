import { supabase } from './supabase'

export interface DownloadLogData {
  userId: string
  setlistId: string
  downloadType: 'ppt' | 'pdf'
  fileName: string
  teamId?: string
  metadata?: any
}

/**
 * 다운로드 기록 저장
 */
export const logDownload = async (data: DownloadLogData) => {
  try {
    const { error } = await supabase
      .from('download_logs')
      .insert({
        user_id: data.userId,
        setlist_id: data.setlistId,
        download_type: data.downloadType,
        file_name: data.fileName,
        team_id: data.teamId || null,
        metadata: data.metadata || null,
        downloaded_at: new Date().toISOString()
      })

    if (error) throw error
    
    console.log('Download logged successfully')
  } catch (error) {
    console.error('Error logging download:', error)
    // 로깅 실패는 사용자에게 영향을 주지 않도록 에러를 던지지 않음
  }
}

/**
 * 사용자의 다운로드 기록 가져오기
 */
export const getUserDownloads = async (userId: string, limit: number = 50) => {
  try {
    const { data, error } = await supabase
      .from('download_logs')
      .select(`
        *,
        team_setlists:setlist_id (
          id,
          title,
          service_date,
          service_type
        ),
        teams:team_id (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .order('downloaded_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching downloads:', error)
    return []
  }
}

/**
 * 특정 콘티의 다운로드 횟수 가져오기
 */
export const getSetlistDownloadCount = async (setlistId: string) => {
  try {
    const { count, error } = await supabase
      .from('download_logs')
      .select('*', { count: 'exact', head: true })
      .eq('setlist_id', setlistId)

    if (error) throw error

    return count || 0
  } catch (error) {
    console.error('Error fetching download count:', error)
    return 0
  }
}