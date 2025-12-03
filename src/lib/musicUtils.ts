// src/lib/musicUtils.ts
// 🎵 음악 관련 유틸리티 함수

import { TEMPO_RANGES } from './constants';

/**
 * BPM에서 템포 자동 선택
 */
export const getTempoFromBPM = (bpm: number): string => {
  if (bpm <= 65) return '느림';
  if (bpm <= 79) return '조금느림';
  if (bpm <= 100) return '보통';
  if (bpm <= 120) return '조금빠름';
  if (bpm <= 150) return '빠름';
  if (bpm <= 200) return '매우빠름';
  return '';
};

/**
 * 템포에 따른 BPM 범위 반환
 */
export const getBPMRangeFromTempo = (tempo: string): { min: number; max: number } | null => {
  return TEMPO_RANGES[tempo] || null;
};

/**
 * 유튜브 URL을 embed URL로 변환
 */
export const getYoutubeEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  return null;
};