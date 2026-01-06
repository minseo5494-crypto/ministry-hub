'use client'

import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
  show: boolean
}

const toastStyles: Record<ToastType, { bg: string; icon: typeof CheckCircle }> = {
  success: { bg: 'bg-green-500', icon: CheckCircle },
  error: { bg: 'bg-red-500', icon: XCircle },
  warning: { bg: 'bg-yellow-500', icon: AlertCircle },
  info: { bg: 'bg-blue-500', icon: Info },
}

export default function Toast({
  message,
  type = 'success',
  duration = 3000,
  onClose,
  show,
}: ToastProps) {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [show, duration, onClose])

  if (!show) return null

  const { bg, icon: Icon } = toastStyles[type]

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50
        flex items-center gap-3 px-4 py-3
        ${bg} text-white
        rounded-xl shadow-lg
        animate-in slide-in-from-right-5 fade-in duration-300
      `}
    >
      <Icon size={20} />
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded-full transition"
      >
        <X size={16} />
      </button>
    </div>
  )
}

// Toast 상태 관리를 위한 커스텀 훅
import { useState, useCallback } from 'react'

interface ToastState {
  show: boolean
  message: string
  type: ToastType
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  })

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ show: true, message, type })
  }, [])

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }))
  }, [])

  return {
    toast,
    showToast,
    hideToast,
  }
}
