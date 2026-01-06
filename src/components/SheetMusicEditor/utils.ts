import { Stroke, StrokePoint } from '@/lib/supabase'

/**
 * 스트로크 포인트 배열을 SVG path 문자열로 변환
 * perfect-freehand 라이브러리의 출력을 SVG에서 사용할 수 있는 형태로 변환
 */
export const getSvgPathFromStroke = (stroke: number[][]): string => {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q'] as (string | number)[]
  )

  d.push('Z')
  return d.join(' ')
}

/**
 * 점이 다각형 내부에 있는지 확인 (Ray casting algorithm)
 * 올가미 선택 기능에서 사용
 */
export const isPointInPolygon = (point: StrokePoint, polygon: StrokePoint[]): boolean => {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * 스트로크가 선택 영역(다각형)에 포함되는지 확인
 * 스트로크의 점 중 하나라도 선택 영역 안에 있으면 선택됨
 */
export const isStrokeInSelection = (stroke: Stroke, polygon: StrokePoint[]): boolean => {
  return stroke.points.some(point => isPointInPolygon(point, polygon))
}

/**
 * 두 점 사이의 거리 계산
 */
export const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

/**
 * 바운딩 박스 계산
 */
export const getBoundingBox = (points: StrokePoint[]): { x: number; y: number; width: number; height: number } | null => {
  if (points.length === 0) return null

  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity

  points.forEach(p => {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  })

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * 퍼센트 좌표를 픽셀 좌표로 변환
 */
export const percentToPixel = (
  percent: number,
  total: number
): number => {
  return (percent / 100) * total
}

/**
 * 픽셀 좌표를 퍼센트로 변환
 */
export const pixelToPercent = (
  pixel: number,
  total: number
): number => {
  return (pixel / total) * 100
}

/**
 * 값을 범위 내로 제한
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

/**
 * UUID 생성 (간단한 버전)
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
