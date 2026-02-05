/**
 * 텍스트 유틸리티 함수
 * - 보이지 않는 유니코드 문자 제거
 * - 텍스트 정규화
 */

/**
 * 보이지 않는 유니코드 문자를 제거합니다.
 * 복사-붙여넣기 시 종종 포함되는 숨겨진 문자들을 정리합니다.
 *
 * @param text 정리할 텍스트
 * @returns 정리된 텍스트
 */
export function removeInvisibleChars(text: string): string {
  if (!text) return text

  return text
    // Zero-width characters
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    // Soft hyphen
    .replace(/\u00AD/g, '')
    // Other invisible formatting characters
    .replace(/[\u2028\u2029]/g, '')
    // Control characters (except newline, tab, carriage return)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Variation selectors
    .replace(/[\uFE00-\uFE0F]/g, '')
    // Unicode normalization (NFC: 정준 분해 후 정준 결합)
    .normalize('NFC')
}

/**
 * 곡 제목/아티스트명을 정리합니다.
 * - 보이지 않는 문자 제거
 * - 앞뒤 공백 제거
 * - 연속 공백을 단일 공백으로
 *
 * @param text 정리할 텍스트
 * @returns 정리된 텍스트
 */
export function cleanSongText(text: string): string {
  if (!text) return text

  return removeInvisibleChars(text)
    .trim()
    .replace(/\s+/g, ' ')
}
