import { supabase } from './supabase';

// ============================================
// 타입 정의
// ============================================

export type ActionType =
  | 'song_search'      // 곡 검색 ✅ 있음
  | 'song_view'        // 곡 조회 (클릭) ⚠️ 호출 안됨
  | 'ppt_download'     // PPT 다운로드 ✅ 있음
  | 'pdf_download'     // PDF 다운로드 ⚠️ 일부만
  | 'setlist_create'   // 콘티 생성 ✅ 있음
  | 'setlist_view'     // 콘티 조회 ⚠️ 일부만
  | 'user_login'       // 🆕 로그인
  | 'user_signup'      // 🆕 회원가입
  | 'team_join'        // 🆕 팀 가입
  | 'team_create'      // 🆕 팀 생성
  | 'song_upload';     // 🆕 곡 업로드

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
      // activity_logs 테이블이 없거나 권한 문제일 경우 조용히 무시
      // 로깅 실패가 앱 기능에 영향을 주지 않도록 함
      if (process.env.NODE_ENV === 'development') {
        // 개발 환경에서도 너무 많은 로그를 출력하지 않음
      }
    }
  } catch (error) {
    // 로깅 실패는 조용히 무시
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
 * PPT 다운로드 로깅 (배치 처리)
 */
export const logPPTDownload = async (
  songIds: string[],
  setlistId?: string,
  userId?: string,
  teamId?: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const finalUserId = userId || user?.id;

    if (!finalUserId) {
      console.warn('⚠️ No user ID for PPT download logging');
      return;
    }

    // 배치로 한 번에 insert
    const logs = songIds.map(songId => ({
      action_type: 'ppt_download',
      user_id: finalUserId,
      team_id: teamId || null,
      song_id: songId,
      setlist_id: setlistId || null,
      metadata: { total_songs: songIds.length }
    }));

    const { error } = await supabase.from('activity_logs').insert(logs);

    if (error) {
      console.error('❌ PPT download batch log error:', error);
    } else {
      console.log(`✅ Batch logged: ${songIds.length} PPT downloads`);
    }
  } catch (error) {
    console.error('💥 PPT download logging failed:', error);
  }
};

/**
 * PDF 다운로드 로깅 (배치 처리)
 */
export const logPDFDownload = async (
  songIds: string[],
  setlistId?: string,
  userId?: string,
  teamId?: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const finalUserId = userId || user?.id;

    if (!finalUserId) {
      console.warn('⚠️ No user ID for PDF download logging');
      return;
    }

    // 배치로 한 번에 insert
    const logs = songIds.map(songId => ({
      action_type: 'pdf_download',
      user_id: finalUserId,
      team_id: teamId || null,
      song_id: songId,
      setlist_id: setlistId || null,
      metadata: { total_songs: songIds.length }
    }));

    const { error } = await supabase.from('activity_logs').insert(logs);

    if (error) {
      console.error('❌ PDF download batch log error:', error);
    } else {
      console.log(`✅ Batch logged: ${songIds.length} PDF downloads`);
    }
  } catch (error) {
    console.error('💥 PDF download logging failed:', error);
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