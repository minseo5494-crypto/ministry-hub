'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  TrendingUp, Users, Music, FileText, Download,
  BarChart3, Calendar, Award, Activity, ArrowLeft
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalTeams: number;
  totalSongs: number;
  totalSetlists: number;
  totalDownloads: number;
  recentActivityCount: number;
}

interface PopularSong {
  song_id: string;
  song_name: string;
  team_name: string;
  usage_count: number;
  download_count: number;
}

interface RecentActivity {
  id: string;
  action_type: string;
  created_at: string;
  user_email: string;
  song_name?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTeams: 0,
    totalSongs: 0,
    totalSetlists: 0,
    totalDownloads: 0,
    recentActivityCount: 0
  });
  const [popularSongs, setPopularSongs] = useState<PopularSong[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  useEffect(() => {
    if (user) {
      loadStatistics();
    }
  }, [user, timeRange]);

  const checkAdminAndLoadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      // 관리자 권한 확인
      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single();

      if (error || !userData?.is_admin) {
        alert('⛔ 관리자 권한이 필요합니다.');
        router.push('/');
        return;
      }

      setUser(currentUser);
    } catch (error) {
      console.error('Error checking admin:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      // 전체 사용자 수
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // 전체 팀 수
      const { count: teamsCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });

      // 전체 곡 수
      const { count: songsCount } = await supabase
        .from('songs')
        .select('*', { count: 'exact', head: true });

      // 전체 콘티 수
      const { count: setlistsCount } = await supabase
        .from('team_setlists')
        .select('*', { count: 'exact', head: true });

      // 최근 활동 수 (지난 N일)
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - timeRange);
      
      const { count: activityCount } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', daysAgo.toISOString());

      // 다운로드 통계
      const { count: downloadsCount } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .in('action_type', ['ppt_download', 'pdf_download'])
        .gte('created_at', daysAgo.toISOString());

      setStats({
        totalUsers: usersCount || 0,
        totalTeams: teamsCount || 0,
        totalSongs: songsCount || 0,
        totalSetlists: setlistsCount || 0,
        totalDownloads: downloadsCount || 0,
        recentActivityCount: activityCount || 0
      });

      // 인기 곡 TOP 10 (최근 N일 기준)
      const { data: popularSongsData } = await supabase
        .from('activity_logs')
        .select(`
          song_id,
          songs:song_id (
            song_name,
            team_name
          )
        `)
        .not('song_id', 'is', null)
        .gte('created_at', daysAgo.toISOString());

      // 곡별로 그룹화하여 사용 횟수 계산
      const songUsageMap = new Map<string, { song: any, usage: number, downloads: number }>();
      
      popularSongsData?.forEach((log: any) => {
        if (log.song_id && log.songs) {
          const existing = songUsageMap.get(log.song_id) || {
            song: log.songs,
            usage: 0,
            downloads: 0
          };
          
          existing.usage += 1;
          if (log.action_type === 'ppt_download' || log.action_type === 'pdf_download') {
            existing.downloads += 1;
          }
          
          songUsageMap.set(log.song_id, existing);
        }
      });

      const popularSongsArray = Array.from(songUsageMap.entries())
        .map(([id, data]) => ({
          song_id: id,
          song_name: data.song.song_name,
          team_name: data.song.team_name,
          usage_count: data.usage,
          download_count: data.downloads
        }))
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 10);

      setPopularSongs(popularSongsArray);

      // 최근 활동 로그 (최신 20개)
      const { data: activitiesData } = await supabase
        .from('activity_logs')
        .select(`
          id,
          action_type,
          created_at,
          users:user_id (email),
          songs:song_id (song_name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      const activities = activitiesData?.map((log: any) => ({
        id: log.id,
        action_type: log.action_type,
        created_at: log.created_at,
        user_email: log.users?.email || '알 수 없음',
        song_name: log.songs?.song_name
      })) || [];

      setRecentActivities(activities);

    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'song_search': '🔍 곡 검색',
      'song_view': '👁️ 곡 조회',
      'ppt_download': '📊 PPT 다운로드',
      'pdf_download': '📄 PDF 다운로드',
      'setlist_create': '➕ 콘티 생성',
      'setlist_view': '👁️ 콘티 조회'
    };
    return labels[actionType] || actionType;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
                <p className="text-sm text-gray-600">전체 플랫폼 통계 및 분석</p>
              </div>
            </div>
            <div className="flex gap-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days as 7 | 30 | 90)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    timeRange === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {days}일
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 주요 지표 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 전체 사용자 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">전체 사용자</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalUsers.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          {/* 전체 팀 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">전체 팀</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalTeams.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Activity className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          {/* 전체 곡 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">전체 곡</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalSongs.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Music className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* 다운로드 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  다운로드 ({timeRange}일)
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalDownloads.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Download className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 추가 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">콘텐츠 현황</h3>
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">총 콘티</span>
                <span className="text-xl font-bold text-gray-900">
                  {stats.totalSetlists.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">팀당 평균 곡</span>
                <span className="text-xl font-bold text-gray-900">
                  {stats.totalTeams > 0
                    ? (stats.totalSongs / stats.totalTeams).toFixed(1)
                    : '0'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                활동 통계 ({timeRange}일)
              </h3>
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">전체 활동</span>
                <span className="text-xl font-bold text-gray-900">
                  {stats.recentActivityCount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">일평균 활동</span>
                <span className="text-xl font-bold text-gray-900">
                  {(stats.recentActivityCount / timeRange).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 인기 곡 TOP 10 */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                🏆 인기 곡 TOP 10 (최근 {timeRange}일)
              </h3>
              <Award className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <div className="p-6">
            {popularSongs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                아직 데이터가 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {popularSongs.map((song, index) => (
                  <div
                    key={song.song_id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div
                      className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-white ${
                        index === 0
                          ? 'bg-yellow-500'
                          : index === 1
                          ? 'bg-gray-400'
                          : index === 2
                          ? 'bg-orange-600'
                          : 'bg-gray-300'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{song.song_name}</h4>
                      <p className="text-sm text-gray-600">{song.team_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {song.usage_count}회
                      </p>
                      <p className="text-xs text-gray-500">
                        다운로드 {song.download_count}회
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 최근 활동 로그 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                📋 최근 활동 (최신 20개)
              </h3>
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
          </div>
          <div className="p-6">
            {recentActivities.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                아직 활동 내역이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        {getActionLabel(activity.action_type)}
                      </span>
                      {activity.song_name && (
                        <span className="text-sm text-gray-600">
                          - {activity.song_name}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{activity.user_email}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(activity.created_at).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}