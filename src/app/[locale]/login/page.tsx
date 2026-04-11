'use client'

import { useState, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithCaptcha, signInWithGoogle } from '@/lib/auth'
import { trackLogin } from '@/lib/analytics'
import { Mail, Lock, AlertCircle, Chrome, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile'
import { useTranslations } from 'next-intl'

const TURNSTILE_SITE_KEY = '0x4AAAAAACMZcDVS_OETU_9t'

// useSearchParams를 사용하는 컴포넌트를 분리
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  // URL에서 메시지 확인 (이메일 인증 완료 등)
  const message = searchParams.get('message')

  // 이메일/비밀번호 로그인
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!captchaToken) {
      setError(t('auth.captchaRequired'))
      return
    }

    setLoading(true)

    try {
      await signInWithCaptcha(formData.email, formData.password, captchaToken!)
      trackLogin('email')
      router.push('/')
    } catch (err: any) {
      console.error('Login error:', err)
      // CAPTCHA 리셋
      turnstileRef.current?.reset()
      setCaptchaToken(null)

      if (err.message?.includes('Email not confirmed')) {
        setError(t('auth.emailNotConfirmed'))
      } else if (err.message?.includes('Invalid login credentials')) {
        // 이메일 존재 여부 확인하여 에러 메시지 분기
        try {
          const res = await fetch('/api/auth/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email }),
          })
          const { exists } = await res.json()
          if (!exists) {
            setError(t('auth.emailNotFound'))
          } else {
            setError(t('auth.wrongPassword'))
          }
        } catch {
          setError(t('auth.invalidCredentials'))
        }
      } else if (err.message?.includes('captcha')) {
        setError(t('auth.captchaFailed'))
      } else {
        setError(err.message || t('errors.loginFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  // Google 로그인
  const handleGoogleLogin = async () => {
    setError('')
    setGoogleLoading(true)

    try {
      await signInWithGoogle()
      // OAuth 리다이렉트가 자동으로 실행됨
    } catch (err: any) {
      console.error('Google login error:', err)
      setError(err.message || t('auth.googleLoginFailed'))
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* 메인으로 돌아가기 */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 touch-manipulation"
        >
          <ArrowLeft size={20} className="mr-1" />
          {t('auth.backToMain')}
        </Link>

        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('auth.loginTitle')}
          </h1>
          <p className="text-gray-600">
            {t('auth.welcome')}
          </p>
        </div>

        {/* 성공 메시지 */}
        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{message}</p>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Google 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full mb-6 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
        >
          {googleLoading ? (
            <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Chrome className="w-5 h-5 mr-2" />
              {t('auth.googleLogin')}
            </>
          )}
        </button>

        {/* 구분선 */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">{t('auth.or')}</span>
          </div>
        </div>

        {/* 이메일/비밀번호 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center cursor-pointer touch-manipulation">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center">
                  {rememberMe && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-gray-600 select-none ml-2">{t('auth.rememberMe')}</span>
            </label>
            <Link href="/auth/forgot-password" className="text-blue-600 hover:text-blue-700">
              {t('auth.findPassword')}
            </Link>
          </div>

          {/* CAPTCHA */}
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => {
                setCaptchaToken(null)
                setError(t('auth.captchaLoadFailed'))
              }}
              onExpire={() => setCaptchaToken(null)}
              options={{
                theme: 'light',
                size: 'normal',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading || !captchaToken}
            className="w-full bg-[#C5D7F2] text-white py-3 rounded-lg font-medium hover:bg-[#A8C4E8] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {t('auth.noAccount')}{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              {t('auth.signupButton')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// 메인 컴포넌트 - Suspense로 감싸기
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
