'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { handleOAuthCallback } from '@/lib/auth'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'verified' | 'error'>('loading')
  const [error, setError] = useState('')
  const t = useTranslations()

  useEffect(() => {
    // onAuthStateChange로 새 세션 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // 세션 메타데이터로 인증 제공자 감지 (PKCE 호환)
          const provider = session.user.app_metadata?.provider
          const isEmailUser = provider === 'email'

          if (isEmailUser) {
            // 이메일 인증 완료: setup-user API로 프로필 설정 + 데모 팀 가입
            const res = await fetch('/api/auth/setup-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
                authProvider: 'email',
                termsAgreedAt: new Date().toISOString()
              })
            })
            if (!res.ok) {
              console.error('이메일 인증 setup-user 실패:', await res.text())
            }

            setStatus('verified')
            setTimeout(() => router.push('/main'), 2000)
          } else {
            // OAuth 콜백 (Google 로그인 등)
            await handleOAuthCallback()
            setStatus('success')
            setTimeout(() => router.push('/main'), 1000)
          }
        } catch (err: any) {
          console.error('Callback processing error:', err)
          setStatus('error')
          setError(err.message || t('auth.processingError'))
        }
      }
    })

    // 타임아웃: 10초 안에 세션 감지 못하면 에러
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        setStatus('error')
        setError(t('auth.authTimeout'))
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
                {t('common.processing')}
              </h2>
              <p className="text-gray-600">
                {t('common.pleaseWait')}
              </p>
            </>
          )}

          {status === 'verified' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {t('auth.emailVerified')}
              </h2>
              <p className="text-gray-600">
                {t('auth.redirecting')}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {t('auth.loginComplete')}
              </h2>
              <p className="text-gray-600">
                {t('auth.redirecting')}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {t('auth.processingFailed')}
              </h2>
              <p className="text-gray-600 mb-6">
                {error}
              </p>
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                {t('auth.backToLogin')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
