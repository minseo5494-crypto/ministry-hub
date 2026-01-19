'use client'

import { X } from 'lucide-react'
import { UserTeam } from '../types'

type SaveSetlistModalProps = {
  isOpen: boolean
  setlistTitle: string
  setSetlistTitle: (title: string) => void
  setlistDate: string
  setSetlistDate: (date: string) => void
  setlistType: string
  setSetlistType: (type: string) => void
  customSetlistType: string
  setCustomSetlistType: (type: string) => void
  selectedTeamId: string
  setSelectedTeamId: (id: string) => void
  userTeams: UserTeam[]
  onSave: () => void
  onClose: () => void
}

export default function SaveSetlistModal({
  isOpen,
  setlistTitle,
  setSetlistTitle,
  setlistDate,
  setSetlistDate,
  setlistType,
  setSetlistType,
  customSetlistType,
  setCustomSetlistType,
  selectedTeamId,
  setSelectedTeamId,
  userTeams,
  onSave,
  onClose
}: SaveSetlistModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">콘티 저장</h2>

        <div className="space-y-4">
          {/* 팀 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              팀 선택 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">팀을 선택하세요</option>
              {userTeams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {userTeams.length === 0 && (
              <p className="text-sm text-red-600 mt-1">
                ⚠️ 소속된 팀이 없습니다. 먼저 팀에 참여하거나 생성하세요.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              콘티 제목
            </label>
            <input
              type="text"
              value={setlistTitle}
              onChange={(e) => setSetlistTitle(e.target.value)}
              placeholder="예: 아버지의 마음"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              예배 날짜
            </label>
            <input
              type="date"
              value={setlistDate}
              onChange={(e) => setSetlistDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              예배 유형
            </label>
            <select
              value={setlistType}
              onChange={(e) => setSetlistType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="주일집회">주일집회</option>
              <option value="중보기도회">중보기도회</option>
              <option value="기도회">기도회</option>
              <option value="직접입력">직접입력</option>
            </select>
          </div>

          {setlistType === '직접입력' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                예배 유형 입력
              </label>
              <input
                type="text"
                value={customSetlistType}
                onChange={(e) => setCustomSetlistType(e.target.value)}
                placeholder="예: 또래 기도회"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            취소
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-[#C5D7F2] text-white rounded-lg hover:bg-[#A8C4E8]"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
