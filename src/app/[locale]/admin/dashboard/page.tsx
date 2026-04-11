'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  TrendingUp, Users, Music, FileText, Download,
  BarChart3, Calendar, Award, Activity, ArrowLeft,
  Building, UserCheck, FileSpreadsheet, Settings, Tag,
  Shield, CheckCircle, Upload, MessageSquare, Search,
  AlertTriangle, Smartphone, Monitor, Tablet, ArrowUpRight,
  ArrowDownRight, Target, Bug, Lightbulb, Percent
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
  hiddenSongs: number;
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
  activity: number;
  downloads: number;
  signups: number;
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

interface SearchStat {
  query: string;
  count: number;
  avg_results: number;
}

interface FailedSearch {
  query: string;
  count: number;
}

interface UserJourney {
  totalSignups: number;
  usersWithDownload: number;
  conversionRate: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
}

interface GrowthComparison {
  thisWeekUsers: number;
  lastWeekUsers: number;
  thisWeekDownloads: number;
  lastWeekDownloads: number;
  userGrowthRate: number;
  downloadGrowthRate: number;
  thisMonthUsers: number;
  lastMonthUsers: number;
  monthlyUserGrowthRate: number;
}

interface DeviceStat {
  device: string;
  count: number;
  percentage: number;
}

