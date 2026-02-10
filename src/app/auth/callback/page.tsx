'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { handleOAuthCallback } from '@/lib/auth'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          await handleOAuthCallback()
          setStatus('success')
          setTimeout(() => router.push('/main'), 1000)
        } catch (err: any) {
          console.error('Callback processing error:', err)
          setStatus('error')
          setError(err.message || '처리 중 오류가 발생했습니다.')
        }
      }
    })

    // 타임아웃: 10초 안에 세션 감지 못하면 에러
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        setStatus('error')
        setError('인증 처리 시간이 초과되었습니다. 다시 시도해주세요.')
      }
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                처리 중...
              </h2>
              <p className="text-gray-600">
                잠시만 기다려주세요
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                로그인 완료!
              </h2>
              <p className="text-gray-600">
                메인 페이지로 이동합니다...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                처리 실패
              </h2>
              <p className="text-gray-600 mb-6">
                {error}
              </p>
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                로그인 페이지로 돌아가기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
