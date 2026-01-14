'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  TrendingUp, Users, Music, FileText, Download,
  BarChart3, Calendar, Award, Activity, ArrowLeft,
  Building, UserCheck, FileSpreadsheet, Settings, Tag,
  Shield, CheckCircle, Upload, MessageSquare
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import * as XLSX from 'xlsx';

interface Stats {
  totalUsers: number;
  totalTeams: number;
  totalSongs: number;
  totalSetlists: number;
  totalDownloads: number;
  recentActivityCount: number;
  dau: number;
  wau: number;
  mau: number;
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

interface DailyTrend {
  date: string;
  활동수: number;
  다운로드: number;
  신규가입: number;
}

interface CopyrightStat {
  team_name: string;
  usage_count: number;
  download_count: number;
}

interface ChurchStat {
  church_name: string;
  user_count: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

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
    recentActivityCount: 0,
    dau: 0,
    wau: 0,
    mau: 0
  });
  const [popularSongs, setPopularSongs] = useState<PopularSong[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [copyrightStats, setCopyrightStats] = useState<CopyrightStat[]>([]);
  const [churchStats, setChurchStats] = useState<ChurchStat[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
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
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - timeRange);

      // 기본 통계 (병렬 처리)
      const [
        usersResult,
        teamsResult,
        songsResult,
        setlistsResult,
        activityResult,
        downloadsResult
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('songs').select('*', { count: 'exact', head: true }),
        supabase.from('team_setlists').select('*', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true })
          .gte('created_at', daysAgo.toISOString()),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true })
          .in('action_type', ['ppt_download', 'pdf_download'])
          .gte('created_at', daysAgo.toISOString())
      ]);

      // DAU/WAU/MAU 계산
      const now = new Date();
      const oneDayAgo = new Date(now); oneDayAgo.setDate(now.getDate() - 1);
      const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
      const oneMonthAgo = new Date(now); oneMonthAgo.setDate(now.getDate() - 30);

      const [dauResult, wauResult, mauResult] = await Promise.all([
        supabase.from('activity_logs').select('user_id').gte('created_at', oneDayAgo.toISOString()),
        supabase.from('activity_logs').select('user_id').gte('created_at', oneWeekAgo.toISOString()),
        supabase.from('activity_logs').select('user_id').gte('created_at', oneMonthAgo.toISOString())
      ]);

      const dau = new Set(dauResult.data?.map(d => d.user_id)).size;
      const wau = new Set(wauResult.data?.map(d => d.user_id)).size;
      const mau = new Set(mauResult.data?.map(d => d.user_id)).size;

      setStats({
        totalUsers: usersResult.count || 0,
        totalTeams: teamsResult.count || 0,
        totalSongs: songsResult.count || 0,
        totalSetlists: setlistsResult.count || 0,
        totalDownloads: downloadsResult.count || 0,
        recentActivityCount: activityResult.count || 0,
        dau,
        wau,
        mau
      });

      // 일별 추세 데이터
      await loadDailyTrends(daysAgo);

      // 인기 곡 TOP 10
      await loadPopularSongs(daysAgo);

      // 저작권자별 통계
      await loadCopyrightStats(daysAgo);

      // 교회별 분포
      await loadChurchStats();

      // 최근 활동 로그
      await loadRecentActivities();

      // 최근 가입자
      await loadRecentUsers();

    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadDailyTrends = async (startDate: Date) => {
    const { data: activityData } = await supabase
      .from('activity_logs')
      .select('created_at, action_type')
      .gte('created_at', startDate.toISOString());

    const { data: signupData } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('action_type', 'user_signup')
      .gte('created_at', startDate.toISOString());

    // 날짜별로 그룹화
    const trendMap = new Map<string, { 활동수: number; 다운로드: number; 신규가입: number }>();

    // 날짜 범위 초기화
    for (let i = 0; i < timeRange; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendMap.set(dateStr, { 활동수: 0, 다운로드: 0, 신규가입: 0 });
    }

    activityData?.forEach((log) => {
      const dateStr = log.created_at.split('T')[0];
      const existing = trendMap.get(dateStr);
      if (existing) {
        existing.활동수 += 1;
        if (log.action_type === 'ppt_download' || log.action_type === 'pdf_download') {
          existing.다운로드 += 1;
        }
      }
    });

    signupData?.forEach((log) => {
      const dateStr = log.created_at.split('T')[0];
      const existing = trendMap.get(dateStr);
      if (existing) {
        existing.신규가입 += 1;
      }
    });

    const trends = Array.from(trendMap.entries())
      .map(([date, data]) => ({ date: date.slice(5), ...data }))
      .reverse();

    setDailyTrends(trends);
  };

  const loadPopularSongs = async (startDate: Date) => {
    const { data: popularSongsData } = await supabase
      .from('activity_logs')
      .select(`
        song_id,
        action_type,
        songs:song_id (
          song_name,
          team_name
        )
      `)
      .not('song_id', 'is', null)
      .gte('created_at', startDate.toISOString());

    const songUsageMap = new Map<string, { song: any; usage: number; downloads: number }>();

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
  };

  const loadCopyrightStats = async (startDate: Date) => {
    const { data } = await supabase
      .from('activity_logs')
      .select(`
        action_type,
        songs:song_id (
          team_name
        )
      `)
      .not('song_id', 'is', null)
      .gte('created_at', startDate.toISOString());

    const copyrightMap = new Map<string, { usage: number; downloads: number }>();

    data?.forEach((log: any) => {
      if (log.songs?.team_name) {
        const teamName = log.songs.team_name;
        const existing = copyrightMap.get(teamName) || { usage: 0, downloads: 0 };
        existing.usage += 1;
        if (log.action_type === 'ppt_download' || log.action_type === 'pdf_download') {
          existing.downloads += 1;
        }
        copyrightMap.set(teamName, existing);
      }
    });

    const copyrightArray = Array.from(copyrightMap.entries())
      .map(([team_name, data]) => ({
        team_name,
        usage_count: data.usage,
        download_count: data.downloads
      }))
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 10);

    setCopyrightStats(copyrightArray);
  };

  const loadChurchStats = async () => {
    const { data } = await supabase
      .from('users')
      .select('church_name')
      .not('church_name', 'is', null)
      .neq('church_name', '');

    const churchMap = new Map<string, number>();

    data?.forEach((user) => {
      if (user.church_name) {
        churchMap.set(user.church_name, (churchMap.get(user.church_name) || 0) + 1);
      }
    });

    const churchArray = Array.from(churchMap.entries())
      .map(([church_name, user_count]) => ({ church_name, user_count }))
      .sort((a, b) => b.user_count - a.user_count)
      .slice(0, 10);

    setChurchStats(churchArray);
  };

  const loadRecentUsers = async () => {
  const { data } = await supabase
    .from('users')
    .select('id, email, name, church_name, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  setRecentUsers(data || []);
};

  const loadRecentActivities = async () => {
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
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'song_search': '🔍 곡 검색',
      'song_view': '👁️ 곡 조회',
      'ppt_download': '📊 PPT 다운로드',
      'pdf_download': '📄 PDF 다운로드',
      'setlist_create': '➕ 콘티 생성',
      'setlist_view': '👁️ 콘티 조회',
      'user_login': '🔐 로그인',
      'user_signup': '👤 회원가입',
      'team_create': '👥 팀 생성',
      'team_join': '🤝 팀 가입'
    };
    return labels[actionType] || actionType;
  };

  // Excel 내보내기
  const exportToExcel = () => {
    // 기본 통계 시트
    const statsData = [
      { 지표: '전체 사용자', 값: stats.totalUsers },
      { 지표: '전체 팀', 값: stats.totalTeams },
      { 지표: '전체 곡', 값: stats.totalSongs },
      { 지표: '전체 콘티', 값: stats.totalSetlists },
      { 지표: `다운로드 (${timeRange}일)`, 값: stats.totalDownloads },
      { 지표: '일간 활성 사용자 (DAU)', 값: stats.dau },
      { 지표: '주간 활성 사용자 (WAU)', 값: stats.wau },
      { 지표: '월간 활성 사용자 (MAU)', 값: stats.mau },
    ];

    // 인기 곡 시트
    const songsData = popularSongs.map((song, index) => ({
      순위: index + 1,
      곡명: song.song_name,
      저작권자: song.team_name,
      사용횟수: song.usage_count,
      다운로드: song.download_count
    }));

    // 저작권자별 통계 시트
    const copyrightData = copyrightStats.map((stat, index) => ({
      순위: index + 1,
      저작권자: stat.team_name,
      사용횟수: stat.usage_count,
      다운로드: stat.download_count
    }));

    // 교회별 분포 시트
    const churchData = churchStats.map((stat, index) => ({
      순위: index + 1,
      교회명: stat.church_name,
      사용자수: stat.user_count
    }));

    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, ws1, '기본통계');
    
    const ws2 = XLSX.utils.json_to_sheet(songsData);
    XLSX.utils.book_append_sheet(wb, ws2, '인기곡TOP10');
    
    const ws3 = XLSX.utils.json_to_sheet(copyrightData);
    XLSX.utils.book_append_sheet(wb, ws3, '저작권자별통계');
    
    const ws4 = XLSX.utils.json_to_sheet(churchData);
    XLSX.utils.book_append_sheet(wb, ws4, '교회별분포');

    const fileName = `Ministry_Hub_통계_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
                <h1 className="text-2xl font-bold text-gray-900">📊 관리자 대시보드</h1>
                <p className="text-sm text-gray-600">전체 플랫폼 통계 및 분석</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Excel 내보내기 버튼 */}
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                <FileSpreadsheet size={18} />
                Excel 다운로드
              </button>
              {/* 기간 선택 */}
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 관리 도구 바로가기 */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">관리 도구</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/admin/content-management')}
              className="flex items-center gap-4 p-6 bg-blue-50 hover:bg-blue-100 rounded-xl transition text-left"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold text-blue-900">콘텐츠 관리</span>
                <p className="text-sm text-blue-600">곡 승인, 공식곡, 가사/테마 편집</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/admin/account-management')}
              className="flex items-center gap-4 p-6 bg-violet-50 hover:bg-violet-100 rounded-xl transition text-left"
            >
              <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold text-violet-900">계정 관리</span>
                <p className="text-sm text-violet-600">팀, 업로더, 퍼블리셔, 관리자</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/admin/feedbacks')}
              className="flex items-center gap-4 p-6 bg-green-50 hover:bg-green-100 rounded-xl transition text-left"
            >
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold text-green-900">피드백 관리</span>
                <p className="text-sm text-green-600">사용자 피드백 확인 및 관리</p>
              </div>
            </button>
          </div>
        </div>

        {/* 핵심 지표 카드 - 1행 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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

        {/* 핵심 지표 카드 - 2행 (DAU/WAU/MAU) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100">DAU (일간 활성)</p>
                <p className="text-3xl font-bold mt-2">{stats.dau.toLocaleString()}</p>
              </div>
              <UserCheck className="w-10 h-10 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-100">WAU (주간 활성)</p>
                <p className="text-3xl font-bold mt-2">{stats.wau.toLocaleString()}</p>
              </div>
              <UserCheck className="w-10 h-10 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-100">MAU (월간 활성)</p>
                <p className="text-3xl font-bold mt-2">{stats.mau.toLocaleString()}</p>
              </div>
              <UserCheck className="w-10 h-10 text-purple-200" />
            </div>
          </div>
        </div>

        {/* 일별 추세 그래프 */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              📈 일별 활동 추세 (최근 {timeRange}일)
            </h3>
          </div>
          <div className="p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="활동수" stroke="#3B82F6" strokeWidth={2} />
                  <Line type="monotone" dataKey="다운로드" stroke="#10B981" strokeWidth={2} />
                  <Line type="monotone" dataKey="신규가입" stroke="#F59E0B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 저작권자별 통계 & 교회별 분포 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 저작권자별 통계 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  🎵 저작권자별 곡 사용 현황
                </h3>
                <span className="text-sm text-gray-500">최근 {timeRange}일</span>
              </div>
            </div>
            <div className="p-6">
              {copyrightStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">아직 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {copyrightStats.map((stat, index) => (
                    <div key={stat.team_name} className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-gray-900">{stat.team_name}</span>
                          <span className="text-sm text-gray-600">
                            {stat.usage_count}회 (다운로드 {stat.download_count})
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(stat.usage_count / copyrightStats[0].usage_count) * 100}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 교회별 분포 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  ⛪ 교회별 사용자 분포
                </h3>
                <Building className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="p-6">
              {churchStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">아직 데이터가 없습니다.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={churchStats as any}
                        dataKey="user_count"
                        nameKey="church_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(props: any) => `${props.church_name}: ${props.user_count}`}
                      >
                        {churchStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
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
              <p className="text-center text-gray-500 py-8">아직 데이터가 없습니다.</p>
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
                      <p className="text-lg font-bold text-blue-600">{song.usage_count}회</p>
                      <p className="text-xs text-gray-500">다운로드 {song.download_count}회</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 최근 가입자 */}
<div className="bg-white rounded-lg shadow mb-8">
  <div className="p-6 border-b">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-gray-900">
        👤 최근 가입자 (최신 20명)
      </h3>
      <span className="text-sm text-gray-500">
        총 {stats.totalUsers}명
      </span>
    </div>
  </div>
  <div className="p-6">
    {recentUsers.length === 0 ? (
      <p className="text-center text-gray-500 py-8">아직 가입자가 없습니다.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">이름</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">이메일</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">교회</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">가입일</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">
                  {user.name || '-'}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {user.email}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {user.church_name || '-'}
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <p className="text-center text-gray-500 py-8">아직 활동 내역이 없습니다.</p>
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
                        <span className="text-sm text-gray-600">- {activity.song_name}</span>
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
