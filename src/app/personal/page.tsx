'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Music, Upload, Search, Filter, Home, Users, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function PersonalPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState({
    key: '',
    tempo: '',
    theme: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSongs();
  }, [searchText, selectedFilter, songs]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      // 개인 악보 가져오기
      const { data: personalSongs, error } = await supabase
        .from('songs')
        .select('*')
        .eq('owner_type', 'personal')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSongs(personalSongs || []);
      setFilteredSongs(personalSongs || []);
    } catch (error) {
      console.error('Error loading songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSongs = () => {
    let filtered = [...songs];

    // 검색어 필터
    if (searchText) {
      filtered = filtered.filter(song =>
        song.song_name.toLowerCase().includes(searchText.toLowerCase()) ||
        song.team_name?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 키 필터
    if (selectedFilter.key) {
      filtered = filtered.filter(song => song.key === selectedFilter.key);
    }

    // 템포 필터
    if (selectedFilter.tempo) {
      filtered = filtered.filter(song => song.tempo === selectedFilter.tempo);
    }

    // 테마 필터
    if (selectedFilter.theme) {
      filtered = filtered.filter(song => 
        song.theme1 === selectedFilter.theme || song.theme2 === selectedFilter.theme
      );
    }

    setFilteredSongs(filtered);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Music className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold">내 악보</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{user?.email}</span>
              
              <Link href="/teams">
                <button className="px-4 py-2 bg-[#C4BEE2] text-white rounded-lg hover:bg-[#A9A1D1] flex items-center">
                  <Users className="mr-2" size={18} />
                  내 팀
                </button>
              </Link>
              
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center"
              >
                <LogOut className="mr-2" size={18} />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="곡명 또는 아티스트 검색..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            
            <select
              value={selectedFilter.key}
              onChange={(e) => setSelectedFilter({...selectedFilter, key: e.target.value})}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">모든 키</option>
              {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            
            <select
              value={selectedFilter.tempo}
              onChange={(e) => setSelectedFilter({...selectedFilter, tempo: e.target.value})}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">모든 템포</option>
              <option value="느림">느림</option>
              <option value="보통">보통</option>
              <option value="빠름">빠름</option>
            </select>

            <Link href="/personal/upload">
              <button className="px-6 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center">
                <Upload className="mr-2" size={18} />
                악보 추가
              </button>
            </Link>
          </div>
        </div>

        {/* 악보 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">
              내 악보 ({filteredSongs.length}개)
            </h2>
          </div>
          
          {filteredSongs.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">아직 추가한 악보가 없습니다</p>
              <p className="text-sm text-gray-500 mt-2">
                팀에서 악보를 복사하거나 새 악보를 추가해보세요
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredSongs.map((song) => (
                <div key={song.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{song.song_name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {song.team_name && <span>{song.team_name}</span>}
                        {song.key && <span>Key: {song.key}</span>}
                        {song.time_signature && <span>{song.time_signature}</span>}
                        {song.tempo && <span>{song.tempo}</span>}
                      </div>
                      {song.source_context && song.source_context.startsWith('team:') && (
                        <div className="mt-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            팀에서 복사됨
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {song.file_url && (
                        <a
                          href={song.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                        >
                          악보 보기
                        </a>
                      )}
                      <button
                        onClick={() => router.push(`/personal/${song.id}/edit`)}
                        className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}