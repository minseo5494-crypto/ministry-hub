'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { OfficialUploader } from '@/lib/types';
import { ArrowLeft, Plus, Trash2, Shield, UserCheck } from 'lucide-react';

export default function OfficialUploadersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploaders, setUploaders] = useState<OfficialUploader[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
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
        alert('관리자 권한이 필요합니다.');
        router.push('/');
        return;
      }

      setUser(currentUser);
      await loadUploaders();
    } catch (error) {
      console.error('Error checking admin:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loadUploaders = async () => {
    const { data, error } = await supabase
      .from('official_uploaders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading uploaders:', error);
      return;
    }

    setUploaders(data || []);
  };

  const addUploader = async () => {
    if (!newEmail.trim()) {
      alert('이메일을 입력해주세요.');
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      alert('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('official_uploaders')
        .insert({
          email: newEmail.trim().toLowerCase(),
          name: newName.trim() || null,
          description: newDescription.trim() || null,
          created_by: user.id
        });

      if (error) {
        if (error.code === '23505') {
          alert('이미 등록된 이메일입니다.');
        } else {
          throw error;
        }
        return;
      }

      // 해당 사용자가 업로드한 기존 곡들을 공식으로 마킹
      const { data: uploaderUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', newEmail.trim().toLowerCase())
        .single();

      if (uploaderUser) {
        await supabase
          .from('songs')
          .update({ is_official: true })
          .eq('uploaded_by', uploaderUser.id);
      }

      setNewEmail('');
      setNewName('');
      setNewDescription('');
      await loadUploaders();
      alert('공식 업로더가 추가되었습니다.');
    } catch (error) {
      console.error('Error adding uploader:', error);
      alert('추가 중 오류가 발생했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const removeUploader = async (uploader: OfficialUploader) => {
    if (!confirm(`"${uploader.email}"을(를) 공식 업로더에서 삭제하시겠습니까?\n\n이 계정이 업로드한 곡들은 "사용자 추가" 상태로 변경됩니다.`)) {
      return;
    }

    try {
      // 먼저 해당 사용자의 곡들을 비공식으로 변경
      const { data: uploaderUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', uploader.email)
        .single();

      if (uploaderUser) {
        await supabase
          .from('songs')
          .update({ is_official: false })
          .eq('uploaded_by', uploaderUser.id);
      }

      // 공식 업로더 목록에서 삭제
      const { error } = await supabase
        .from('official_uploaders')
        .delete()
        .eq('id', uploader.id);

      if (error) throw error;

      await loadUploaders();
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('Error removing uploader:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="text-blue-600" />
                공식 업로더 관리
              </h1>
              <p className="text-sm text-gray-600">
                공식 업로더가 업로드한 곡에는 공식 인증 뱃지가 표시됩니다
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 새 업로더 추가 */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Plus size={20} />
              새 공식 업로더 추가
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 *
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  표시 이름
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 관리자"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="예: 시스템 관리자"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={addUploader}
              disabled={adding || !newEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  추가 중...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  추가
                </>
              )}
            </button>
          </div>
        </div>

        {/* 공식 업로더 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserCheck size={20} />
                등록된 공식 업로더
              </h2>
              <span className="text-sm text-gray-500">
                총 {uploaders.length}명
              </span>
            </div>
          </div>
          <div className="p-6">
            {uploaders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Shield size={48} className="mx-auto mb-4 text-gray-300" />
                <p>등록된 공식 업로더가 없습니다.</p>
                <p className="text-sm mt-1">위에서 새 공식 업로더를 추가해주세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploaders.map((uploader) => (
                  <div
                    key={uploader.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Shield size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {uploader.name || uploader.email}
                          </span>
                          {uploader.name && (
                            <span className="text-sm text-gray-500">
                              ({uploader.email})
                            </span>
                          )}
                        </div>
                        {uploader.description && (
                          <p className="text-sm text-gray-600">{uploader.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          등록일: {new Date(uploader.created_at!).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeUploader(uploader)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 안내 */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">공식 업로더 안내</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>- 공식 업로더가 업로드한 곡에는 공식 인증 뱃지가 표시됩니다.</li>
            <li>- 새 공식 업로더를 추가하면 해당 계정의 기존 곡들도 공식으로 변경됩니다.</li>
            <li>- 공식 업로더를 삭제하면 해당 계정의 곡들은 사용자 추가 상태로 변경됩니다.</li>
            <li>- 이메일은 사용자가 로그인에 사용하는 이메일과 동일해야 합니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
