'use client'

import { Song } from '../types'

type StatsRowProps = {
  songs: Song[]
  selectedSongs: Song[]
}

export default function StatsRow({ songs, selectedSongs }: StatsRowProps) {
  const artistCount = new Set(songs.map(s => s.team_name).filter(Boolean)).size

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      <div className="bg-white border border-gray-200 rounded-xl p-2 md:p-3 text-center shadow-lg">
        <div className="text-lg md:text-2xl font-bold text-gray-900">{songs.length}+</div>
        <div className="text-[10px] md:text-xs text-gray-500">찬양곡</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-2 md:p-3 text-center shadow-lg">
        <div className="text-lg md:text-2xl font-bold text-gray-900">{artistCount}+</div>
        <div className="text-[10px] md:text-xs text-gray-500">아티스트</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-2 md:p-3 text-center shadow-lg">
        <div className="text-lg md:text-2xl font-bold text-gray-900">{selectedSongs.length}</div>
        <div className="text-[10px] md:text-xs text-gray-500">선택한 곡</div>
      </div>
    </div>
  )
}
