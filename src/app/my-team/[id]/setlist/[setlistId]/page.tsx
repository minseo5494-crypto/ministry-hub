'use client'

import { useState, useEffect, useRef } from 'react'
// 🆕 드래그 앤 드롭 라이브러리 추가
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Song } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { logDownload } from '@/lib/downloadLogger'
import { PDFSong } from '@/lib/pdfGenerator'
import SongFormPositionModal from '@/components/SongFormPositionModal' // 🆕 추가
import { canEditSetlist } from '@/lib/teamOperations' // ✅ 추가
import {
  ArrowLeft, Edit, Trash2, Plus, Music, X,
  Save, Eye, EyeOff, ChevronUp, ChevronDown,
  Download, FileDown, Youtube, ChevronLeft, ChevronRight, Presentation,
  GripVertical // 🆕 드래그 핸들 아이콘 추가
} from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import { useDownload } from '@/hooks/useDownload'

interface SetlistSong {
  id: string
  order_number: number
  key_transposed?: string
  notes?: string
  selected_form?: string[]
  songs: Song
}

interface SetlistDetail {
  id: string
  title: string
  service_date: string
  service_type?: string
  notes?: string
  team_id: string
   created_by: string // ✅ 추가
}

// 🆕 송폼 위치 타입 정의
interface SongFormPosition {
  x: number
  y: number
  size?: 'small' | 'medium' | 'large'
}

// 🆕 드래그 가능한 곡 아이템 컴포넌트
interface SortableSongItemProps {
  song: SetlistSong
  index: number
  canEdit: boolean
  onRemove: (id: string) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onTogglePreview: (id: string) => void
  onOpenSongForm: (song: SetlistSong) => void
  onOpenSheetViewer: (song: SetlistSong) => void
  onOpenYoutubeModal: (song: Song) => void
  onOpenNoteModal: (song: SetlistSong) => void  // ✅ 추가
  isPreviewOpen: boolean
  totalSongs: number
}

