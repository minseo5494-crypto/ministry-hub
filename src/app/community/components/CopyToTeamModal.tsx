'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { CopyToTeamInput } from '@/types/community'

type Team = {
  id: string
  name: string
}

type CopyToTeamModalProps = {
  isOpen: boolean
  teams: Team[]
  onClose: () => void
  onCopy: (input: Omit<CopyToTeamInput, 'shared_setlist_id'>) => Promise<void>
}

const SERVICE_TYPES = ['주일예배', '수요예배', '금요예배', '새벽예배', '청년예배', '주일학교']

export default function CopyToTeamModal({ isOpen, teams, onClose, onCopy }: CopyToTeamModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? '')
  const [serviceDate, setServiceDate] = useState(today)
  const [serviceType, setServiceType] = useState('')
  const [copying, setCopying] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    if (!selectedTeamId || !serviceDate || copying) return
    setCopying(true)
    try {
      await onCopy({
        team_id: selectedTeamId,
        service_date: serviceDate,
        service_type: serviceType || undefined,
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1500)
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">내 팀에 가져오기</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
            style={{ touchAction: 'manipulation', minHeight: '44px', minWidth: '44px' }}
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-medium text-gray-900">팀 셋리스트에 추가되었습니다!</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* 팀 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">팀 선택</label>
              {teams.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                  소속된 팀이 없습니다.{' '}
                  <a href="/teams/create" className="text-violet-600 font-medium hover:underline">팀 만들기</a>
                </p>
              ) : (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                        selectedTeamId === team.id
                          ? 'border-violet-400 bg-violet-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="team"
                        value={team.id}
                        checked={selectedTeamId === team.id}
                        onChange={() => setSelectedTeamId(team.id)}
                        className="w-4 h-4 text-violet-600"
                        style={{ appearance: 'radio' }}
                      />
                      <span className="text-sm font-medium text-gray-800">{team.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 예배 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">예배 날짜</label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* 예배 유형 (선택) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                예배 유형 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setServiceType(serviceType === type ? '' : type)}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${
                      serviceType === type
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{ touchAction: 'manipulation', minHeight: '36px' }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                취소
              </button>
              <button
                onClick={handleCopy}
                disabled={!selectedTeamId || !serviceDate || copying || teams.length === 0}
                className="flex-1 px-4 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                {copying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>복사 중...</span>
                  </>
                ) : (
                  '내 팀에 가져오기'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
