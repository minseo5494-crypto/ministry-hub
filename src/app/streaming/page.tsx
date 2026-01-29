'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMobile } from '@/hooks/useMobile'
import { 
  Music, Play, Heart, Home, Compass, Bookmark, Search,
  Shuffle, SkipBack, SkipForward, Repeat, Volume2, 
  Maximize2, Pause, ArrowLeft, MoreVertical
} from 'lucide-react'

interface Video {
  id: number
  title: string
  duration: string
  views: string
  category: string
  artist: string
}

// 카테고리별 그라데이션 색상
const categoryGradients: Record<string, string> = {
  Worship: 'from-blue-500 to-purple-600',
  Sermon: 'from-amber-500 to-orange-600',
  Prayer: 'from-emerald-500 to-teal-600',
  Youth: 'from-pink-500 to-rose-600',
  Kids: 'from-cyan-400 to-blue-500',
  default: 'from-slate-600 to-slate-800',
}

interface Song {
  id: number
  title: string
  artist: string
  plays: string
  duration: string
}

export default function Streaming() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'library'>('home')
  const [selectedCategory, setSelectedCategory] = useState('All')

// 모바일 감지
const isMobile = useMobile()

  const videos: Video[] = [
    {
      id: 1,
      title: "Sunday Morning Worship Service",
      duration: "1:45:30",
      views: "2.3K views",
      category: "Worship",
      artist: "Grace Community Church"
    },
    {
      id: 2,
      title: "Pastor John's Message: Faith in Action",
      duration: "42:15",
      views: "1.8K views",
      category: "Sermon",
      artist: "Pastor John Miller"
    },
    {
      id: 3,
      title: "Evening Prayer & Meditation",
      duration: "28:45",
      views: "1.2K views",
      category: "Prayer",
      artist: "Worship Ministry"
    },
  ]

  const popularSongs: Song[] = [
    {
      id: 1,
      title: "How Great Is Our God",
      artist: "Chris Tomlin",
      plays: "125K",
      duration: "4:32"
    },
    {
      id: 2,
      title: "Oceans (Where Feet May Fail)",
      artist: "Hillsong UNITED",
      plays: "98K",
      duration: "8:58"
    },
    // ... 더 많은 노래 데이터 추가 가능
  ]

  const categories = ['All', 'Worship', 'Sermon', 'Prayer', 'Youth', 'Kids']

  const filteredVideos = selectedCategory === 'All' 
    ? videos 
    : videos.filter(video => video.category === selectedCategory)

  return (
    <div className="min-h-screen bg-slate-900 text-white flex streaming-page">
      {/* 왼쪽 사이드바 */}
      <div className="w-72 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 fixed h-full overflow-y-auto">
        {/* 로고 섹션 */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Music className="text-white w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-white font-pacifico">
                PraiseHub
              </span>
            </div>
            {/* WORSHEEP으로 돌아가기 */}
            <button
              onClick={() => router.push('/main')}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              title="뒤로가기 (메인)"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>뒤로가기 (메인)</span>
            </button>
          </div>
        </div>

        {/* 네비게이션 */}
        <div className="p-4">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === 'home'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">Home</span>
            </button>
            
            <button
              onClick={() => setActiveTab('explore')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === 'explore'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Compass className="w-5 h-5" />
              <span className="font-medium">Explore</span>
            </button>
            
            <button
              onClick={() => setActiveTab('library')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === 'library'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Bookmark className="w-5 h-5" />
              <span className="font-medium">Your Library</span>
            </button>
          </nav>
        </div>

        {/* 빠른 재생목록 */}
        <div className="px-6 py-4 border-t border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Quick Playlists
          </h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700/30 rounded-lg transition-all duration-200">
              Sunday Service
            </button>
            <button className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700/30 rounded-lg transition-all duration-200">
              Youth Worship
            </button>
            <button className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700/30 rounded-lg transition-all duration-200">
              Prayer & Meditation
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 ml-72">
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-b from-slate-800/50 to-transparent backdrop-blur-sm sticky top-0 z-10 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-slate-700/50 rounded-full px-4 py-2 flex-1 max-w-md">
              <Search className="text-slate-400 w-5 h-5 mr-3" />
              <input
                type="text"
                placeholder="Search for songs, artists, or sermons"
                className="bg-transparent text-white placeholder-slate-400 outline-none flex-1"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 bg-slate-700/50 text-white rounded-full hover:bg-slate-600/50 transition-colors">
                Sign In
              </button>
              <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full hover:opacity-90 transition-opacity">
                Sign Up
              </button>
            </div>
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="px-8 pb-32">
          {activeTab === 'home' && (
            <>
              {/* Hero 섹션 */}
              <div className="mb-12">
                <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Welcome to PraiseHub
                </h1>
                <p className="text-xl text-slate-300">
                  Discover and stream worship music, sermons, and spiritual content
                </p>
              </div>

              {/* Featured Content */}
              <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Featured Content</h2>
                  <button className="text-slate-400 hover:text-white text-sm font-medium">
                    Show all
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos.slice(0, 3).map((video) => (
                    <div key={video.id} className="group cursor-pointer">
                      <div className="relative mb-4">
                        <div className="w-full aspect-video bg-slate-700 rounded-xl overflow-hidden">
                          <div className={`w-full h-full bg-gradient-to-br ${categoryGradients[video.category] || categoryGradients.default} flex items-center justify-center`}>
                            <Music className="w-12 h-12 text-white/50" />
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 rounded-xl flex items-center justify-center">
                          <div className="w-14 h-14 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                            <Play className="w-6 h-6 text-slate-800 ml-1" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                          {video.duration}
                        </div>
                      </div>
                      <h3 className="text-white font-medium text-sm mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-slate-400 text-xs">{video.artist}</p>
                      <p className="text-slate-500 text-xs mt-1">{video.views}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Popular Songs */}
              <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Popular Worship Songs</h2>
                  <button className="text-slate-400 hover:text-white text-sm font-medium">
                    Show all
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {popularSongs.map((song) => (
                    <div key={song.id} className="group cursor-pointer">
                      <div className="relative mb-4">
                        <div className="w-full aspect-square bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                          <Music className="w-12 h-12 text-white" />
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 rounded-xl flex items-center justify-center">
                          <div className="w-14 h-14 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                            <Play className="w-6 h-6 text-slate-800 ml-1" />
                          </div>
                        </div>
                      </div>
                      <h3 className="text-white font-medium text-sm mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors">
                        {song.title}
                      </h3>
                      <p className="text-slate-400 text-xs">{song.artist}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
                <div className="flex flex-wrap gap-3 mb-8">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                        selectedCategory === category
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVideos.map((video) => (
                    <div key={video.id} className="group cursor-pointer bg-slate-800/30 rounded-xl p-4 hover:bg-slate-700/30 transition-all duration-200">
                      <div className="flex space-x-4">
                        <div className="relative flex-shrink-0">
                          <div className={`w-20 h-20 bg-gradient-to-br ${categoryGradients[video.category] || categoryGradients.default} rounded-lg flex items-center justify-center`}>
                            <Music className="w-8 h-8 text-white/50" />
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 rounded-lg flex items-center justify-center">
                            <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <Play className="w-4 h-4 text-slate-800 ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors">
                            {video.title}
                          </h3>
                          <p className="text-slate-400 text-xs mb-1">{video.artist}</p>
                          <div className="flex items-center space-x-3 text-xs text-slate-500">
                            <span>{video.views}</span>
                            <span>•</span>
                            <span>{video.duration}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'explore' && (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Compass className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Explore Worship</h2>
              <p className="text-slate-400 text-lg">Discover new worship songs, artists, and spiritual content</p>
            </div>
          )}

          {activeTab === 'library' && (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bookmark className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Your Library</h2>
              <p className="text-slate-400 text-lg">Your saved songs, playlists, and favorite content will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* 하단 플레이어 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Music className="text-white w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-medium text-sm truncate">How Great Is Our God</div>
              <div className="text-slate-400 text-xs truncate">Chris Tomlin • Passion: How Great Is Our God</div>
            </div>
            <button className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
              <Heart className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center space-x-6 flex-1 justify-center">
            <button className="text-slate-400 hover:text-white transition-colors">
              <Shuffle className="w-5 h-5" />
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform">
              <Pause className="w-5 h-5 text-slate-800" />
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Repeat className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center space-x-4 flex-1 justify-end">
            <span className="text-slate-400 text-sm">2:34</span>
            <div className="w-32 h-1 bg-slate-600 rounded-full">
              <div className="w-8 h-1 bg-white rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm">4:32</span>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Volume2 className="w-5 h-5" />
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}