interface BetaStat {
  totalFeedbacks: number;
  pendingFeedbacks: number;
  bugReports: number;
  featureRequests: number;
  activeTesters: number;
  avgActionsPerUser: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function AdminDashboard() {
  const router = useRouter();
  const t = useTranslations('admin');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTeams: 0,
    totalSongs: 0,
    hiddenSongs: 0,
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
  const [searchStats, setSearchStats] = useState<SearchStat[]>([]);
  const [failedSearches, setFailedSearches] = useState<FailedSearch[]>([]);
  const [userJourney, setUserJourney] = useState<UserJourney>({
    totalSignups: 0, usersWithDownload: 0, conversionRate: 0,
    retentionD1: 0, retentionD7: 0, retentionD30: 0
  });
  const [growthComparison, setGrowthComparison] = useState<GrowthComparison>({
    thisWeekUsers: 0, lastWeekUsers: 0, thisWeekDownloads: 0, lastWeekDownloads: 0,
    userGrowthRate: 0, downloadGrowthRate: 0, thisMonthUsers: 0, lastMonthUsers: 0, monthlyUserGrowthRate: 0
  });
  const [deviceStats, setDeviceStats] = useState<DeviceStat[]>([]);
  const [betaStats, setBetaStats] = useState<BetaStat>({
    totalFeedbacks: 0, pendingFeedbacks: 0, bugReports: 0, featureRequests: 0,
    activeTesters: 0, avgActionsPerUser: 0
  });

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
        alert(t('loginRequired'));
        router.push('/login');
        return;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single();

      if (error || !userData?.is_admin) {
        alert(t('adminRequiredEmoji'));
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

  // 관리자 ID 목록 로드
  const loadAdminIds = async (): Promise<string[]> => {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('is_admin', true);

    return data?.map(u => u.id) || [];
  };

  const loadStatistics = async () => {
    try {
      // 관리자 ID 목록 먼저 로드
      const admins = await loadAdminIds();
      setAdminIds(admins);

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - timeRange);

      // 기본 통계 (병렬 처리)
      const [
        usersResult,
        teamsResult,
        songsResult,
        hiddenSongsResult,
        setlistsResult,
        activityResult,
        downloadsResult
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('songs').select('*', { count: 'exact', head: true })
          .or('is_hidden.is.null,is_hidden.eq.false'),
        supabase.from('songs').select('*', { count: 'exact', head: true })
          .eq('is_hidden', true),
        supabase.from('team_setlists').select('*', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true })
          .gte('created_at', daysAgo.toISOString()),
        admins.length > 0
          ? supabase.from('activity_logs').select('*', { count: 'exact', head: true })
              .in('action_type', ['ppt_download', 'pdf_download'])
              .gte('created_at', daysAgo.toISOString())
              .not('user_id', 'in', `(${admins.join(',')})`)
          : supabase.from('activity_logs').select('*', { count: 'exact', head: true })
              .in('action_type', ['ppt_download', 'pdf_download'])
              .gte('created_at', daysAgo.toISOString())
      ]);

      // DAU/WAU/MAU 계산 (관리자 및 삭제된 사용자 제외)
      const now = new Date();
      const oneDayAgo = new Date(now); oneDayAgo.setDate(now.getDate() - 1);
      const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
      const oneMonthAgo = new Date(now); oneMonthAgo.setDate(now.getDate() - 30);

      // 존재하는 사용자 ID 목록 (삭제된 사용자 제외)
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id');
      const existingUserIds = new Set(existingUsers?.map(u => u.id) || []);

      const [dauResult, wauResult, mauResult] = await Promise.all([
        supabase.from('activity_logs').select('user_id').gte('created_at', oneDayAgo.toISOString()),
        supabase.from('activity_logs').select('user_id').gte('created_at', oneWeekAgo.toISOString()),
        supabase.from('activity_logs').select('user_id').gte('created_at', oneMonthAgo.toISOString())
      ]);

      // 관리자 제외 + 존재하는 사용자만 카운트
      const filterAdminsAndDeleted = (data: { user_id: string }[] | null) =>
        new Set(data?.filter(d => !admins.includes(d.user_id) && existingUserIds.has(d.user_id)).map(d => d.user_id)).size;

      const dau = filterAdminsAndDeleted(dauResult.data);
      const wau = filterAdminsAndDeleted(wauResult.data);
      const mau = filterAdminsAndDeleted(mauResult.data);

      // 다운로드 수 (관리자 제외 - 서버 사이드 필터링)
      const totalDownloads = downloadsResult.count || 0;

      setStats({
        totalUsers: usersResult.count || 0,
        totalTeams: teamsResult.count || 0,
        totalSongs: songsResult.count || 0,
        hiddenSongs: hiddenSongsResult.count || 0,
        totalSetlists: setlistsResult.count || 0,
        totalDownloads,
        recentActivityCount: activityResult.count || 0,
        dau,
        wau,
        mau
      });

      // 일별 추세 데이터 (관리자 제외)
      await loadDailyTrends(daysAgo, admins);

      // 인기 곡 TOP 10 (관리자 제외)
      await loadPopularSongs(daysAgo, admins);

      // 저작권자별 통계 (관리자 제외)
      await loadCopyrightStats(daysAgo, admins);

      // 교회별 분포
      await loadChurchStats();

      // 최근 활동 로그 (관리자 제외)
      await loadRecentActivities(admins);

      // 최근 가입자
      await loadRecentUsers();

      // 검색 분석 (관리자 제외)
      await loadSearchStats(daysAgo, admins);

      // 사용자 여정 분석 (관리자 제외)
      await loadUserJourney(admins);

      // 성장 비교 (관리자 제외)
      await loadGrowthComparison(admins);

      // 기기 분석 (피드백 user_agent 기준 - 대표성 제한적)
      await loadDeviceStats(daysAgo);

      // 베타 지표 (관리자 제외)
      await loadBetaStats(daysAgo, admins);

    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadDailyTrends = async (startDate: Date, admins: string[]) => {
    const { data: activityData } = await supabase
      .from('activity_logs')
      .select('created_at, action_type, user_id')
      .gte('created_at', startDate.toISOString());

    const { data: signupData } = await supabase
      .from('activity_logs')
      .select('created_at, user_id')
      .eq('action_type', 'user_signup')
      .gte('created_at', startDate.toISOString());

    // 날짜별로 그룹화
    const trendMap = new Map<string, { activity: number; downloads: number; signups: number }>();

    // 날짜 범위 초기화
    for (let i = 0; i < timeRange; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendMap.set(dateStr, { activity: 0, downloads: 0, signups: 0 });
    }

    // 관리자 제외하고 집계
    activityData?.filter(log => !admins.includes(log.user_id)).forEach((log) => {
      const dateStr = log.created_at.split('T')[0];
      const existing = trendMap.get(dateStr);
      if (existing) {
        existing.activity += 1;
        if (log.action_type === 'ppt_download' || log.action_type === 'pdf_download') {
          existing.downloads += 1;
        }
      }
    });

    // 신규가입은 관리자도 포함 (가입 자체는 통계에 포함)
    signupData?.forEach((log) => {
      const dateStr = log.created_at.split('T')[0];
      const existing = trendMap.get(dateStr);
      if (existing) {
        existing.signups += 1;
      }
    });

    const trends = Array.from(trendMap.entries())
      .map(([date, data]) => ({ date: date.slice(5), ...data }))
      .reverse();

    setDailyTrends(trends);
  };

  const loadPopularSongs = async (startDate: Date, admins: string[]) => {
    const { data: popularSongsData } = await supabase
      .from('activity_logs')
      .select(`
        song_id,
        action_type,
        user_id,
        songs:song_id (
          song_name,
          team_name
        )
      `)
      .not('song_id', 'is', null)
      .gte('created_at', startDate.toISOString());

    const songUsageMap = new Map<string, { song: any; usage: number; downloads: number }>();

    // 관리자 제외
    popularSongsData?.filter((log: any) => !admins.includes(log.user_id)).forEach((log: any) => {
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

  const loadCopyrightStats = async (startDate: Date, admins: string[]) => {
    const { data } = await supabase
      .from('activity_logs')
      .select(`
        action_type,
        user_id,
        songs:song_id (
          team_name
        )
      `)
      .not('song_id', 'is', null)
      .gte('created_at', startDate.toISOString());

    const copyrightMap = new Map<string, { usage: number; downloads: number }>();

    // 관리자 제외
    data?.filter((log: any) => !admins.includes(log.user_id)).forEach((log: any) => {
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

  const loadSearchStats = async (startDate: Date, admins: string[]) => {
    const { data } = await supabase
      .from('activity_logs')
      .select('metadata, user_id')
      .eq('action_type', 'song_search')
      .gte('created_at', startDate.toISOString());

    const searchMap = new Map<string, { count: number; totalResults: number }>();
    const failedMap = new Map<string, number>();

    // 관리자 제외
    data?.filter((log: any) => !admins.includes(log.user_id)).forEach((log: any) => {
      const query = log.metadata?.query?.toLowerCase()?.trim();
      const resultsCount = log.metadata?.results_count || 0;

      if (query) {
        const existing = searchMap.get(query) || { count: 0, totalResults: 0 };
        existing.count += 1;
        existing.totalResults += resultsCount;
        searchMap.set(query, existing);

        if (resultsCount === 0) {
          failedMap.set(query, (failedMap.get(query) || 0) + 1);
        }
      }
    });

    const searchArray = Array.from(searchMap.entries())
      .map(([query, data]) => ({
        query,
        count: data.count,
        avg_results: Math.round(data.totalResults / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const failedArray = Array.from(failedMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setSearchStats(searchArray);
    setFailedSearches(failedArray);
  };

  const loadUserJourney = async (admins: string[]) => {
    const { data: users } = await supabase
      .from('users')
      .select('id, created_at');

    const { data: downloads } = await supabase
      .from('activity_logs')
      .select('user_id, created_at')
      .in('action_type', ['ppt_download', 'pdf_download']);

    // 관리자 제외한 사용자만 대상
    const nonAdminUsers = users?.filter(u => !admins.includes(u.id)) || [];
    const totalSignups = nonAdminUsers.length;

    // 관리자 제외한 다운로드
    const nonAdminDownloads = downloads?.filter(d => !admins.includes(d.user_id)) || [];
    const userIdsWithDownload = new Set(nonAdminDownloads.map(d => d.user_id));
    const usersWithDownload = userIdsWithDownload.size;
    const conversionRate = totalSignups > 0 ? (usersWithDownload / totalSignups) * 100 : 0;

    // 리텐션 계산 (가입 후 D1, D7, D30에 활동한 사용자 비율) - 관리자 제외
    const now = new Date();
    const { data: allActivity } = await supabase
      .from('activity_logs')
      .select('user_id, created_at');

    // 관리자 제외한 활동만
    const nonAdminActivity = allActivity?.filter(a => !admins.includes(a.user_id)) || [];

    let d1Retained = 0, d7Retained = 0, d30Retained = 0;
    let d1Eligible = 0, d7Eligible = 0, d30Eligible = 0;

    nonAdminUsers.forEach(user => {
      const signupDate = new Date(user.created_at);
      const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

      const userActivities = nonAdminActivity.filter(a => a.user_id === user.id);

      if (daysSinceSignup >= 1) {
        d1Eligible++;
        const hasD1Activity = userActivities.some(a => {
          const actDate = new Date(a.created_at);
          const daysSinceSignupToAct = Math.floor((actDate.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceSignupToAct >= 1 && daysSinceSignupToAct < 2;
        });
        if (hasD1Activity) d1Retained++;
      }

      if (daysSinceSignup >= 7) {
        d7Eligible++;
        const hasD7Activity = userActivities.some(a => {
          const actDate = new Date(a.created_at);
          const daysSinceSignupToAct = Math.floor((actDate.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceSignupToAct >= 7 && daysSinceSignupToAct < 14;
        });
        if (hasD7Activity) d7Retained++;
      }

      if (daysSinceSignup >= 30) {
        d30Eligible++;
        const hasD30Activity = userActivities.some(a => {
          const actDate = new Date(a.created_at);
          const daysSinceSignupToAct = Math.floor((actDate.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceSignupToAct >= 30;
        });
        if (hasD30Activity) d30Retained++;
      }
    });

    setUserJourney({
      totalSignups,
      usersWithDownload,
      conversionRate: Math.round(conversionRate * 10) / 10,
      retentionD1: d1Eligible > 0 ? Math.round((d1Retained / d1Eligible) * 100) : 0,
      retentionD7: d7Eligible > 0 ? Math.round((d7Retained / d7Eligible) * 100) : 0,
      retentionD30: d30Eligible > 0 ? Math.round((d30Retained / d30Eligible) * 100) : 0
    });
  };

  const loadGrowthComparison = async (admins: string[]) => {
    const now = new Date();
    const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
    const oneMonthAgo = new Date(now); oneMonthAgo.setDate(now.getDate() - 30);
    const twoMonthsAgo = new Date(now); twoMonthsAgo.setDate(now.getDate() - 60);

    // 가입자 수는 관리자 제외하고 count, 다운로드도 관리자 제외
    const [thisWeekUsers, lastWeekUsers, thisWeekDownloads, lastWeekDownloads, thisMonthUsers, lastMonthUsers] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()).or('is_admin.is.null,is_admin.eq.false'),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', twoWeeksAgo.toISOString()).lt('created_at', oneWeekAgo.toISOString()).or('is_admin.is.null,is_admin.eq.false'),
      supabase.from('activity_logs').select('user_id').in('action_type', ['ppt_download', 'pdf_download']).gte('created_at', oneWeekAgo.toISOString()),
      supabase.from('activity_logs').select('user_id').in('action_type', ['ppt_download', 'pdf_download']).gte('created_at', twoWeeksAgo.toISOString()).lt('created_at', oneWeekAgo.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', oneMonthAgo.toISOString()).or('is_admin.is.null,is_admin.eq.false'),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', twoMonthsAgo.toISOString()).lt('created_at', oneMonthAgo.toISOString()).or('is_admin.is.null,is_admin.eq.false')
    ]);

    const thisWeekUsersCount = thisWeekUsers.count || 0;
    const lastWeekUsersCount = lastWeekUsers.count || 0;
    // 다운로드는 관리자 제외
    const thisWeekDownloadsCount = thisWeekDownloads.data?.filter(d => !admins.includes(d.user_id)).length || 0;
    const lastWeekDownloadsCount = lastWeekDownloads.data?.filter(d => !admins.includes(d.user_id)).length || 0;
    const thisMonthUsersCount = thisMonthUsers.count || 0;
    const lastMonthUsersCount = lastMonthUsers.count || 0;

    setGrowthComparison({
      thisWeekUsers: thisWeekUsersCount,
      lastWeekUsers: lastWeekUsersCount,
      thisWeekDownloads: thisWeekDownloadsCount,
      lastWeekDownloads: lastWeekDownloadsCount,
      userGrowthRate: lastWeekUsersCount > 0 ? Math.round(((thisWeekUsersCount - lastWeekUsersCount) / lastWeekUsersCount) * 100) : thisWeekUsersCount > 0 ? 100 : 0,
      downloadGrowthRate: lastWeekDownloadsCount > 0 ? Math.round(((thisWeekDownloadsCount - lastWeekDownloadsCount) / lastWeekDownloadsCount) * 100) : thisWeekDownloadsCount > 0 ? 100 : 0,
      thisMonthUsers: thisMonthUsersCount,
      lastMonthUsers: lastMonthUsersCount,
      monthlyUserGrowthRate: lastMonthUsersCount > 0 ? Math.round(((thisMonthUsersCount - lastMonthUsersCount) / lastMonthUsersCount) * 100) : thisMonthUsersCount > 0 ? 100 : 0
    });
  };

  const loadDeviceStats = async (startDate: Date) => {
    const { data } = await supabase
      .from('feedbacks')
      .select('user_agent')
      .gte('created_at', startDate.toISOString());

    const deviceMap = new Map<string, number>();

    data?.forEach(feedback => {
      if (feedback.user_agent) {
        let device = 'Unknown';
        const ua = feedback.user_agent.toLowerCase();

        if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
          device = 'Mobile';
        } else if (ua.includes('tablet') || ua.includes('ipad')) {
          device = 'Tablet';
        } else {
          device = 'Desktop';
        }

        deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
      }
    });

    const total = Array.from(deviceMap.values()).reduce((a, b) => a + b, 0);
    const deviceArray = Array.from(deviceMap.entries())
      .map(([device, count]) => ({
        device,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    setDeviceStats(deviceArray);
  };

  const loadBetaStats = async (startDate: Date, admins: string[]) => {
    const [feedbacksResult, activityResult] = await Promise.all([
      supabase.from('feedbacks').select('type, status'),
      supabase.from('activity_logs').select('user_id').gte('created_at', startDate.toISOString())
    ]);

    const feedbacks = feedbacksResult.data || [];
    // 관리자 제외
    const activities = activityResult.data?.filter(a => !admins.includes(a.user_id)) || [];

    const totalFeedbacks = feedbacks.length;
    const pendingFeedbacks = feedbacks.filter(f => f.status === 'pending').length;
    const bugReports = feedbacks.filter(f => f.type === 'bug').length;
    const featureRequests = feedbacks.filter(f => f.type === 'feature').length;

    const uniqueUsers = new Set(activities.map(a => a.user_id));
    const activeTesters = uniqueUsers.size;
    const avgActionsPerUser = activeTesters > 0 ? Math.round(activities.length / activeTesters) : 0;

    setBetaStats({
      totalFeedbacks,
      pendingFeedbacks,
      bugReports,
      featureRequests,
      activeTesters,
      avgActionsPerUser
    });
  };

  const loadRecentActivities = async (admins: string[]) => {
    const { data: activitiesData } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action_type,
        created_at,
        user_id,
        users:user_id (email),
        songs:song_id (song_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50); // 더 많이 가져와서 필터링 후 20개 표시

    // 관리자 제외하고 최근 20개
    const activities = activitiesData
      ?.filter((log: any) => !admins.includes(log.user_id))
      .slice(0, 20)
      .map((log: any) => ({
        id: log.id,
        action_type: log.action_type,
        created_at: log.created_at,
        user_email: log.users?.email || 'Unknown',
        song_name: log.songs?.song_name
      })) || [];

    setRecentActivities(activities);
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'song_search': t('actionSongSearch'),
      'song_view': t('actionSongView'),
      'ppt_download': t('actionPPTDownload'),
      'pdf_download': t('actionPDFDownload'),
      'setlist_create': t('actionSetlistCreate'),
      'setlist_view': t('actionSetlistView'),
      'user_login': t('actionLogin'),
      'user_signup': t('actionSignup'),
      'team_create': t('actionTeamCreate'),
      'team_join': t('actionTeamJoin')
    };
    return labels[actionType] || actionType;
  };

  // Excel 내보내기
  const exportToExcel = () => {
    const statsData = [
      { Metric: t('totalUsers'), Value: stats.totalUsers },
      { Metric: t('totalTeams'), Value: stats.totalTeams },
      { Metric: t('activeSongs'), Value: stats.totalSongs },
      { Metric: 'Hidden Songs', Value: stats.hiddenSongs },
      { Metric: 'Total Setlists', Value: stats.totalSetlists },
      { Metric: `Downloads (${timeRange}d)`, Value: stats.totalDownloads },
      { Metric: 'DAU', Value: stats.dau },
      { Metric: 'WAU', Value: stats.wau },
      { Metric: 'MAU', Value: stats.mau },
    ];

    const songsData = popularSongs.map((song, index) => ({
      Rank: index + 1,
      Song: song.song_name,
      Artist: song.team_name,
      Usage: song.usage_count,
      Downloads: song.download_count
    }));

    const copyrightData = copyrightStats.map((stat, index) => ({
      Rank: index + 1,
      Artist: stat.team_name,
      Usage: stat.usage_count,
      Downloads: stat.download_count
    }));

    const churchData = churchStats.map((stat, index) => ({
      Rank: index + 1,
      Church: stat.church_name,
      Users: stat.user_count
    }));

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Stats');

    const ws2 = XLSX.utils.json_to_sheet(songsData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Top Songs');

    const ws3 = XLSX.utils.json_to_sheet(copyrightData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Artist Stats');

    const ws4 = XLSX.utils.json_to_sheet(churchData);
    XLSX.utils.book_append_sheet(wb, ws4, 'Church Distribution');

    const fileName = `WORSHEEP_Stats_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
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
                <h1 className="text-2xl font-bold text-gray-900">{t('dashboard')}</h1>
                <p className="text-sm text-gray-600">{t('dashboardDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Excel 내보내기 버튼 */}
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
              >
                <FileSpreadsheet size={18} />{t('excelDownload')}              </button>
              {/* 기간 선택 */}
              <div className="flex gap-2">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeRange(days as 7 | 30 | 90)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      timeRange === days
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {t('daysUnit', { days })}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('adminTools')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/admin/content-management')}
              className="flex items-center gap-4 p-6 bg-blue-50 hover:bg-blue-100 rounded-xl transition text-left"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold text-blue-900">{t('contentManagement')}</span>
                <p className="text-sm text-blue-600">{t('contentMgmtToolDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/admin/account-management')}
              className="flex items-center gap-4 p-6 bg-violet-50 hover:bg-violet-100 rounded-xl transition text-left"
            >
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold text-violet-900">{t('accountMgmtLabel')}</span>
                <p className="text-sm text-violet-600">{t('accountMgmtToolDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/admin/feedbacks')}
              className="flex items-center gap-4 p-6 bg-green-50 hover:bg-green-100 rounded-xl transition text-left"
            >
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold text-green-900">{t('feedbackMgmtLabel')}</span>
                <p className="text-sm text-green-600">{t('feedbackMgmtToolDesc')}</p>
              </div>
            </button>
          </div>
        </div>

        {/* 핵심 지표 카드 - 1행 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalUsers')}</p>
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
                <p className="text-sm font-medium text-gray-600">{t('totalTeams')}</p>
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
                <p className="text-sm font-medium text-gray-600">{t('activeSongs')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalSongs.toLocaleString()}
                </p>
                {stats.hiddenSongs > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{t('hiddenSongsCount', { count: stats.hiddenSongs })}</p>
                )}
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Music className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('downloadsInDays', { days: timeRange })}                </p>
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
                <p className="text-sm font-medium text-blue-100">{t('dauLabel')}</p>
                <p className="text-3xl font-bold mt-2">{stats.dau.toLocaleString()}</p>
              </div>
              <UserCheck className="w-10 h-10 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-100">{t('wauLabel')}</p>
                <p className="text-3xl font-bold mt-2">{stats.wau.toLocaleString()}</p>
              </div>
              <UserCheck className="w-10 h-10 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-100">{t('mauLabel')}</p>
                <p className="text-3xl font-bold mt-2">{stats.mau.toLocaleString()}</p>
              </div>
              <UserCheck className="w-10 h-10 text-purple-200" />
            </div>
          </div>
        </div>

        {/* 성장 비교 & 사용자 여정 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 성장 비교 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />{t('growthComparison')}              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{t('thisWeekSignups')}</span>
                    {growthComparison.userGrowthRate > 0 ? (
                      <span className="flex items-center text-green-600 text-sm">
                        <ArrowUpRight className="w-4 h-4" />
                        {growthComparison.userGrowthRate}%
                      </span>
                    ) : growthComparison.userGrowthRate < 0 ? (
                      <span className="flex items-center text-red-600 text-sm">
                        <ArrowDownRight className="w-4 h-4" />
                        {Math.abs(growthComparison.userGrowthRate)}%
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{growthComparison.thisWeekUsers}</p>
                  <p className="text-xs text-gray-500">{t('lastWeekCount', { count: growthComparison.lastWeekUsers })}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{t('thisWeekDownloads')}</span>
                    {growthComparison.downloadGrowthRate > 0 ? (
                      <span className="flex items-center text-green-600 text-sm">
                        <ArrowUpRight className="w-4 h-4" />
                        {growthComparison.downloadGrowthRate}%
                      </span>
                    ) : growthComparison.downloadGrowthRate < 0 ? (
                      <span className="flex items-center text-red-600 text-sm">
                        <ArrowDownRight className="w-4 h-4" />
                        {Math.abs(growthComparison.downloadGrowthRate)}%
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{growthComparison.thisWeekDownloads}</p>
                  <p className="text-xs text-gray-500">{t('lastWeekCount', { count: growthComparison.lastWeekDownloads })}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-blue-700">{t('monthlySignupGrowth')}</span>
                    {growthComparison.monthlyUserGrowthRate > 0 ? (
                      <span className="flex items-center text-green-600 text-sm font-medium">
                        <ArrowUpRight className="w-4 h-4" />
                        {growthComparison.monthlyUserGrowthRate}%
                      </span>
                    ) : growthComparison.monthlyUserGrowthRate < 0 ? (
                      <span className="flex items-center text-red-600 text-sm font-medium">
                        <ArrowDownRight className="w-4 h-4" />
                        {Math.abs(growthComparison.monthlyUserGrowthRate)}%
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">{t('thisMonthLabel')}<strong>{growthComparison.thisMonthUsers}</strong></span>
                    <span className="text-blue-600">{t('lastMonthCount', { count: growthComparison.lastMonthUsers })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 사용자 여정 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />{t('userJourney')}              </h3>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">{t('signupToDownload')}</span>
                  <span className="text-lg font-bold text-purple-600">{userJourney.conversionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-purple-100 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(userJourney.conversionRate, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>{t('signupsCount', { count: userJourney.totalSignups })}</span>
                  <span>{t('downloadsCount', { count: userJourney.usersWithDownload })}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">{t('retention')}</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-700 mb-1">D1</p>
                    <p className="text-xl font-bold text-green-700">{userJourney.retentionD1}%</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700 mb-1">D7</p>
                    <p className="text-xl font-bold text-blue-700">{userJourney.retentionD7}%</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-700 mb-1">D30</p>
                    <p className="text-xl font-bold text-purple-700">{userJourney.retentionD30}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 베타 지표 & 검색 분석 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* 베타 지표 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-600" />{t('betaMetrics')}              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-600">{t('totalFeedbacks')}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{betaStats.totalFeedbacks}</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs text-yellow-700">{t('pendingLabel')}</span>
                  </div>
                  <p className="text-xl font-bold text-yellow-700">{betaStats.pendingFeedbacks}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Bug className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-red-700">{t('bugReports')}</span>
                  </div>
                  <p className="text-xl font-bold text-red-700">{betaStats.bugReports}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-blue-700">{t('featureRequests')}</span>
                  </div>
                  <p className="text-xl font-bold text-blue-700">{betaStats.featureRequests}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">{t('activeTestersLabel')}</span>
                  <span className="font-semibold">{t('activeTestersCount', { count: betaStats.activeTesters })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('avgActionsPerUser')}</span>
                  <span className="font-semibold">{t('avgActionsCount', { count: betaStats.avgActionsPerUser })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 인기 검색어 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-green-600" />{t('popularSearchTop15')}              </h3>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto">
              {searchStats.length === 0 ? (
                <p className="text-center text-gray-500 py-4">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {searchStats.map((stat, index) => (
                    <div key={stat.query} className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-medium text-gray-600">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm truncate" title={stat.query}>
                        {stat.query}
                      </span>
                      <span className="text-xs text-gray-500">{t('timesUnit', { count: stat.count })}</span>
                      <span className="text-xs text-green-600">{t('avgResultsCount', { count: stat.avg_results })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 검색 실패 키워드 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />{t('failedSearchKeywords')}              </h3>
              <p className="text-xs text-gray-500 mt-1">{t('failedSearchDesc')}</p>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto">
              {failedSearches.length === 0 ? (
                <p className="text-center text-gray-500 py-4">{t('noFailedSearches')}</p>
              ) : (
                <div className="space-y-2">
                  {failedSearches.map((stat, index) => (
                    <div key={stat.query} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <span className="text-sm text-red-800">{stat.query}</span>
                      <span className="text-xs text-red-600 font-medium">{t('timesUnit', { count: stat.count })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 일별 추세 그래프 */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('dailyTrendTitle', { days: timeRange })}
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
                  <Line type="monotone" dataKey="activity" name={t('trendActivity')} stroke="#3B82F6" strokeWidth={2} />
                  <Line type="monotone" dataKey="downloads" name={t('trendDownloads')} stroke="#10B981" strokeWidth={2} />
                  <Line type="monotone" dataKey="signups" name={t('trendSignups')} stroke="#F59E0B" strokeWidth={2} />
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
                  {t('copyrightUsage')}
                </h3>
                <span className="text-sm text-gray-500">{t('recentDays', { days: timeRange })}</span>
              </div>
            </div>
            <div className="p-6">
              {copyrightStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('noDataYet')}</p>
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
                            {t('usageCountFull', { usage: stat.usage_count, downloads: stat.download_count })}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-100 h-2 rounded-full"
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
                  {t('churchDistribution')}
                </h3>
                <Building className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="p-6">
              {churchStats.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('noDataYet')}</p>
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
                {t('popularSongsTop10', { days: timeRange })}
              </h3>
              <Award className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <div className="p-6">
            {popularSongs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('noDataYet')}</p>
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
                          ? 'bg-yellow-100'
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
                      <p className="text-lg font-bold text-blue-600">{t('usageCountSimple', { count: song.usage_count })}</p>
                      <p className="text-xs text-gray-500">{t('downloadCountSimple', { count: song.download_count })}</p>
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
        {t('recentSignups', { count: 20 })}
      </h3>
      <span className="text-sm text-gray-500">{t('totalCountLabel', { count: stats.totalUsers })}      </span>
    </div>
  </div>
  <div className="p-6">
    {recentUsers.length === 0 ? (
      <p className="text-center text-gray-500 py-8">{t('noSignupsYet')}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">{t('tableNameHeader')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">{t('tableEmailHeader')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">{t('tableChurchHeader')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">{t('tableSignupDateHeader')}</th>
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
                {t('recentActivity', { count: 20 })}
              </h3>
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
          </div>
          <div className="p-6">
            {recentActivities.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('noActivityYet')}</p>
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
