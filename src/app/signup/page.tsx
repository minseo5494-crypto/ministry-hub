'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp, signInWithGoogle } from '@/lib/auth'
import { Mail, Lock, User, AlertCircle, Chrome, Building, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    churchName: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // 이메일/비밀번호 회원가입
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 유효성 검사
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)

    try {
      await signUp(formData.email, formData.password, formData.name, formData.churchName)
      // 회원가입 성공 시 바로 로그인 페이지로 이동
      router.push('/login?message=회원가입이 완료되었습니다. 로그인해주세요.')
    } catch (err: any) {
      console.error('Signup error:', err)
      if (err.message?.includes('already registered')) {
        setError('이미 등록된 이메일입니다.')
      } else {
        setError(err.message || '회원가입에 실패했습니다.')
      }
      setLoading(false)
    }
  }

  // Google 회원가입
  const handleGoogleSignup = async () => {
    setError('')
    setGoogleLoading(true)

    try {
      await signInWithGoogle()
      // OAuth 리다이렉트가 자동으로 실행됨
    } catch (err: any) {
      console.error('Google signup error:', err)
      setError(err.message || 'Google 회원가입에 실패했습니다.')
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
          메인으로
        </Link>

        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            회원가입
          </h1>
          <p className="text-gray-600">
            Ministry Hub와 함께 시작하세요
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Google 회원가입 버튼 */}
        <button
          onClick={handleGoogleSignup}
          disabled={googleLoading || loading}
          className="w-full mb-6 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
        >
          {googleLoading ? (
            <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Chrome className="w-5 h-5 mr-2" />
              Google로 가입하기
            </>
          )}
        </button>

        {/* 구분선 */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">또는</span>
          </div>
        </div>

        {/* 이메일/비밀번호 회원가입 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                inputMode="text"
                autoComplete="name"
                autoCapitalize="words"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="홍길동"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>
          </div>

          <div>
<label className="block text-sm font-medium text-gray-700 mb-1">
교회 <span className="text-gray-400 font-normal">(선택)</span>
</label>
<div className="relative">
<Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
<input
  type="text"
  inputMode="text"
  autoComplete="organization"
  autoCapitalize="words"
  value={formData.churchName}
  onChange={(e) => setFormData({ ...formData, churchName: e.target.value })}
  placeholder="출석 교회명"
  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
/>
</div>
</div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
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
              비밀번호
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">최소 6자 이상</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 확인
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>
          </div>

          <div className="text-xs text-gray-600 space-y-2">
            <label className="flex items-start">
              <input type="checkbox" required className="mt-0.5 mr-2" />
              <span>
                <Link href="/terms" className="text-blue-600 hover:text-blue-700">이용약관</Link>
                {' '}및{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-700">개인정보처리방침</Link>
                에 동의합니다. <span className="text-red-500">*</span>
              </span>
            </label>
            <label className="flex items-start">
              <input type="checkbox" required className="mt-0.5 mr-2" />
              <span>
                <Link href="/copyright" className="text-blue-600 hover:text-blue-700">저작권 정책</Link>
                을 읽었으며, 악보 업로드 시 저작권 관련 책임이 업로더에게 있음에 동의합니다. <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-[#C5D7F2] text-white py-3 rounded-lg font-medium hover:bg-[#A8C4E8] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        {/* 로그인 링크 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}