function SortableSongItem({
  song,
  index,
  canEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  onTogglePreview,
  onOpenSongForm,
  onOpenSheetViewer,
  onOpenYoutubeModal,
  onOpenNoteModal,  // ✅ 추가
  isPreviewOpen,
  totalSongs,
}: SortableSongItemProps) {
  // 🆕 여기서 useSortable 호출 (컴포넌트 최상위)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id })
  // 메모 펼침 상태
  const [isNoteExpanded, setIsNoteExpanded] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 hover:bg-gray-50 print-song ${isDragging ? 'shadow-2xl z-50' : ''}`}
    >
      {/* 상단: 곡 정보 + 버튼 (항상 고정) */}
      <div className="flex items-start justify-between">
        <div className="flex items-start flex-1 gap-2">
          {/* 드래그 핸들 */}
          {canEdit && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing pt-1 text-gray-400 hover:text-gray-600"
              title="드래그하여 순서 변경"
            >
              <GripVertical size={20} />
            </div>
          )}
          <span className="text-lg font-bold text-blue-600 w-8 mt-1">
            {index + 1}.
          </span>
          <div className="flex-1 min-w-0">
            {/* 기본 정보 (항상 표시) */}
            <h3 className="font-semibold text-gray-900 text-xl mb-2">
              {song.songs.song_name}
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              {song.songs.team_name} • Key: {song.key_transposed || song.songs.key || '-'}
            </p>
            {song.selected_form && song.selected_form.length > 0 && (
              <p className="text-sm text-purple-600 mb-2">
                송폼: {song.selected_form.join(' - ')}
              </p>
            )}
            {/* 메모 표시 */}
            {song.notes ? (
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm text-yellow-800">
                    <span className="font-medium">📝 메모:</span>
                    <pre className="whitespace-pre-wrap font-sans mt-1">
                      {song.notes.length > 100 && !isNoteExpanded
                        ? `${song.notes.slice(0, 100)}...`
                        : song.notes
                      }
                    </pre>
                  </div>
                  {song.notes.length > 100 && (
                    <button
                      onClick={() => setIsNoteExpanded(!isNoteExpanded)}
                      className="text-xs text-yellow-700 hover:text-yellow-900 mt-1 font-medium flex items-center gap-1"
                    >
                      {isNoteExpanded ? (
                        <>
                          <ChevronUp size={14} />
                          접기
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          더보기
                        </>
                      )}
                    </button>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => onOpenNoteModal(song)}
                    className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                  >
                    수정
                  </button>
                )}
              </div>
            ) : (
              canEdit && (
                <button
                  onClick={() => onOpenNoteModal(song)}
                  className="text-sm text-blue-600 hover:text-blue-800 mb-2"
                >
                  + 메모 추가
                </button>
              )
            )}
          </div>
        </div>

        {/* 버튼들 - 항상 오른쪽 상단에 고정 */}
        <div className="flex gap-2 no-print ml-4 flex-shrink-0">
          {/* 미리보기 토글 버튼 */}
          {(song.songs.lyrics || song.songs.file_url) && (
            <button
              onClick={() => onTogglePreview(song.id)}
              className={`p-2 rounded-lg ${
                isPreviewOpen
                  ? 'text-blue-600 bg-blue-100'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={isPreviewOpen ? '접기' : '펼치기'}
            >
              {isPreviewOpen ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
          {/* 악보보기 전체화면 버튼 */}
          {song.songs.file_url && (
            <button
              onClick={() => onOpenSheetViewer(song)}
              className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
              title="악보 전체화면"
            >
              <Presentation size={18} />
            </button>
          )}
          {/* 유튜브 영상 버튼 */}
          <button
            onClick={() => {
              if (song.songs.youtube_url) {
                onOpenYoutubeModal(song.songs)
              }
            }}
            disabled={!song.songs.youtube_url}
            className="p-2 rounded-lg"
            style={{
              color: !song.songs.youtube_url ? '#d1d5db' : '#dc2626',
              backgroundColor: 'transparent',
              cursor: song.songs.youtube_url ? 'pointer' : 'not-allowed',
              opacity: song.songs.youtube_url ? 1 : 0.5
            }}
            title={!song.songs.youtube_url ? '유튜브 링크 없음' : '유튜브 열기'}
          >
            <Youtube size={18} />
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => onOpenSongForm(song)}
                className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
                title="송폼 편집"
              >
                <Edit size={18} />
              </button>
              <button
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                <ChevronUp size={18} />
              </button>
              <button
                onClick={() => onMoveDown(index)}
                disabled={index === totalSongs - 1}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                <ChevronDown size={18} />
              </button>
              <button
                onClick={() => onRemove(song.id)}
                className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 하단: 펼쳐지는 콘텐츠 (악보/가사) - 버튼 아래 별도 영역 */}
      {isPreviewOpen && (
        <div className="mt-4 border-t pt-4">
          {song.songs.lyrics && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2">가사</h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                {song.songs.lyrics}
              </pre>
            </div>
          )}
          {song.songs.file_url && (
            <div className="-mx-4">
              <h4 className="font-semibold text-gray-700 mb-2 px-4">악보</h4>
              {song.songs.file_type === 'pdf' ? (
                <iframe
                  src={`${song.songs.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-[700px] border-y"
                />
              ) : (
                <img
                  src={song.songs.file_url}
                  alt={`${song.songs.song_name} 악보`}
                  className="w-full h-auto"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TeamSetlistDetailPage() {
  
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const setlistId = params.setlistId as string

  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [setlist, setSetlist] = useState<SetlistDetail | null>(null)
  const [songs, setSongs] = useState<SetlistSong[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // 편집 상태
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editType, setEditType] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // 곡 추가 모달
  const [showAddSongModal, setShowAddSongModal] = useState(false)
  const [availableSongs, setAvailableSongs] = useState<Song[]>([])
  const [searchText, setSearchText] = useState('')

  // 미리보기 상태 (각 곡별로 토글)
  const [previewStates, setPreviewStates] = useState<{ [key: string]: boolean }>({})
  
  // 유튜브 영상 토글 상태 (각 곡별로)
  const [youtubeStates, setYoutubeStates] = useState<{ [key: string]: boolean }>({})

  // 송폼 편집 모달
  const [showSongFormModal, setShowSongFormModal] = useState(false)
  const [selectedSongForForm, setSelectedSongForForm] = useState<SetlistSong | null>(null)
  const [tempSongForm, setTempSongForm] = useState<string[]>([])
  const [customFormInput, setCustomFormInput] = useState('')

  // 송폼 옵션
  const songFormOptions = [
    'Intro', 'V1', 'V2', 'V3', 'Pc', 'Pc1', 'Pc2', 'C', 'C1', 'C2',
    '간주', 'Interlude', 'B', 'Bridge', 'Out', 'Outro', 'Ending'
  ]

  // 다운로드 상태
  const [downloadingPPT, setDownloadingPPT] = useState(false)


  // 🎵 악보보기 모드 전용 상태 추가
  const [showSheetViewer, setShowSheetViewer] = useState(false)
  const [currentSheetSong, setCurrentSheetSong] = useState<Song | null>(null)
  const [currentPDFPage, setCurrentPDFPage] = useState(1)
  const [totalPDFPages, setTotalPDFPages] = useState(0)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [isLoadingPDF, setIsLoadingPDF] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
// 🔍 확대/축소 상태
  const [zoomLevel, setZoomLevel] = useState(1)
  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3
  const ZOOM_STEP = 0.25

  // 🎵 유튜브 모달 상태 추가
  const [youtubeModalSong, setYoutubeModalSong] = useState<Song | null>(null)

  // 📝 메모 수정 모달 상태
const [noteModal, setNoteModal] = useState<{
  show: boolean
  songId: string
  songName: string
  currentNote: string
}>({
  show: false,
  songId: '',
  songName: '',
  currentNote: ''
})
const [savingNote, setSavingNote] = useState(false)

// 🆕 useDownload 훅용 데이터 변환 (songs 상태 이후에 위치해야 함)
const downloadSongs = songs.map(s => s.songs)
const downloadSongForms: { [key: string]: string[] } = {}
songs.forEach(s => {
  if (s.selected_form && s.selected_form.length > 0) {
    downloadSongForms[s.songs.id] = s.selected_form
  }
})

// 🆕 useDownload 훅 사용
const {
  downloadingPDF,
  downloadingImage,
  showFormatModal,
  showPositionModal,
  setShowFormatModal,
  setShowPositionModal,
  handleDownload,
  onPositionConfirm,
  onPositionCancel,
  startDownloadWithFormat,
} = useDownload({
  selectedSongs: downloadSongs,
  songForms: downloadSongForms,
  userId: user?.id,
  setlistTitle: setlist?.title,
  setlistDate: setlist?.service_date ? new Date(setlist.service_date).toLocaleDateString('ko-KR') : undefined
})

  // 🆕 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이상 움직여야 드래그 시작
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [canUserEdit, setCanUserEdit] = useState(false) // ✅ 편집 권한 상태

// 모바일 감지
const isMobile = useMobile()

useEffect(() => {
  checkUser()
}, [])

  useEffect(() => {
    if (user && teamId && setlistId) {
      fetchSetlistDetail()
    }
  }, [user, teamId, setlistId])

  // ✅ 편집 권한 확인 (생성자 체크 추가)
useEffect(() => {
  const checkEditPermission = async () => {
    if (user && teamId && setlistId) {
      const canEdit = await canEditSetlist(teamId, setlistId, user.id)
      setCanUserEdit(canEdit)
    }
  }
  checkEditPermission()
}, [user, teamId, setlistId, setlist])

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setUser(currentUser)

      // 사용자 역할 확인
      const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', currentUser.id)
        .eq('status', 'active')
        .single()

      if (memberData) {
        setUserRole(memberData.role)
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    }
  }

  const fetchSetlistDetail = async () => {
    setLoading(true)
    try {
      // 콘티 기본 정보
      const { data: setlistData, error: setlistError } = await supabase
        .from('team_setlists')
        .select('*')
        .eq('id', setlistId)
        .eq('team_id', teamId)
        .single()

      if (setlistError) throw setlistError
      setSetlist(setlistData)

      setEditTitle(setlistData.title)
      setEditDate(setlistData.service_date)
      setEditType(setlistData.service_type || '')
      setEditNotes(setlistData.notes || '')

      // 콘티에 포함된 곡들
      const { data: songsData, error: songsError } = await supabase
        .from('team_setlist_songs')
        .select(`
          id,
          order_number,
          key_transposed,
          notes,
          selected_form,
          songs (*)
        `)
        .eq('setlist_id', setlistId)
        .order('order_number', { ascending: true })

      if (songsError) throw songsError
      setSongs((songsData as any) || [])
      
      // 초기 미리보기 상태 설정 (모두 닫혀있음)
      const initialStates: { [key: string]: boolean } = {}
      const initialYoutubeStates: { [key: string]: boolean } = {}
      if (songsData) {
        songsData.forEach((song: any) => {
          initialStates[song.id] = false
          initialYoutubeStates[song.id] = false
        })
      }
      setPreviewStates(initialStates)
      setYoutubeStates(initialYoutubeStates)
    } catch (error) {
      console.error('Error fetching setlist:', error)
      alert('콘티를 불러오는데 실패했습니다.')
      router.push(`/my-team/${teamId}`)
    } finally {
      setLoading(false)
    }
  }

  // ✅ 기존 함수 수정
const canEdit = () => {
  return canUserEdit
}

  const handleSaveEdit = async () => {
    if (!canEdit()) {
      alert('수정 권한이 없습니다.')
      return
    }

    try {
      const { error } = await supabase
        .from('team_setlists')
        .update({
          title: editTitle,
          service_date: editDate,
          service_type: editType,
          notes: editNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', setlistId)

      if (error) throw error

      alert('✅ 수정되었습니다.')
      setIsEditing(false)
      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error updating setlist:', error)
      alert(`수정 실패: ${error.message}`)
    }
  }

  const handleDeleteSetlist = async () => {
    if (!canEdit()) {
      alert('삭제 권한이 없습니다.')
      return
    }

    if (!confirm('정말 이 콘티를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('team_setlists')
        .delete()
        .eq('id', setlistId)

      if (error) throw error

      alert('✅ 삭제되었습니다.')
      router.push(`/my-team/${teamId}`)
    } catch (error: any) {
      console.error('Error deleting setlist:', error)
      alert(`삭제 실패: ${error.message}`)
    }
  }

  const moveSong = async (index: number, direction: 'up' | 'down') => {
    if (!canEdit()) {
      alert('수정 권한이 없습니다.')
      return
    }

    const newSongs = [...songs]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newSongs.length) return

    // 순서 교환
    ;[newSongs[index], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[index]]

    // DB 업데이트
    try {
      const updates = newSongs.map((song, idx) => ({
        id: song.id,
        order_number: idx + 1
      }))

      for (const update of updates) {
        await supabase
          .from('team_setlist_songs')
          .update({ order_number: update.order_number })
          .eq('id', update.id)
      }

      setSongs(newSongs)
    } catch (error) {
      console.error('Error moving song:', error)
      alert('순서 변경에 실패했습니다.')
    }
  }

  // 🆕 드래그 앤 드롭 핸들러
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    if (!canEdit()) {
      return
    }

    const oldIndex = songs.findIndex((song) => song.id === active.id)
    const newIndex = songs.findIndex((song) => song.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // 로컬 상태 즉시 업데이트 (부드러운 UX)
    const newSongs = arrayMove(songs, oldIndex, newIndex)
    setSongs(newSongs)

    // DB 업데이트
    try {
      const updates = newSongs.map((song, idx) => ({
        id: song.id,
        order_number: idx + 1
      }))

      for (const update of updates) {
        await supabase
          .from('team_setlist_songs')
          .update({ order_number: update.order_number })
          .eq('id', update.id)
      }
    } catch (error) {
      console.error('Error updating order:', error)
      alert('순서 변경에 실패했습니다.')
      // 실패 시 원래 상태로 복구
      fetchSetlistDetail()
    }
  }

  const removeSongFromSetlist = async (songId: string) => {
    if (!canEdit()) {
      alert('삭제 권한이 없습니다.')
      return
    }

    if (!confirm('이 곡을 콘티에서 제거하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('team_setlist_songs')
        .delete()
        .eq('id', songId)

      if (error) throw error

      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error removing song:', error)
      alert(`제거 실패: ${error.message}`)
    }
  }

  const openAddSongModal = async () => {
  if (!canEdit()) {
    alert('추가 권한이 없습니다.')
    return
  }

  try {
    // 🔥 전체 데이터를 페이지네이션으로 가져오기
    let allData: any[] = []
    let from = 0
    const pageSize = 1000

    console.log('📊 곡 목록 로딩 시작...')

    while (true) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('song_name', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw error
      if (!data || data.length === 0) break

      allData = [...allData, ...data]
      console.log(`📦 ${allData.length}개 로딩 중...`)

      // 마지막 페이지면 종료
      if (data.length < pageSize) break
      
      from += pageSize
    }

    console.log('✅ 전체 곡 목록:', allData.length)
    
    setAvailableSongs(allData)
    setShowAddSongModal(true)
  } catch (error) {
    console.error('Error fetching songs:', error)
    alert('곡 목록을 불러오는데 실패했습니다.')
  }
}

  const addSongToSetlist = async (song: Song) => {
    try {
      const maxOrder = songs.length > 0 
        ? Math.max(...songs.map(s => s.order_number)) 
        : 0

      const { error } = await supabase
        .from('team_setlist_songs')
        .insert({
          setlist_id: setlistId,
          song_id: song.id,
          order_number: maxOrder + 1
        })

      if (error) throw error

      setShowAddSongModal(false)
      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error adding song:', error)
      alert(`곡 추가 실패: ${error.message}`)
    }
  }

  const filteredAvailableSongs = availableSongs.filter(song =>
    song.song_name.toLowerCase().includes(searchText.toLowerCase()) ||
    song.team_name?.toLowerCase().includes(searchText.toLowerCase())
  )

  // 미리보기 토글
  const togglePreview = (songId: string) => {
    setPreviewStates(prev => ({
      ...prev,
      [songId]: !prev[songId]
    }))
  }

  // 유튜브 영상 토글
  const toggleYoutube = (songId: string) => {
    setYoutubeStates(prev => ({
      ...prev,
      [songId]: !prev[songId]
    }))
  }

  // 유튜브 URL을 임베드 형식으로 변환
  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null
    
    // https://www.youtube.com/watch?v=VIDEO_ID 형식
    const watchMatch = url.match(/[?&]v=([^&]+)/)
    if (watchMatch) {
      return `https://www.youtube.com/embed/${watchMatch[1]}`
    }
    
    // https://youtu.be/VIDEO_ID 형식
    const shortMatch = url.match(/youtu\.be\/([^?]+)/)
    if (shortMatch) {
      return `https://www.youtube.com/embed/${shortMatch[1]}`
    }
    
    // 이미 embed 형식인 경우
    if (url.includes('/embed/')) {
      return url
    }
    
    return null
  }

  // 송폼 편집 열기
  const openSongFormModal = (song: SetlistSong) => {
    if (!canEdit()) {
      alert('수정 권한이 없습니다.')
      return
    }
    setSelectedSongForForm(song)
    setTempSongForm(song.selected_form || [])
    setCustomFormInput('')
    setShowSongFormModal(true)
  }

  // 송폼 추가 (중복 허용)
const addSongForm = (form: string) => {
  setTempSongForm([...tempSongForm, form])
}

  // 커스텀 송폼 추가 (중복 허용)
const addCustomSongForm = () => {
  const trimmed = customFormInput.trim()
  if (trimmed) {
    setTempSongForm([...tempSongForm, trimmed])
    setCustomFormInput('')
  }
}

  // 송폼 제거 (인덱스 기반)
const removeSongForm = (index: number) => {
  setTempSongForm(tempSongForm.filter((_, i) => i !== index))
}

  // 송폼 순서 변경
  const moveSongForm = (index: number, direction: 'up' | 'down') => {
    const newForms = [...tempSongForm]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newForms.length) return
    ;[newForms[index], newForms[targetIndex]] = [newForms[targetIndex], newForms[index]]
    setTempSongForm(newForms)
  }

  // 송폼 저장
  const saveSongForm = async () => {
    if (!selectedSongForForm) return

    try {
      const { error } = await supabase
        .from('team_setlist_songs')
        .update({ selected_form: tempSongForm })
        .eq('id', selectedSongForForm.id)

      if (error) throw error

      alert('✅ 송폼이 저장되었습니다.')
      setShowSongFormModal(false)
      fetchSetlistDetail()
    } catch (error: any) {
      console.error('Error saving song form:', error)
      alert(`송폼 저장 실패: ${error.message}`)
    }
  }

  // PPT 다운로드
  const generatePPTFile = async () => {
  setDownloadingPPT(true)
  try {
    // 🆕 동적 import
    const pptxgen = (await import('pptxgenjs')).default
    const ppt = new pptxgen()

      // 표지 슬라이드
      const coverSlide = ppt.addSlide()
      coverSlide.background = { color: '1F2937' }
      coverSlide.addText(setlist.title, {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1.5,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
      })
      coverSlide.addText(
        `${new Date(setlist.service_date).toLocaleDateString('ko-KR')} • ${setlist.service_type || ''}`,
        {
          x: 0.5,
          y: 4.2,
          w: 9,
          h: 0.5,
          fontSize: 20,
          color: 'D1D5DB',
          align: 'center'
        }
      )

      // 각 곡 슬라이드
      songs.forEach((setlistSong, index) => {
        const song = setlistSong.songs
        const slide = ppt.addSlide()
        
        // 배경색
        slide.background = { color: 'FFFFFF' }

        // 곡 번호 및 제목
        slide.addText(`${index + 1}. ${song.song_name}`, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.8,
          fontSize: 32,
          bold: true,
          color: '1F2937'
        })

        // 아티스트
        if (song.team_name) {
          slide.addText(song.team_name, {
            x: 0.5,
            y: 1.4,
            w: 9,
            h: 0.4,
            fontSize: 18,
            color: '6B7280'
          })
        }

        // Key & 송폼
        let infoText = ''
        if (setlistSong.key_transposed || song.key) {
          infoText += `Key: ${setlistSong.key_transposed || song.key}`
        }
        if (setlistSong.selected_form && setlistSong.selected_form.length > 0) {
          infoText += `  |  송폼: ${setlistSong.selected_form.join(' - ')}`
        }
        if (infoText) {
          slide.addText(infoText, {
            x: 0.5,
            y: 1.9,
            w: 9,
            h: 0.4,
            fontSize: 14,
            color: '9CA3AF'
          })
        }

        // 가사
        if (song.lyrics) {
          slide.addText(song.lyrics, {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 4.5,
            fontSize: 16,
            color: '374151',
            valign: 'top'
          })
        }

        // 노트
        if (setlistSong.notes) {
          slide.addText(`메모: ${setlistSong.notes}`, {
            x: 0.5,
            y: 7.2,
            w: 9,
            h: 0.3,
            fontSize: 12,
            color: 'EF4444',
            italic: true
          })
        }
      })

      // 파일 저장
      const fileName = `${setlist.title}_${new Date(setlist.service_date).toLocaleDateString('ko-KR').replace(/\./g, '')}.pptx`
      await ppt.writeFile({ fileName })

      // 다운로드 로그
      await logDownload({
        userId: user.id,
        setlistId: setlist.id,
        downloadType: 'ppt',
        fileName: fileName,
        teamId: teamId,
        metadata: { songCount: songs.length }
      })

      alert('✅ PPT 파일이 다운로드되었습니다!')
    } catch (error: any) {
      console.error('Error generating PPT:', error)
      alert(`PPT 생성 실패: ${error.message}`)
    } finally {
      setDownloadingPPT(false)
    }
  }

  // 🎵 플레이리스트 공유
  const handleSharePlaylist = () => {
    const playlistUrl = `${window.location.origin}/playlist/${setlistId}`
    
    // 새 탭에서 플레이리스트 열기
    window.open(playlistUrl, '_blank')
    
    // 링크도 자동 복사 (공유용)
    navigator.clipboard.writeText(playlistUrl)
  }

  

  // 🎵 악보보기 모드 열기
  const openSheetViewerForSong = (setlistSong: SetlistSong) => {
    console.log('🎵 악보보기 모드 열기:', setlistSong.songs.song_name);
    setCurrentSheetSong(setlistSong.songs);
    setCurrentPDFPage(1);
    setPdfDoc(null);
    setZoomLevel(1);  // 🔍 줌 리셋 추가
    setShowSheetViewer(true);
  }

  // 🎵 악보보기 모드 닫기
  const closeSheetViewer = () => {
    setShowSheetViewer(false);
    setCurrentSheetSong(null);
    setPdfDoc(null);
    setCurrentPDFPage(1);
    setTotalPDFPages(0);
  }

  // 🔍 확대
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }

  // 🔍 축소
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }

  // 🔍 줌 리셋
  const handleZoomReset = () => {
    setZoomLevel(1);
  }
  // 📝 메모 모달 열기
const openNoteModal = (song: SetlistSong) => {
  setNoteModal({
    show: true,
    songId: song.id,
    songName: song.songs.song_name,
    currentNote: song.notes || ''
  })
}

// 📝 메모 저장
const saveNote = async () => {
  setSavingNote(true)
  try {
    const { error } = await supabase
      .from('team_setlist_songs')
      .update({ notes: noteModal.currentNote.trim() || null })
      .eq('id', noteModal.songId)

    if (error) throw error

    // 로컬 상태 업데이트
    setSongs(prev => prev.map(song => 
      song.id === noteModal.songId 
        ? { ...song, notes: noteModal.currentNote.trim() || null }
        : song
    ))

    setNoteModal({ show: false, songId: '', songName: '', currentNote: '' })
  } catch (error) {
    console.error('메모 저장 오류:', error)
    alert('메모 저장에 실패했습니다.')
  } finally {
    setSavingNote(false)
  }
}

  // 🎵 다음/이전 곡으로 이동 (콘티 내의 곡들만)
  const goToAdjacentSong = (direction: 'prev' | 'next') => {
    if (!currentSheetSong) return;

    const currentIndex = songs.findIndex(s => s.songs.id === currentSheetSong.id);
    let targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

    // 악보가 있는 곡 찾기
    while (targetIndex >= 0 && targetIndex < songs.length) {
      if (songs[targetIndex].songs.file_url) {
        setCurrentSheetSong(songs[targetIndex].songs);
        setCurrentPDFPage(1);
        setPdfDoc(null);
        console.log(`🎵 ${direction === 'prev' ? '이전' : '다음'} 곡으로 이동:`,
          songs[targetIndex].songs.song_name);
        break;
      }
      targetIndex = direction === 'prev' ? targetIndex - 1 : targetIndex + 1;
    }
  }

  // 🎵 악보보기 모드 키보드 단축키
  useEffect(() => {
    if (!showSheetViewer) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSheetViewer();
      } else if (e.key === 'ArrowLeft') {
        if (currentSheetSong?.file_type === 'pdf' && currentPDFPage > 1) {
          setCurrentPDFPage(p => p - 1);
        } else {
          goToAdjacentSong('prev');
        }
      } else if (e.key === 'ArrowRight') {
        if (currentSheetSong?.file_type === 'pdf' && currentPDFPage < totalPDFPages) {
          setCurrentPDFPage(p => p + 1);
        } else {
          goToAdjacentSong('next');
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [showSheetViewer, currentSheetSong, currentPDFPage, totalPDFPages, zoomLevel]);

  // 🎵 PDF 렌더링 useEffect
  useEffect(() => {
    if (!showSheetViewer || !currentSheetSong?.file_url || currentSheetSong.file_type !== 'pdf') return;

    const loadPDF = async () => {
      setIsLoadingPDF(true);
      try {
        // @ts-ignore
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
          console.error('PDF.js not loaded');
          return;
        }

        const loadingTask = pdfjsLib.getDocument(currentSheetSong.file_url);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPDFPages(pdf.numPages);
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setIsLoadingPDF(false);
      }
    };

    loadPDF();
  }, [showSheetViewer, currentSheetSong]);

  // 📄 PDF 페이지 렌더링 - 고화질 + 확대/축소 지원
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask: any = null;
    let isCancelled = false;

    const renderPage = async () => {
      console.log(`📄 페이지 ${currentPDFPage} 렌더링 시작 (zoom: ${zoomLevel * 100}%)`);

      try {
        const page = await pdfDoc.getPage(currentPDFPage);
        
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale: 1 });
        const baseScale = (window.innerHeight * 0.75) / viewport.height;
        const finalScale = baseScale * zoomLevel;
        const scaledViewport = page.getViewport({ scale: finalScale });

        const pixelRatio = window.devicePixelRatio || 1;
        
        canvas.width = scaledViewport.width * pixelRatio;
        canvas.height = scaledViewport.height * pixelRatio;
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.scale(pixelRatio, pixelRatio);

        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        
        console.log('✅ 페이지 렌더링 완료');
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException' || isCancelled) {
          console.log('⏹️ 렌더링 취소됨');
          return;
        }
        console.error('❌ 페이지 렌더링 실패:', error);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPDFPage, zoomLevel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!setlist) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push(`/my-team/${teamId}`)}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold border-b-2 border-blue-500 focus:outline-none"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">{setlist.title}</h1>
              )}
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  {/* 편집 모드: 저장/취소 버튼 */}
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center"
                  >
                    <Save className="mr-2" size={18} />
                    저장
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  {/* 다운로드 버튼 - 모든 팀원 가능 */}
                  <button
                    onClick={generatePPTFile}
                    disabled={downloadingPPT || songs.length === 0}
                    className="px-4 py-2 bg-[#C4BEE2] text-white rounded-lg hover:bg-[#A9A1D1] flex items-center disabled:opacity-50"
                    title="PPT 다운로드"
                  >
                    <Download className="mr-2" size={18} />
                    {downloadingPPT ? 'PPT 생성 중...' : 'PPT'}
                  </button>
                  
              
              {/* 🎵 플레이리스트 공유 버튼 추가 */}
              <button
                onClick={handleSharePlaylist}
                disabled={songs.length === 0}
                className="px-4 py-2 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] flex items-center disabled:opacity-50"
                title="유튜브 플레이리스트 공유"
              >
                <Youtube className="mr-2" size={18} />
                플레이리스트
              </button>
                  <button
                    onClick={handleDownload}
                    disabled={downloadingPDF || downloadingImage || songs.length === 0}
                    className="px-4 py-2 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] flex items-center disabled:opacity-50"
                    title="악보 다운로드"
                  >
                    <FileDown className="mr-2" size={18} />
                    {downloadingPDF || downloadingImage ? '다운로드 중...' : '악보 다운로드'}
                  </button>
                  
                  {/* 수정/삭제 버튼 - leader/admin만 */}
                  {canEdit() && (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center"
                      >
                        <Edit className="mr-2" size={18} />
                        수정
                      </button>
                      <button
                        onClick={handleDeleteSetlist}
                        className="px-4 py-2 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] flex items-center"
                      >
                        <Trash2 className="mr-2" size={18} />
                        삭제
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 콘티 정보 */}
          {isEditing ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">예배 날짜</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">예배 유형</label>
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-600">
              {new Date(setlist.service_date).toLocaleDateString('ko-KR')} • {setlist.service_type} • {songs.length}곡
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">곡 목록</h2>
            {canEdit() && (
              <button
                onClick={openAddSongModal}
                className="px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center"
              >
                <Plus className="mr-2" size={18} />
                곡 추가
              </button>
            )}
          </div>

          {songs.length === 0 ? (
            <div className="p-12 text-center">
              <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">아직 추가된 곡이 없습니다.</p>
              {canEdit() && (
                <button
                  onClick={openAddSongModal}
                  className="px-6 py-3 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8]"
                >
                  첫 곡 추가하기
                </button>
              )}
            </div>
          ) : (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={handleDragEnd}
  >
    <SortableContext
      items={songs.map(s => s.id)}
      strategy={verticalListSortingStrategy}
      disabled={!canEdit()}
    >
      <div className="divide-y">
        {songs.map((song, index) => (
  <SortableSongItem
    key={song.id}
    song={song}
    index={index}
    canEdit={canEdit()}
    onRemove={removeSongFromSetlist}
    onMoveUp={() => moveSong(index, 'up')}
    onMoveDown={() => moveSong(index, 'down')}
    onTogglePreview={togglePreview}
    onOpenSongForm={openSongFormModal}
    onOpenSheetViewer={openSheetViewerForSong}
    onOpenYoutubeModal={setYoutubeModalSong}
    onOpenNoteModal={openNoteModal}  // ✅ 추가
    isPreviewOpen={previewStates[song.id] || false}
    totalSongs={songs.length}
  />
))}
      </div>
    </SortableContext>
  </DndContext>
)}
        </div>
      </div>

      {/* 곡 추가 모달 */}
      {showAddSongModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">곡 추가</h2>
                <button
                  onClick={() => setShowAddSongModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                placeholder="곡 제목 또는 아티스트 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full mt-4 px-4 py-2 border rounded-lg"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {filteredAvailableSongs.length === 0 ? (
                <p className="text-center text-gray-600">검색 결과가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableSongs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => addSongToSetlist(song)}
                      className="w-full p-4 border rounded-lg hover:bg-blue-50 text-left"
                    >
                      <h3 className="font-semibold">{song.song_name}</h3>
                      <p className="text-sm text-gray-600">
                        {song.team_name} • Key: {song.key || '-'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 송폼 편집 모달 */}
{showSongFormModal && selectedSongForForm && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
      <h3 className="text-2xl font-bold mb-4">
        {selectedSongForForm.songs.song_name} - 송폼 편집
      </h3>

      <div className="grid grid-cols-2 gap-6">
        {/* 왼쪽: 사용 가능한 송폼 */}
        <div>
          <h4 className="font-bold mb-3 text-lg">송폼 추가</h4>
          <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
            {songFormOptions.map((form) => (
              <button
                key={form}
                onClick={() => addSongForm(form)}
                className="w-full px-4 py-3 rounded text-left bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium flex justify-between items-center"
              >
                <span>{form}</span>
              </button>
            ))}
          </div>

          {/* 커스텀 송폼 입력 */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-bold mb-2">커스텀 송폼</h5>
            <div className="flex gap-2">
              <input
                type="text"
                value={customFormInput}
                onChange={(e) => setCustomFormInput(e.target.value)}
                placeholder="예: Special, Transition"
                className="flex-1 px-3 py-2 border rounded"
                onKeyPress={(e) => e.key === 'Enter' && addCustomSongForm()}
              />
              <button
                onClick={addCustomSongForm}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 선택된 송폼 순서 */}
        <div className="flex flex-col h-[500px]">
          <h4 className="font-bold mb-3 text-lg">선택된 순서</h4>
          <div className="border-2 border-dashed rounded-lg p-4 flex-1 overflow-y-auto bg-gray-50">
            {tempSongForm.length === 0 ? (
              <p className="text-gray-400 text-center mt-20">
                왼쪽에서 송폼을 선택하세요
              </p>
            ) : (
              <div className="space-y-2">
                {tempSongForm.map((form, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-white border-2 border-green-200 px-3 py-3 rounded-lg"
                  >
                    <span className="font-bold text-green-900 flex-1 text-lg">
                      {index + 1}. {form}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveSongForm(index, 'up')}
                        disabled={index === 0}
                        className="px-2 py-1 bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSongForm(index, 'down')}
                        disabled={index === tempSongForm.length - 1}
                        className="px-2 py-1 bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeSongForm(index)}
                        className="px-2 py-1 bg-[#E26559] text-white rounded hover:bg-[#D14E42]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {tempSongForm.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm font-bold text-blue-900 mb-1">미리보기:</p>
              <p className="text-blue-800 font-mono">
                {tempSongForm.join(' - ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 버튼 */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => setShowSongFormModal(false)}
          className="px-6 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-medium"
        >
          취소
        </button>
        <button
          onClick={saveSongForm}
          className="px-6 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-bold"
        >
          저장
        </button>
      </div>
    </div>
  </div>
)}

      {/* 🆕 다운로드 형식 선택 모달 */}
{showFormatModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
      <h3 className="text-lg font-bold mb-4">다운로드 형식 선택</h3>
      <div className="space-y-3">
        <button
          onClick={() => startDownloadWithFormat('pdf')}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          📄 PDF로 다운로드
        </button>
        <button
          onClick={() => startDownloadWithFormat('image')}
          className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          🖼️ 이미지로 다운로드
        </button>
        <button
          onClick={() => setShowFormatModal(false)}
          className="w-full py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          취소
        </button>
      </div>
    </div>
  </div>
)}
      
      {/* 🆕 송폼 위치 선택 모달 */}
{showPositionModal && (
  <SongFormPositionModal
    songs={downloadSongs.filter(song => downloadSongForms[song.id]?.length > 0)}
    songForms={downloadSongForms}
    onConfirm={(positions: any, partTags: any) => (onPositionConfirm as any)(positions, partTags || {})}
    onCancel={onPositionCancel}
  />
)}
      
      {/* 🎵 유튜브 모달 */}
      {youtubeModalSong && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{youtubeModalSong.song_name}</h2>
                <p className="text-sm text-gray-600">
                  {youtubeModalSong.team_name} | Key: {youtubeModalSong.key || '-'}
                </p>
              </div>
              <button
                onClick={() => setYoutubeModalSong(null)}
                className="text-gray-500 hover:text-gray-700 p-2"
                title="닫기"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {getYoutubeEmbedUrl(youtubeModalSong.youtube_url || '') ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={getYoutubeEmbedUrl(youtubeModalSong.youtube_url || '') || ''}
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Youtube size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>유효하지 않은 유튜브 링크입니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📝 메모 수정 모달 */}
{noteModal.show && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg w-full max-w-2xl">
      <div className="p-4 border-b">
        <h3 className="text-lg font-bold text-gray-900">곡 메모</h3>
        <p className="text-sm text-gray-600">{noteModal.songName}</p>
      </div>
      
      <div className="p-4">
        <textarea
          value={noteModal.currentNote}
          onChange={(e) => setNoteModal(prev => ({ ...prev, currentNote: e.target.value }))}
          placeholder="이 곡에 대한 메모를 입력하세요...&#10;(예: 2절까지만, 키 반음 낮춤, 속도 조절 등)"
          className="w-full h-64 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
        <p className="text-xs text-gray-500 mt-2">
          💡 팀원들이 플레이리스트에서 이 메모를 볼 수 있습니다.
        </p>
      </div>
      
      <div className="p-4 border-t flex gap-2 justify-end">
        <button
          onClick={() => setNoteModal({ show: false, songId: '', songName: '', currentNote: '' })}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          취소
        </button>
        <button
          onClick={saveNote}
          disabled={savingNote}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {savingNote ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  </div>
)}
      
      {/* 🎵 악보보기 모드 (전체화면) - 확대/축소 기능 추가 */}
      {showSheetViewer && currentSheetSong && (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
          {/* 상단 바 */}
          <div className="bg-white text-gray-900 p-2 md:p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              <span className="text-sm md:text-lg font-bold truncate">
                {currentSheetSong.song_name}
              </span>
              {currentSheetSong.team_name && (
                <span className="hidden md:inline text-sm text-gray-600">
                  {currentSheetSong.team_name}
                </span>
              )}
              {currentSheetSong.key && (
                <span className="hidden md:inline text-sm text-gray-600">
                  Key: {currentSheetSong.key}
                </span>
              )}
            </div>

            {/* 🔍 확대/축소 컨트롤 */}
            <div className="flex items-center gap-1 md:gap-2 mr-2 md:mr-4">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
                className="p-1.5 md:p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="축소 (-)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              
              <button
                onClick={handleZoomReset}
                className="px-2 py-1 md:px-3 md:py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-xs md:text-sm font-medium min-w-[50px] md:min-w-[60px]"
                title="100%로 리셋 (0)"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
                className="p-1.5 md:p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="확대 (+)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={closeSheetViewer}
              className="px-2 py-1 md:px-4 md:py-2 bg-[#E26559] hover:bg-[#D14E42] text-white rounded-lg transition-colors flex items-center gap-1 md:gap-2 flex-shrink-0"
              title="닫기 (ESC)"
            >
              <X size={20} />
              <span className="font-medium text-sm md:text-base">닫기</span>
            </button>
          </div>

          {/* 악보 표시 영역 */}
          <div className="flex-1 overflow-auto bg-gray-200 p-2 md:p-4">
            <div className="min-h-full flex items-center justify-center">
              {!currentSheetSong.file_url ? (
                <div className="text-gray-500 text-center">
                  <Music size={80} className="mx-auto mb-4 opacity-30" />
                  <p className="text-2xl">악보가 없습니다</p>
                </div>
              ) : currentSheetSong.file_type === 'pdf' ? (
                <>
                  {isLoadingPDF ? (
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-gray-700">PDF 로딩 중...</p>
                    </div>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className="shadow-2xl bg-white"
                    />
                  )}

                  {/* PDF 페이지 네비게이션 버튼 */}
                  {!isLoadingPDF && totalPDFPages > 1 && (
                    <>
                      {currentPDFPage > 1 && (
                        <button
                          onClick={() => setCurrentPDFPage(p => p - 1)}
                          className="fixed left-2 md:left-8 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-700 p-2 md:p-4 rounded-full shadow-lg transition-all border border-gray-300 z-10"
                        >
                          <ChevronLeft size={32} />
                        </button>
                      )}

                      {currentPDFPage < totalPDFPages && (
                        <button
                          onClick={() => setCurrentPDFPage(p => p + 1)}
                          className="fixed right-2 md:right-8 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-700 p-2 md:p-4 rounded-full shadow-lg transition-all border border-gray-300 z-10"
                        >
                          <ChevronRight size={32} />
                        </button>
                      )}
                    </>
                  )}

                  {/* 페이지 번호 표시 */}
                  {!isLoadingPDF && totalPDFPages > 0 && (
                    <div className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 bg-white text-gray-700 px-3 py-1 md:px-4 md:py-2 rounded-full shadow-lg border border-gray-300 text-sm md:text-base z-10">
                      페이지 {currentPDFPage} / {totalPDFPages}
                    </div>
                  )}
                </>
              ) : (
                /* 🖼️ 이미지 표시 - 확대/축소 적용 */
                <img
                  src={currentSheetSong.file_url}
                  alt={currentSheetSong.song_name}
                  className="shadow-2xl bg-white transition-transform duration-200"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    maxWidth: zoomLevel <= 1 ? '95%' : 'none',
                    maxHeight: zoomLevel <= 1 ? '85vh' : 'none',
                  }}
                  draggable={false}
                />
              )}
            </div>
          </div>

          {/* 하단 정보 바 */}
          <div className="bg-white text-gray-900 p-2 md:p-4 flex flex-col md:flex-row justify-between items-center border-t border-gray-300 shadow-md gap-2 md:gap-0">
            {/* BPM, 박자 정보 */}
            <div className="hidden md:flex gap-4 text-sm">
              {currentSheetSong.bpm && (
                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded">
                  BPM: {currentSheetSong.bpm}
                </span>
              )}
              {currentSheetSong.time_signature && (
                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded">
                  박자: {currentSheetSong.time_signature}
                </span>
              )}
            </div>

            {/* 곡 네비게이션 */}
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => goToAdjacentSong('prev')}
                className="px-2 py-1 md:px-4 md:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium flex items-center gap-1 text-sm md:text-base"
              >
                <ChevronLeft size={20} />
                <span className="hidden md:inline">이전 곡</span>
              </button>

              {/* 현재 위치 */}
              <span className="px-3 py-1 md:px-4 md:py-2 bg-[#C5D7F2] text-white rounded-lg font-bold text-sm md:text-base">
                {songs.findIndex(s => s.songs.id === currentSheetSong?.id) + 1} / {songs.filter(s => s.songs.file_url).length}
              </span>

              <button
                onClick={() => goToAdjacentSong('next')}
                className="px-2 py-1 md:px-4 md:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium flex items-center gap-1 text-sm md:text-base"
              >
                <span className="hidden md:inline">다음 곡</span>
                <ChevronRight size={20} />
              </button>
            </div>

            {/* 모바일용 줌 힌트 */}
            <div className="md:hidden text-xs text-gray-500">
              + / - 키로 확대/축소
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 프린트용 스타일 (전역)
if (typeof window !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @media print {
      /* 네비게이션, 버튼 숨기기 */
      header, nav, button, .no-print {
        display: none !important;
      }
      
      /* 페이지 여백 */
      @page {
        margin: 2cm;
      }
      
      /* 콘티 제목 페이지 */
      .print-cover {
        page-break-after: always;
        text-align: center;
        padding-top: 30%;
      }
      
      /* 각 곡마다 페이지 나누기 */
      .print-song {
        page-break-after: always;
        padding: 20px 0;
      }
      
      .print-song:last-child {
        page-break-after: auto;
      }
      
      /* 악보 이미지 */
      .print-song img {
        max-w-full;
        height: auto;
        margin: 20px 0;
      }
      
      /* 배경색 프린트 */
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `
  if (!document.getElementById('print-styles')) {
    style.id = 'print-styles'
    document.head.appendChild(style)
  }
}