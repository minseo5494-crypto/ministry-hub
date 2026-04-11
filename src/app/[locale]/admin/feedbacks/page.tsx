'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  ArrowLeft, Bug, Lightbulb, HelpCircle, Clock, CheckCircle,
  Eye, ExternalLink, RefreshCw, Filter, ChevronDown
} from 'lucide-react';

interface Feedback {
  id: string;
  user_id: string | null;
  user_email: string | null;
  type: 'bug' | 'feature' | 'other';
  message: string;
  page_url: string;
  user_agent: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

type FilterType = 'all' | 'bug' | 'feature' | 'other';
type FilterStatus = 'all' | 'pending' | 'reviewed' | 'resolved';

export default function AdminFeedbacks() {
  const router = useRouter();
  const t = useTranslations('admin');
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadFeedbacks();
    }
  }, [filterType, filterStatus]);

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
        alert(t('adminRequired'));
        router.push('/');
        return;
      }

      await loadFeedbacks();
    } catch (error) {
      console.error('Error checking admin:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async () => {
    try {
      let query = supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error loading feedbacks:', error);
    }
  };

  const updateStatus = async (feedbackId: string, newStatus: 'pending' | 'reviewed' | 'resolved') => {
    setUpdating(feedbackId);
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ status: newStatus })
        .eq('id', feedbackId);

      if (error) throw error;

      setFeedbacks(prev =>
        prev.map(f => f.id === feedbackId ? { ...f, status: newStatus } : f)
      );

      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback({ ...selectedFeedback, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert(t('statusUpdateFailed'));
    } finally {
      setUpdating(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="w-4 h-4 text-red-600" />;
      case 'feature': return <Lightbulb className="w-4 h-4 text-yellow-600" />;
      default: return <HelpCircle className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bug': return t('typeBug');
      case 'feature': return t('typeFeature');
      default: return t('typeOther');
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'bug': return 'bg-red-100 text-red-700';
      case 'feature': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <Clock className="w-3 h-3" />
            {t('statusPendingFilter')}
          </span>
        );
      case 'reviewed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Eye className="w-3 h-3" />
            {t('statusReviewed')}
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            {t('statusResolved')}
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const stats = {
    total: feedbacks.length,
    pending: feedbacks.filter(f => f.status === 'pending').length,
    bug: feedbacks.filter(f => f.type === 'bug').length,
    feature: feedbacks.filter(f => f.type === 'feature').length,
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
                <h1 className="text-2xl font-bold text-gray-900">{t('feedbackManagement')}</h1>
                <p className="text-sm text-gray-600">{t('feedbackSubtitle')}</p>
              </div>
            </div>
            <button
              onClick={loadFeedbacks}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <RefreshCw size={18} />
              {t('refresh')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">{t('totalFeedbacksStat')}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">{t('pendingStat')}</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">{t('bugReportsStat')}</p>
            <p className="text-2xl font-bold text-red-600">{stats.bug}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">{t('featureRequestsStat')}</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.feature}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{t('filterColon')}</span>
            </div>

            {/* 유형 필터 */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="appearance-none bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('allTypes')}</option>
                <option value="bug">{t('typeBug')}</option>
                <option value="feature">{t('typeFeature')}</option>
                <option value="other">{t('typeOther')}</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* 상태 필터 */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="appearance-none bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('allStatuses')}</option>
                <option value="pending">{t('statusPendingFilter')}</option>
                <option value="reviewed">{t('statusReviewed')}</option>
                <option value="resolved">{t('statusResolved')}</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 피드백 목록 */}
        <div className="bg-white rounded-lg shadow">
          {feedbacks.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {t('noFeedbacks')}
            </div>
          ) : (
            <div className="divide-y">
              {feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => setSelectedFeedback(feedback)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(feedback.type)}`}>
                          {getTypeIcon(feedback.type)}
                          {getTypeLabel(feedback.type)}
                        </span>
                        {getStatusBadge(feedback.status)}
                      </div>
                      <p className="text-gray-900 line-clamp-2 mb-2">{feedback.message}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>{feedback.user_email || t('anonymous')}</span>
                        <span>{formatDate(feedback.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <select
                        value={feedback.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateStatus(feedback.id, e.target.value as 'pending' | 'reviewed' | 'resolved');
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={updating === feedback.id}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="pending">{t('statusPendingFilter')}</option>
                        <option value="reviewed">{t('statusReviewed')}</option>
                        <option value="resolved">{t('statusResolved')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* 모달 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{t('feedbackDetail')}</h3>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="text-white/80 hover:text-white transition text-2xl"
              >
                &times;
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* 유형 & 상태 */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${getTypeBadgeColor(selectedFeedback.type)}`}>
                  {getTypeIcon(selectedFeedback.type)}
                  {getTypeLabel(selectedFeedback.type)}
                </span>
                {getStatusBadge(selectedFeedback.status)}
              </div>

              {/* 메시지 */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 mb-2">{t('messageLabel')}</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedFeedback.message}</p>
                </div>
              </div>

              {/* 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">{t('authorLabel')}</h4>
                  <p className="text-gray-900">{selectedFeedback.user_email || t('anonymous')}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">{t('dateLabel')}</h4>
                  <p className="text-gray-900">{formatDate(selectedFeedback.created_at)}</p>
                </div>
              </div>

              {/* 페이지 URL */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 mb-1">{t('pageUrlLabel')}</h4>
                <a
                  href={selectedFeedback.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 break-all"
                >
                  {selectedFeedback.page_url}
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                </a>
              </div>

              {/* User Agent */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 mb-1">{t('browserInfoLabel')}</h4>
                <p className="text-gray-600 text-sm break-all">{selectedFeedback.user_agent}</p>
              </div>

              {/* 상태 변경 */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">{t('statusChange')}</h4>
                <div className="flex gap-2">
                  {(['pending', 'reviewed', 'resolved'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedFeedback.id, status)}
                      disabled={updating === selectedFeedback.id || selectedFeedback.status === status}
                      className={`px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 ${
                        selectedFeedback.status === status
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status === 'pending' && t('statusPendingFilter')}
                      {status === 'reviewed' && t('statusReviewed')}
                      {status === 'resolved' && t('statusResolved')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
