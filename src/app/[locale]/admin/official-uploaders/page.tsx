'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { OfficialUploader } from '@/lib/supabase';
import { ArrowLeft, Plus, Trash2, Shield, UserCheck } from 'lucide-react';

export default function OfficialUploadersPage() {
  const router = useRouter();
  const t = useTranslations('admin');
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
      alert(t('emailRequired2'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      alert(t('invalidEmail'));
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
          alert(t('alreadyRegistered'));
        } else {
          throw error;
        }
        return;
      }

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
      alert(t('uploaderAdded'));
    } catch (error) {
      console.error('Error adding uploader:', error);
      alert(t('publisherAddError'));
    } finally {
      setAdding(false);
    }
  };

  const removeUploader = async (uploader: OfficialUploader) => {
    if (!confirm(t('uploaderDeleteConfirm', { email: uploader.email }))) {
      return;
    }

    try {
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

      const { error } = await supabase
        .from('official_uploaders')
        .delete()
        .eq('id', uploader.id);

      if (error) throw error;

      await loadUploaders();
      alert(t('deleted'));
    } catch (error) {
      console.error('Error removing uploader:', error);
      alert(t('deleteErrorGeneric'));
    }
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
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="text-blue-600" />
                {t('officialUploaderManagement')}
              </h1>
              <p className="text-sm text-gray-600">
                {t('officialUploaderDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Plus size={20} />
              {t('addOfficialUploaderTitle')}
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('emailLabel2')}
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
                  {t('displayName')}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('displayNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('descriptionFieldLabel')}
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={addUploader}
              disabled={adding || !newEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  {t('adding')}
                </>
              ) : (
                <>
                  <Plus size={18} />
                  {t('add')}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserCheck size={20} />
                {t('currentUploaderList', { count: uploaders.length })}
              </h2>
            </div>
          </div>
          <div className="p-6">
            {uploaders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Shield size={48} className="mx-auto mb-4 text-gray-300" />
                <p>{t('noUploaders')}</p>
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
                          {t('signupDate', { date: new Date(uploader.created_at!).toLocaleDateString() })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeUploader(uploader)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title={t('delete')}
                    >
                      <Trash2 size={18} />
                    </button>
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
