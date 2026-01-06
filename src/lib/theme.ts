// ===== 앱 테마 색상 =====
export const THEME_COLORS = {
  // 브랜드 색상
  primary: '#C5D7F2',
  primaryHover: '#A8C4E8',
  primaryDark: '#7C3AED',

  // 상태 색상
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // 중립 색상
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // 기능별 색상
  violet: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
  },
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
} as const

// ===== 공개 범위 색상 =====
export const VISIBILITY_COLORS = {
  public: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-700',
  },
  teams: {
    bg: 'bg-violet-50',
    border: 'border-violet-500',
    text: 'text-violet-700',
  },
  private: {
    bg: 'bg-gray-100',
    border: 'border-gray-500',
    text: 'text-gray-700',
  },
} as const

// ===== 상태 색상 =====
export const STATUS_COLORS = {
  completed: {
    bg: 'bg-green-100',
    text: 'text-green-700',
  },
  pending: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
  },
  failed: {
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
} as const

// ===== 버튼 스타일 =====
export const BUTTON_STYLES = {
  primary: 'bg-[#C5D7F2] hover:bg-[#A8C4E8] text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  violet: 'bg-violet-600 hover:bg-violet-700 text-white',
  outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
} as const

// ===== 입력 필드 스타일 =====
export const INPUT_STYLES = {
  base: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base',
  withIcon: 'w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base',
  error: 'border-red-500 focus:ring-red-500',
} as const
