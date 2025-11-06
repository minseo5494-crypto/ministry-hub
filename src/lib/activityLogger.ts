import { supabase } from './supabase';

// ============================================
// 타입 정의
// ============================================

export type ActionType = 
  | 'song_search'      // 곡 검색
  | 'song_view'        // 곡 조회
  | 'ppt_download'     // PPT 다운로드
  | 'pdf_download'     // PDF 다운로드
  | 'setlist_create'   // 콘티 생성
  | 'setlist_view';    // 콘티 조회

export interface LogActivityParams {
  actionType: ActionType;
  userId?: string;
  teamId?: string;
  songId?: string;
  setlistId?: string;
  metadata?: Record<string, any>;
}

// ============================================
// 핵심 로깅 함수
// ============================================

/**
 * 활동 로그 기록
 * @param params 로그 파라미터
 */
export const logActivity = async (params: LogActivityParams): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 사용자 ID가 없으면 파라미터에서 가져오고, 그것도 없으면 로깅 안 함
    const userId = params.userId || user?.id;
    
    if (!userId) {
      console.warn('⚠️ No user ID for logging, skipping...');
      return;
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        action_type: params.actionType,
        user_id: userId,
        team_id: params.teamId || null,
        song_id: params.songId || null,
        setlist_id: params.setlistId || null,
        metadata: params.metadata || {}
      });

    if (error) {
      console.error('❌ Activity log error:', error);
    } else {
      console.log(`✅ Logged: ${params.actionType}`);
    }
  } catch (error) {
    console.error('💥 Activity logging failed:', error);
  }
};

// ============================================
// 편의 함수들 (자주 쓰는 액션)
// ============================================

/**
 * 곡 검색 로깅
 */
export const logSongSearch = async (
  searchQuery: string,
  resultsCount: number,
  userId?: string
) => {
  await logActivity({
    actionType: 'song_search',
    userId,
    metadata: {
      query: searchQuery,
      results_count: resultsCount
    }
  });
};

/**
 * 곡 조회 로깅
 */
export const logSongView = async (
  songId: string,
  userId?: string,
  teamId?: string
) => {
  await logActivity({
    actionType: 'song_view',
    songId,
    userId,
    teamId
  });
};

/**
 * PPT 다운로드 로깅
 */
export const logPPTDownload = async (
  songIds: string[],
  setlistId?: string,
  userId?: string,
  teamId?: string
) => {
  // 각 곡마다 개별 로그 생성
  for (const songId of songIds) {
    await logActivity({
      actionType: 'ppt_download',
      songId,
      setlistId,
      userId,
      teamId,
      metadata: {
        total_songs: songIds.length
      }
    });
  }
};

/**
 * PDF 다운로드 로깅
 */
export const logPDFDownload = async (
  songIds: string[],
  setlistId?: string,
  userId?: string,
  teamId?: string
) => {
  // 각 곡마다 개별 로그 생성
  for (const songId of songIds) {
    await logActivity({
      actionType: 'pdf_download',
      songId,
      setlistId,
      userId,
      teamId,
      metadata: {
        total_songs: songIds.length
      }
    });
  }
};

/**
 * 콘티 생성 로깅
 */
export const logSetlistCreate = async (
  setlistId: string,
  songIds: string[],
  teamId: string,
  userId?: string
) => {
  await logActivity({
    actionType: 'setlist_create',
    setlistId,
    teamId,
    userId,
    metadata: {
      song_count: songIds.length,
      song_ids: songIds
    }
  });
};

/**
 * 콘티 조회 로깅
 */
export const logSetlistView = async (
  setlistId: string,
  teamId: string,
  userId?: string
) => {
  await logActivity({
    actionType: 'setlist_view',
    setlistId,
    teamId,
    userId
  });
};

// ============================================
// 배치 로깅 (여러 액션을 한 번에)
// ============================================

/**
 * 여러 활동을 한 번에 로깅
 */
export const logBatchActivities = async (
  activities: LogActivityParams[]
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      console.warn('⚠️ No user ID for batch logging, skipping...');
      return;
    }

    const logs = activities.map(activity => ({
      action_type: activity.actionType,
      user_id: activity.userId || userId,
      team_id: activity.teamId || null,
      song_id: activity.songId || null,
      setlist_id: activity.setlistId || null,
      metadata: activity.metadata || {}
    }));

    const { error } = await supabase
      .from('activity_logs')
      .insert(logs);

    if (error) {
      console.error('❌ Batch activity log error:', error);
    } else {
      console.log(`✅ Batch logged: ${activities.length} activities`);
    }
  } catch (error) {
    console.error('💥 Batch activity logging failed:', error);
  }
};

// ============================================
// 디버그 함수
// ============================================

/**
 * 최근 로그 조회 (디버깅용)
 */
export const getRecentLogs = async (limit: number = 10) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching logs:', error);
    return [];
  }

  return data;
};

/**
 * 로그 통계 조회 (디버깅용)
 */
export const getLogStats = async () => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('action_type')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('Error fetching log stats:', error);
    return {};
  }

  // 액션 타입별로 카운트
  const stats: Record<string, number> = {};
  data?.forEach(log => {
    stats[log.action_type] = (stats[log.action_type] || 0) + 1;
  });

  return stats;
};