// src/hooks/useAuth.ts
// 🔐 인증 상태 관리 훅

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, signOut } from '@/lib/auth'
import { User } from '@/lib/supabase'

interface UseAuthOptions {
  requireAuth?: boolean
  redirectTo?: string
}

export function useAuth(options: UseAuthOptions = {}) {
  const { requireAuth = false, redirectTo = '/login' } = options
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
        
        if (requireAuth && !currentUser) {
          alert('로그인이 필요합니다.')
          router.push(redirectTo)
        }
      } catch (error) {
        console.error('Error checking user:', error)
        if (requireAuth) {
          router.push(redirectTo)
        }
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [requireAuth, redirectTo, router])

  const handleSignOut = async () => {
    try {
      await signOut()
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signOut: handleSignOut
  }
}