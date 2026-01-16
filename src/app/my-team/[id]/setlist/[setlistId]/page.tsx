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
import { useSheetMusicNotes, LocalSheetMusicNote } from '@/hooks/useSheetMusicNotes'
import { usePersonalSetlistView } from '@/hooks/usePersonalSetlistView'
import SheetMusicEditor, { EditorSong } from '@/components/SheetMusicEditor'
import DownloadLoadingModal from '@/components/DownloadLoadingModal'
import ImagePreviewModal from '@/components/ImagePreviewModal'

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
  // 개인화 관련 props
  personalNote?: LocalSheetMusicNote  // 이 곡에 적용된 개인 필기 노트
  userNotes?: LocalSheetMusicNote[]   // 이 곡에 대한 사용자의 모든 필기 노트
  onSelectPersonalNote?: (songId: string, noteId: string | null) => void
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
  personalNote,
  userNotes,
  onSelectPersonalNote,
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
      {/* 데스크톱: 가로 배치 / 모바일: 세로 배치 */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between">
        {/* 메인 정보 영역 */}
        <div className="flex-1">
          {/* 첫 줄: 드래그 핸들 + 번호 + 제목 */}
          <div className="flex items-start gap-2">
            {/* 드래그 핸들 */}
            {canEdit && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing pt-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                title="드래그하여 순서 변경"
              >
                <GripVertical size={20} />
              </div>
            )}
            <span className="text-lg font-bold text-blue-600 w-8 mt-1 flex-shrink-0">
              {index + 1}.
            </span>
            {/* 데스크톱: 제목+정보 같은 줄, 모바일: 제목만 */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-xl">
                {song.songs.song_name}
              </h3>
              {/* 데스크톱에서만 제목 옆에 표시 */}
              <div className="hidden md:block">
                <p className="text-sm text-gray-600 mb-2">
                  {song.songs.team_name} • Key: {song.key_transposed || song.songs.key || '-'}
                </p>
                {song.selected_form && song.selected_form.length > 0 && (
                  <p className="text-sm text-purple-600 mb-2">
                    송폼: {song.selected_form.join(' - ')}
                  </p>
                )}
                {/* 내 버전 선택 UI - 데스크톱 */}
                {userNotes && userNotes.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">내 버전:</span>
                      <select
                        value={personalNote?.id || ''}
                        onChange={(e) => {
                          const noteId = e.target.value || null
                          onSelectPersonalNote?.(song.songs.id, noteId)
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                      >
                        <option value="">원본 사용</option>
                        {userNotes.map(note => (
                          <option key={note.id} value={note.id}>
                            {note.title || note.song_name} ({new Date(note.updated_at).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    {personalNote && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ 내 필기 노트 적용됨
                      </p>
                    )}
                  </div>
                )}
                {/* 메모 - 데스크톱 */}
                {song.notes ? (
                  <div className="mb-2">
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm text-yellow-800 flex-1">
                          <span className="font-medium">📝 메모:</span>
                          <pre className="whitespace-pre-wrap font-sans mt-1">
                            {song.notes.length > 100 && !isNoteExpanded
                              ? `${song.notes.slice(0, 100)}...`
                              : song.notes
                            }
                          </pre>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => onOpenNoteModal(song)}
                            className="text-xs text-yellow-700 hover:text-yellow-900 font-medium whitespace-nowrap px-2 py-1 hover:bg-yellow-100 rounded"
                          >
                            수정
                          </button>
                        )}
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
          </div>

          {/* 모바일: 전체 너비 사용하는 정보 영역 (약간의 왼쪽 여백) */}
          <div className="md:hidden mt-2 pl-4">
            <p className="text-sm text-gray-600 mb-2">
              {song.songs.team_name} • Key: {song.key_transposed || song.songs.key || '-'}
            </p>
            {song.selected_form && song.selected_form.length > 0 && (
              <p className="text-sm text-purple-600 mb-2">
                송폼: {song.selected_form.join(' - ')}
              </p>
            )}
            {/* 내 버전 선택 UI - 모바일 */}
            {userNotes && userNotes.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">내 버전:</span>
                  <select
                    value={personalNote?.id || ''}
                    onChange={(e) => {
                      const noteId = e.target.value || null
                      onSelectPersonalNote?.(song.songs.id, noteId)
                    }}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-base"
                  >
                    <option value="">원본 사용</option>
                    {userNotes.map(note => (
                      <option key={note.id} value={note.id}>
                        {note.title || note.song_name} ({new Date(note.updated_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                {personalNote && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ 내 필기 노트 적용됨
                  </p>
                )}
              </div>
            )}
            {/* 메모 - 모바일 (전체 너비) */}
            {song.notes ? (
              <div className="mb-2">
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-yellow-800 flex-1">
                      <span className="font-medium">📝 메모:</span>
                      <pre className="whitespace-pre-wrap font-sans mt-1">
                        {song.notes.length > 100 && !isNoteExpanded
                          ? `${song.notes.slice(0, 100)}...`
                          : song.notes
                        }
                      </pre>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => onOpenNoteModal(song)}
                        className="text-xs text-yellow-700 hover:text-yellow-900 font-medium whitespace-nowrap px-2 py-1 hover:bg-yellow-100 rounded"
                      >
                        수정
                      </button>
                    )}
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

        {/* 버튼들 - 모바일: 아래로 가운데 정렬, 데스크톱: 오른쪽 */}
        <div className="flex gap-2 no-print mt-4 md:mt-0 md:ml-4 flex-shrink-0 flex-wrap justify-center md:justify-end">
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
          {/* 악보 에디터 버튼 */}
          {song.songs.file_url && (
            <button
              onClick={() => onOpenSheetViewer(song)}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
              title="악보 에디터"
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
              {/* 순서 변경 화살표 - 데스크톱에서만 표시 (모바일은 드래그로 변경) */}
              <button
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
                className="hidden md:block p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                <ChevronUp size={18} />
              </button>
              <button
                onClick={() => onMoveDown(index)}
                disabled={index === totalSongs - 1}
                className="hidden md:block p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
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

  // PPT 다운로드 상태 (자체 PPT 생성 함수용)
  const [downloadingPPT, setDownloadingPPT] = useState(false)

  // 🎵 SheetMusicEditor 상태 (다중 곡 악보 에디터)
  const [showSheetMusicEditor, setShowSheetMusicEditor] = useState(false)
  const [sheetEditorSongs, setSheetEditorSongs] = useState<{
    song_id: string
    song_name: string
    team_name?: string
    file_url: string
    file_type: 'pdf' | 'image'
    selected_form?: string[]
  }[]>([])
  const [startingSongIndex, setStartingSongIndex] = useState(0)

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

// 🆕 끼워넣기 모달 상태
const [insertModal, setInsertModal] = useState<{
  show: boolean
  afterOrder: number
}>({
  show: false,
  afterOrder: 0
})
const [insertSearchQuery, setInsertSearchQuery] = useState('')

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
  downloadProgress,  // 진행률 상태 추가
  // 모바일 미리보기 상태
  previewImages,
  showPreview,
  setShowPreview,
  handlePreviewSave,
  handlePreviewShare,
  handlePreviewSaveAll,
  setShowFormatModal,
  setShowPositionModal,
  handleDownload,
  onPositionConfirm,
  onPositionCancel,
  startDownloadWithFormat,
  DownloadFormatModal,  // ✅ 추가
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

// 개인화 훅
const { notes: userSheetNotes, fetchNotes: fetchUserNotes, saveNote: saveSheetNote } = useSheetMusicNotes()
const {
  personalView,
  fetchPersonalView,
  replaceSongWithNote,
  insertNoteAfter,
  removeCustomization
} = usePersonalSetlistView()

// 각 곡에 대한 사용자 노트 맵
const [songNotesMap, setSongNotesMap] = useState<{ [songId: string]: LocalSheetMusicNote[] }>({})

// 개인화된 곡 선택 핸들러
const handleSelectPersonalNote = async (songId: string, noteId: string | null) => {
  if (!user?.id || !setlistId) return

  if (noteId) {
    // 내 버전 선택
    await replaceSongWithNote(user.id, setlistId, songId, noteId)
  } else {
    // 원본 선택 - 해당 곡의 커스터마이징 제거
    // 현재 해당 곡에 적용된 노트 ID 찾기
    const existingCustomization = personalView?.customizations.find(
      c => c.type === 'replace' && c.originalSongId === songId
    )
    if (existingCustomization) {
      await removeCustomization(user.id, setlistId, existingCustomization.noteId)
    }
  }
  // 개인 뷰 다시 로드
  await fetchPersonalView(user.id, setlistId)
}

// 🆕 끼워넣기 핸들러
const handleInsertNote = async (noteId: string) => {
  if (!user?.id || !setlistId) return

  await insertNoteAfter(user.id, setlistId, insertModal.afterOrder, noteId)
  setInsertModal({ show: false, afterOrder: 0 })
  setInsertSearchQuery('')
  // 개인 뷰 다시 로드
  await fetchPersonalView(user.id, setlistId)
}

// 🆕 끼워넣은 노트 제거 핸들러
const handleRemoveInsertedNote = async (noteId: string) => {
  if (!user?.id || !setlistId) return

  await removeCustomization(user.id, setlistId, noteId)
  await fetchPersonalView(user.id, setlistId)
}

// 🆕 끼워넣은 노트 목록 계산
const getInsertedNotesAfter = (orderNumber: number) => {
  if (!personalView?.customizations) return []

  return personalView.customizations
    .filter(c => c.type === 'insert' && c.afterOrder === orderNumber)
    .map(c => {
      const note = userSheetNotes.find(n => n.id === c.noteId)
      return note ? { ...note, customization: c } : null
    })
    .filter(Boolean) as (LocalSheetMusicNote & { customization: { noteId: string } })[]
}

// 🆕 끼워넣기 모달에서 노트 필터링
const filteredInsertNotes = insertSearchQuery.trim()
  ? userSheetNotes.filter(note =>
      note.song_name.toLowerCase().includes(insertSearchQuery.toLowerCase()) ||
      note.title.toLowerCase().includes(insertSearchQuery.toLowerCase()) ||
      (note.team_name && note.team_name.toLowerCase().includes(insertSearchQuery.toLowerCase()))
    )
  : userSheetNotes

useEffect(() => {
  checkUser()
}, [])

  useEffect(() => {
    if (user && teamId && setlistId) {
      fetchSetlistDetail()
      // 개인 뷰와 필기 노트 로드
      fetchPersonalView(user.id, setlistId)
      fetchUserNotes(user.id)
    }
  }, [user, teamId, setlistId])

  // 곡 목록이 로드되면 각 곡에 대한 필기 노트 맵 생성
  useEffect(() => {
    if (songs.length > 0 && userSheetNotes.length > 0) {
      const map: { [songId: string]: LocalSheetMusicNote[] } = {}
      songs.forEach(song => {
        const songId = song.songs.id
        map[songId] = userSheetNotes.filter(note => note.song_id === songId)
      })
      setSongNotesMap(map)
    }
  }, [songs, userSheetNotes])

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

  

  // 🎵 악보 에디터 열기 (SheetMusicEditor 사용)
  const openSheetViewerForSong = (setlistSong: SetlistSong) => {
    console.log('🎵 악보보기 모드 열기:', setlistSong.songs.song_name)

    // 악보가 있는 곡만 필터링하고, 개인화된 노트가 있으면 적용
    const songsWithSheets = songs
      .filter(s => s.songs.file_url)
      .map(s => {
        // 개인화된 노트 확인
        const customization = personalView?.customizations.find(
          c => c.type === 'replace' && c.originalSongId === s.songs.id
        )
        const personalNote = customization
          ? userSheetNotes.find(n => n.id === customization.noteId)
          : undefined

        if (personalNote) {
          // 개인 노트로 대체
          return {
            song_id: personalNote.song_id,
            song_name: personalNote.song_name,
            team_name: personalNote.team_name,
            file_url: personalNote.file_url,
            file_type: (personalNote.file_type || 'image') as 'pdf' | 'image',
            selected_form: s.selected_form,
            annotations: personalNote.annotations,
            songForms: personalNote.songForms,
            songFormEnabled: personalNote.songFormEnabled,
            songFormStyle: personalNote.songFormStyle,
            partTags: personalNote.partTags,
            pianoScores: personalNote.pianoScores,
          }
        }

        // 원본 사용
        return {
          song_id: s.songs.id,
          song_name: s.songs.song_name,
          team_name: s.songs.team_name,
          file_url: s.songs.file_url!,
          file_type: (s.songs.file_type || 'image') as 'pdf' | 'image',
          selected_form: s.selected_form,
        }
      })

    // 클릭한 곡의 인덱스 찾기
    const clickedIndex = songsWithSheets.findIndex(
      s => s.song_id === setlistSong.songs.id ||
           (personalView?.customizations.find(c => c.originalSongId === setlistSong.songs.id)?.noteId &&
            userSheetNotes.find(n => n.id === personalView?.customizations.find(c => c.originalSongId === setlistSong.songs.id)?.noteId)?.song_id === s.song_id)
    )

    setSheetEditorSongs(songsWithSheets)
    setStartingSongIndex(clickedIndex >= 0 ? clickedIndex : 0)
    setShowSheetMusicEditor(true)
  }

  // 🎵 악보 에디터 닫기
  const closeSheetMusicEditor = () => {
    if (sheetEditorSongs.length > 0) {
      if (!confirm('필기 내용이 저장되지 않을 수 있습니다. 정말 닫으시겠습니까?')) {
        return
      }
    }
    setShowSheetMusicEditor(false)
    setSheetEditorSongs([])
  }

  // 📝 악보 에디터에서 저장 핸들러 (다중 곡 모드)
  const handleSaveSheetNotes = async (dataList: Array<{
    song: EditorSong
    annotations: any[]
    extra?: {
      songFormEnabled: boolean
      songFormStyle: any
      partTags: any[]
      pianoScores?: any[]
      drumScores?: any[]
    }
  }>) => {
    if (!user?.id) return

    for (const data of dataList) {
      await saveSheetNote({
        user_id: user.id,
        song_id: data.song.song_id,
        song_name: data.song.song_name,
        team_name: data.song.team_name,
        file_url: data.song.file_url,
        file_type: data.song.file_type,
        title: data.song.song_name,
        annotations: data.annotations,
        songForms: data.song.songForms,
        songFormEnabled: data.extra?.songFormEnabled,
        songFormStyle: data.extra?.songFormStyle,
        partTags: data.extra?.partTags,
        pianoScores: data.extra?.pianoScores,
        drumScores: data.extra?.drumScores,
      })
    }

    alert('필기 노트가 저장되었습니다!')
    // 필기 노트 다시 로드
    fetchUserNotes(user.id)
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
          {/* 상단: 제목 + 뒤로가기 */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => router.push(`/my-team/${teamId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-xl md:text-2xl font-bold border-b-2 border-blue-500 focus:outline-none flex-1 min-w-0"
              />
            ) : (
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{setlist.title}</h1>
            )}
          </div>

          {/* 콘티 정보 (날짜, 유형, 곡수) */}
          {!isEditing && (
            <div className="text-sm text-gray-600 mb-3">
              {new Date(setlist.service_date).toLocaleDateString('ko-KR')} • {setlist.service_type} • {songs.length}곡
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <>
                {/* 편집 모드: 저장/취소 버튼 */}
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center text-sm"
                >
                  <Save size={16} />
                  <span className="ml-1.5">저장</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                {/* PPT 다운로드 */}
                <button
                  onClick={generatePPTFile}
                  disabled={downloadingPPT || songs.length === 0}
                  className="px-3 py-2 bg-[#C4BEE2] text-white rounded-lg hover:bg-[#A9A1D1] flex items-center disabled:opacity-50 text-sm whitespace-nowrap"
                  title="PPT 다운로드"
                >
                  <Download size={16} />
                  <span className="ml-1.5 hidden sm:inline">{downloadingPPT ? '생성중...' : 'PPT'}</span>
                </button>

                {/* 플레이리스트 공유 */}
                <button
                  onClick={handleSharePlaylist}
                  disabled={songs.length === 0}
                  className="px-3 py-2 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] flex items-center disabled:opacity-50 text-sm whitespace-nowrap"
                  title="유튜브 플레이리스트 공유"
                >
                  <Youtube size={16} />
                  <span className="ml-1.5 hidden sm:inline">플레이리스트</span>
                </button>

                {/* 악보 다운로드 */}
                <button
                  onClick={handleDownload}
                  disabled={downloadingPDF || downloadingImage || songs.length === 0}
                  className="px-3 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center disabled:opacity-50 text-sm whitespace-nowrap"
                  title="악보 다운로드"
                >
                  <FileDown size={16} />
                  <span className="ml-1.5 hidden sm:inline">{downloadingPDF || downloadingImage ? '다운로드중...' : '악보 다운로드'}</span>
                </button>

                {/* 수정/삭제 버튼 - leader/admin만 */}
                {canEdit() && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] flex items-center text-sm whitespace-nowrap"
                    >
                      <Edit size={16} />
                      <span className="ml-1.5 hidden sm:inline">수정</span>
                    </button>
                    <button
                      onClick={handleDeleteSetlist}
                      className="px-3 py-2 bg-[#E26559] text-white rounded-lg hover:bg-[#D14E42] flex items-center text-sm whitespace-nowrap"
                    >
                      <Trash2 size={16} />
                      <span className="ml-1.5 hidden sm:inline">삭제</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* 편집 모드: 날짜/유형 수정 */}
          {isEditing && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        {songs.map((song, index) => {
          const insertedNotes = getInsertedNotesAfter(song.order_number)

          return (
            <div key={song.id}>
              <SortableSongItem
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
                onOpenNoteModal={openNoteModal}
                isPreviewOpen={previewStates[song.id] || false}
                totalSongs={songs.length}
                userNotes={songNotesMap[song.songs.id] || []}
                personalNote={
                  personalView?.customizations.find(
                    c => c.type === 'replace' && c.originalSongId === song.songs.id
                  )?.noteId
                    ? userSheetNotes.find(n => n.id === personalView?.customizations.find(
                        c => c.type === 'replace' && c.originalSongId === song.songs.id
                      )?.noteId)
                    : undefined
                }
                onSelectPersonalNote={handleSelectPersonalNote}
              />

              {/* 🆕 끼워넣은 노트 표시 */}
              {insertedNotes.map((note) => (
                <div
                  key={`inserted-${note.id}`}
                  className="p-4 bg-amber-50 border-l-4 border-amber-400"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📝</span>
                      <div>
                        <h4 className="font-semibold text-amber-900">
                          {note.title || note.song_name}
                        </h4>
                        <p className="text-sm text-amber-700">
                          나만 보임 · {new Date(note.updated_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveInsertedNote(note.customization.noteId)}
                      className="px-3 py-1 text-sm text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded"
                    >
                      제거
                    </button>
                  </div>
                </div>
              ))}

              {/* 🆕 끼워넣기 버튼 (hover 시 표시) */}
              {userSheetNotes.length > 0 && (
                <div className="group relative h-0">
                  <div className="absolute left-0 right-0 top-0 -translate-y-1/2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={() => setInsertModal({ show: true, afterOrder: song.order_number })}
                      className="px-4 py-1 text-sm bg-amber-100 text-amber-700 rounded-full border border-amber-300 hover:bg-amber-200 shadow-sm"
                    >
                      + 끼워넣기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] overflow-y-auto p-4 md:p-6">
      <h3 className="text-lg md:text-2xl font-bold mb-4">
        {selectedSongForForm.songs.song_name} - 송폼 편집
      </h3>

      {/* 모바일: 선택된 순서 먼저 표시 */}
      <div className="md:hidden mb-4">
        {tempSongForm.length > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-bold text-blue-900 mb-1">현재 송폼:</p>
            <p className="text-blue-800 text-sm">
              {tempSongForm.join(' - ')}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* 송폼 추가 */}
        <div>
          <h4 className="font-bold mb-3 text-base md:text-lg">송폼 추가</h4>
          {/* 모바일: 그리드, 데스크톱: 리스트 */}
          <div className="grid grid-cols-4 gap-2 md:grid-cols-1 md:space-y-2 md:gap-0 mb-4 max-h-[200px] md:max-h-[400px] overflow-y-auto">
            {songFormOptions.map((form) => (
              <button
                key={form}
                onClick={() => addSongForm(form)}
                className="px-2 py-2 md:px-4 md:py-3 rounded text-center md:text-left bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium text-sm md:text-base"
              >
                {form}
              </button>
            ))}
          </div>

          {/* 커스텀 송폼 입력 */}
          <div className="p-3 md:p-4 bg-gray-50 rounded-lg">
            <h5 className="font-bold mb-2 text-sm md:text-base">커스텀 송폼</h5>
            <div className="flex gap-2">
              <input
                type="text"
                value={customFormInput}
                onChange={(e) => setCustomFormInput(e.target.value)}
                placeholder="예: Special"
                className="flex-1 px-3 py-2 border rounded text-base"
                onKeyPress={(e) => e.key === 'Enter' && addCustomSongForm()}
              />
              <button
                onClick={addCustomSongForm}
                className="px-3 md:px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm md:text-base"
              >
                추가
              </button>
            </div>
          </div>
        </div>

        {/* 선택된 송폼 순서 */}
        <div className="flex flex-col h-[250px] md:h-[500px]">
          <h4 className="font-bold mb-3 text-base md:text-lg">선택된 순서</h4>
          <div className="border-2 border-dashed rounded-lg p-3 md:p-4 flex-1 overflow-y-auto bg-gray-50">
            {tempSongForm.length === 0 ? (
              <p className="text-gray-400 text-center mt-8 md:mt-20 text-sm md:text-base">
                위에서 송폼을 선택하세요
              </p>
            ) : (
              <div className="space-y-2">
                {tempSongForm.map((form, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-white border-2 border-green-200 px-2 md:px-3 py-2 md:py-3 rounded-lg"
                  >
                    <span className="font-bold text-green-900 flex-1 text-base md:text-lg">
                      {index + 1}. {form}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveSongForm(index, 'up')}
                        disabled={index === 0}
                        className="w-8 h-8 flex items-center justify-center bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSongForm(index, 'down')}
                        disabled={index === tempSongForm.length - 1}
                        className="w-8 h-8 flex items-center justify-center bg-[#84B9C0] text-white rounded hover:bg-[#6FA5AC] disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeSongForm(index)}
                        className="w-8 h-8 flex items-center justify-center bg-[#E26559] text-white rounded hover:bg-[#D14E42] text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 데스크톱에서만 미리보기 표시 */}
          {tempSongForm.length > 0 && (
            <div className="hidden md:block mt-3 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm font-bold text-blue-900 mb-1">미리보기:</p>
              <p className="text-blue-800 font-mono">
                {tempSongForm.join(' - ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 버튼 */}
      <div className="mt-4 md:mt-6 flex justify-end gap-3">
        <button
          onClick={() => setShowSongFormModal(false)}
          className="px-4 md:px-6 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 font-medium text-sm md:text-base"
        >
          취소
        </button>
        <button
          onClick={saveSongForm}
          className="px-4 md:px-6 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] font-bold text-sm md:text-base"
        >
          저장
        </button>
      </div>
    </div>
  </div>
)}

      {/* 🔄 다운로드 형식 선택 모달 - 공통 컴포넌트 */}
<DownloadFormatModal />
      
      {/* 📍 송폼 위치 선택 모달 */}
{showPositionModal && (
  <SongFormPositionModal
    songs={downloadSongs.filter(song => downloadSongForms[song.id]?.length > 0)}
    songForms={downloadSongForms}
    onConfirm={onPositionConfirm}
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

      {/* 🆕 끼워넣기 노트 선택 모달 */}
      {insertModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">끼워넣을 노트 선택</h3>
              <button
                onClick={() => {
                  setInsertModal({ show: false, afterOrder: 0 })
                  setInsertSearchQuery('')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b">
              <input
                type="text"
                value={insertSearchQuery}
                onChange={(e) => setInsertSearchQuery(e.target.value)}
                placeholder="노트 검색..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredInsertNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {userSheetNotes.length === 0
                    ? '아직 저장된 필기 노트가 없습니다.'
                    : '검색 결과가 없습니다.'
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredInsertNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => handleInsertNote(note.id)}
                      className="w-full p-4 border rounded-lg hover:bg-amber-50 hover:border-amber-300 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📝</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {note.title || note.song_name}
                          </h4>
                          <p className="text-sm text-gray-500 truncate">
                            {note.team_name || '빈 노트'} · 수정: {new Date(note.updated_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <span className="text-amber-600 text-sm font-medium">선택</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🎵 SheetMusicEditor - 다중 곡 악보 에디터 */}
      {showSheetMusicEditor && sheetEditorSongs.length > 0 && (
        <SheetMusicEditor
          fileUrl=""
          fileType="image"
          songName=""
          songs={sheetEditorSongs}
          initialSongIndex={startingSongIndex}
          setlistTitle={setlist?.title}
          onClose={closeSheetMusicEditor}
          onSaveAll={handleSaveSheetNotes}
        />
      )}

      {/* 다운로드 로딩 모달 */}
      <DownloadLoadingModal
        isOpen={downloadingPDF || downloadingPPT || downloadingImage}
        type={downloadingPDF ? 'pdf' : downloadingImage ? 'image' : 'ppt'}
        progress={downloadProgress || undefined}
      />

      {/* 모바일 이미지 미리보기 모달 */}
      {showPreview && previewImages.length > 0 && (
        <ImagePreviewModal
          images={previewImages}
          onClose={() => setShowPreview(false)}
          onSave={handlePreviewSave}
          onSaveAll={handlePreviewSaveAll}
        />
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