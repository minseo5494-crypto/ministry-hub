'use client'

import { useRef } from 'react'
import { X, Plus, Upload } from 'lucide-react'
import { SEASONS, TIME_SIGNATURES, KEYS, TEMPOS } from '@/lib/constants'
import { getBPMRangeFromTempo } from '@/lib/musicUtils'
import { Song, ThemeCount, UserTeam, NewSongForm } from '../types'

type AddSongModalProps = {
  isOpen: boolean
  newSong: NewSongForm
  setNewSong: (song: NewSongForm) => void
  userTeams: UserTeam[]
  themeCounts: ThemeCount[]
  uploadingFile: File | null
  setUploadingFile: (file: File | null) => void
  uploading: boolean
  duplicateSongs: Song[]
  checkingDuplicate: boolean
  teamNameSuggestions: string[]
  showTeamSuggestions: boolean
  setShowTeamSuggestions: (show: boolean) => void
  onSongNameChange: (value: string) => void
  onTeamNameChange: (value: string) => void
  onBPMChange: (value: string) => void
  onTempoChange: (value: string) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
  onClose: () => void
}

export default function AddSongModal({
  isOpen,
  newSong,
  setNewSong,
  userTeams,
  themeCounts,
  uploadingFile,
  setUploadingFile,
  uploading,
  duplicateSongs,
  checkingDuplicate,
  teamNameSuggestions,
  showTeamSuggestions,
  setShowTeamSuggestions,
  onSongNameChange,
  onTeamNameChange,
  onBPMChange,
  onTempoChange,
  onFileSelect,
  onSubmit,
  onClose
}: AddSongModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-2xl p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">새 곡 추가</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* 곡 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              곡 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newSong.song_name}
              onChange={(e) => onSongNameChange(e.target.value)}
              placeholder="예: 주의 이름 높이며"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${duplicateSongs.length > 0 ? 'border-orange-400 bg-orange-50' : 'border-gray-300'}`}
            />
            {checkingDuplicate && (
              <p className="mt-1 text-sm text-gray-500">중복 확인 중...</p>
            )}
            {!checkingDuplicate && duplicateSongs.length > 0 && (
              <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-800 mb-1">
                  ⚠️ 비슷한 곡이 {duplicateSongs.length}개 있습니다:
                </p>
                <ul className="text-sm text-orange-700 space-y-1">
                  {duplicateSongs.slice(0, 5).map((song, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span>• {song.song_name}</span>
                      {song.team_name && <span className="text-orange-600">- {song.team_name}</span>}
                    </li>
                  ))}
                  {duplicateSongs.length > 5 && (
                    <li className="text-orange-600">...외 {duplicateSongs.length - 5}곡</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* 팀명 */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">팀명 / 아티스트</label>
            <input
              type="text"
              value={newSong.team_name}
              onChange={(e) => onTeamNameChange(e.target.value)}
              onFocus={() => { if (teamNameSuggestions.length > 0) setShowTeamSuggestions(true) }}
              onBlur={() => { setTimeout(() => setShowTeamSuggestions(false), 200) }}
              placeholder="예: 위러브(Welove)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              autoComplete="off"
            />
            {showTeamSuggestions && teamNameSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {teamNameSuggestions.map((team, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setNewSong({ ...newSong, team_name: team })
                      setShowTeamSuggestions(false)
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 text-gray-900 text-sm"
                  >
                    {team}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 공유 범위 선택 */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              공유 범위 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition ${newSong.visibility === 'public' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={newSong.visibility === 'public'}
                  onChange={() => setNewSong({ ...newSong, visibility: 'public', shared_with_teams: [] })}
                  className="mr-3 accent-blue-500"
                />
                <div>
                  <div className={`font-medium ${newSong.visibility === 'public' ? 'text-blue-700' : 'text-gray-900'}`}>전체 공개</div>
                  <div className="text-sm text-gray-500">모든 사용자가 이 곡을 볼 수 있습니다</div>
                </div>
              </label>

              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition ${newSong.visibility === 'teams' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="visibility"
                  value="teams"
                  checked={newSong.visibility === 'teams'}
                  onChange={() => setNewSong({ ...newSong, visibility: 'teams' })}
                  className="mr-3 accent-violet-500"
                />
                <div>
                  <div className={`font-medium ${newSong.visibility === 'teams' ? 'text-violet-700' : 'text-gray-900'}`}>팀 공개</div>
                  <div className="text-sm text-gray-500">선택한 팀만 이 곡을 볼 수 있습니다</div>
                </div>
              </label>

              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition ${newSong.visibility === 'private' ? 'border-gray-500 bg-gray-100' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={newSong.visibility === 'private'}
                  onChange={() => setNewSong({ ...newSong, visibility: 'private', shared_with_teams: [] })}
                  className="mr-3 accent-gray-500"
                />
                <div>
                  <div className={`font-medium ${newSong.visibility === 'private' ? 'text-gray-700' : 'text-gray-900'}`}>비공개</div>
                  <div className="text-sm text-gray-500">나만 이 곡을 볼 수 있습니다</div>
                </div>
              </label>
            </div>

            {/* 팀 선택 */}
            {newSong.visibility === 'teams' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  공유할 팀 선택 <span className="text-red-500">*</span>
                </label>
                {userTeams.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                    {userTeams.map(team => {
                      const isSelected = newSong.shared_with_teams.includes(team.id)
                      return (
                        <label
                          key={team.id}
                          className={`flex items-center p-2 rounded cursor-pointer transition ${isSelected ? 'bg-violet-100 border border-violet-300' : 'hover:bg-gray-50 border border-transparent'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewSong({ ...newSong, shared_with_teams: [...newSong.shared_with_teams, team.id] })
                              } else {
                                setNewSong({ ...newSong, shared_with_teams: newSong.shared_with_teams.filter(id => id !== team.id) })
                              }
                            }}
                            className="mr-2 accent-violet-500"
                          />
                          <span className={isSelected ? 'text-violet-700 font-medium' : 'text-gray-700'}>{team.name}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">소속된 팀이 없습니다.</p>
                )}
              </div>
            )}
          </div>

          {/* Key, 박자, 템포, BPM */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setNewSong({ ...newSong, key: newSong.key.replace('m', '') })}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${!newSong.key.includes('m') ? 'bg-[#C5D7F2] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Major
                </button>
                <button
                  type="button"
                  onClick={() => { if (!newSong.key.includes('m') && newSong.key) setNewSong({ ...newSong, key: newSong.key + 'm' }) }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${newSong.key.includes('m') ? 'bg-[#C4BEE2] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Minor
                </button>
              </div>
              <select
                value={newSong.key.replace('m', '')}
                onChange={(e) => {
                  const baseKey = e.target.value
                  const isMinor = newSong.key.includes('m')
                  setNewSong({ ...newSong, key: isMinor && baseKey ? baseKey + 'm' : baseKey })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">선택</option>
                {KEYS.map(key => (
                  <option key={key} value={key}>{key}{newSong.key.includes('m') ? 'm' : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">박자</label>
              <select
                value={newSong.time_signature}
                onChange={(e) => setNewSong({ ...newSong, time_signature: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">선택</option>
                {TIME_SIGNATURES.map(ts => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템포</label>
              <select
                value={newSong.tempo}
                onChange={(e) => onTempoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">선택</option>
                {TEMPOS.map(tempo => (
                  <option key={tempo} value={tempo}>{tempo}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                BPM
                {newSong.tempo && getBPMRangeFromTempo(newSong.tempo) && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({getBPMRangeFromTempo(newSong.tempo)?.min} ~ {getBPMRangeFromTempo(newSong.tempo)?.max})
                  </span>
                )}
              </label>
              <input
                type="number"
                value={newSong.bpm}
                onChange={(e) => onBPMChange(e.target.value)}
                placeholder={newSong.tempo && getBPMRangeFromTempo(newSong.tempo)
                  ? `${getBPMRangeFromTempo(newSong.tempo)?.min} ~ ${getBPMRangeFromTempo(newSong.tempo)?.max}`
                  : "예: 120"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* 시즌 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시즌</label>
            <select
              value={newSong.season}
              onChange={(e) => setNewSong({ ...newSong, season: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">선택</option>
              {SEASONS.filter(s => s !== '전체').map(season => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>

          {/* 테마 다중 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">테마 (다중 선택 가능)</label>
            {newSong.themes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                {newSong.themes.map((theme) => (
                  <span key={theme} className="inline-flex items-center gap-1 px-2 py-1 bg-[#C5D7F2] text-white text-sm rounded-full">
                    {theme}
                    <button
                      type="button"
                      onClick={() => setNewSong({ ...newSong, themes: newSong.themes.filter(t => t !== theme) })}
                      className="w-4 h-4 flex items-center justify-center hover:bg-white/20 rounded-full"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {themeCounts.map(({ theme }) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => {
                    if (newSong.themes.includes(theme)) {
                      setNewSong({ ...newSong, themes: newSong.themes.filter(t => t !== theme) })
                    } else {
                      setNewSong({ ...newSong, themes: [...newSong.themes, theme] })
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition ${newSong.themes.includes(theme) ? 'bg-[#C5D7F2] text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  {theme}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                id="newThemeInput"
                type="text"
                placeholder="새 테마 직접 입력..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const input = e.currentTarget
                    const newTheme = input.value.trim()
                    if (newTheme && !newSong.themes.includes(newTheme)) {
                      setNewSong({ ...newSong, themes: [...newSong.themes, newTheme] })
                      input.value = ''
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('newThemeInput') as HTMLInputElement
                  const newTheme = input?.value.trim()
                  if (newTheme && !newSong.themes.includes(newTheme)) {
                    setNewSong({ ...newSong, themes: [...newSong.themes, newTheme] })
                    input.value = ''
                  }
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                추가
              </button>
            </div>
          </div>

          {/* YouTube URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL (선택사항)</label>
            <input
              type="url"
              value={newSong.youtube_url}
              onChange={(e) => setNewSong({ ...newSong, youtube_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* 가사 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">가사 (선택사항)</label>
            <textarea
              value={newSong.lyrics}
              onChange={(e) => setNewSong({ ...newSong, lyrics: e.target.value })}
              rows={4}
              placeholder="곡의 가사를 입력하세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* 악보 파일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              악보 파일 <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={onFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition flex items-center justify-center"
            >
              <Upload className="mr-2" size={20} />
              {uploadingFile ? (
                <span className="text-green-600 font-medium">
                  ✅ {uploadingFile.name} ({(uploadingFile.size / 1024 / 1024).toFixed(2)}MB)
                </span>
              ) : (
                '파일 선택 (PDF, JPG, PNG, 최대 10MB)'
              )}
            </button>
            {uploadingFile && (
              <button
                onClick={() => setUploadingFile(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-800"
              >
                파일 제거
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            disabled={uploading}
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={uploading || !newSong.song_name.trim() || !uploadingFile}
            className="flex-1 px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                업로드 중...
              </>
            ) : (
              <>
                <Plus className="mr-2" size={18} />
                곡 추가
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
