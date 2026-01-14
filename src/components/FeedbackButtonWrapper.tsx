'use client'

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/auth'
import FeedbackButton from './FeedbackButton'

export default function FeedbackButtonWrapper() {
  const [userId, setUserId] = useState<string | undefined>()
  const [userEmail, setUserEmail] = useState<string | undefined>()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          setUserId(user.id)
          setUserEmail(user.email)
        }
      } catch (error) {
        // 로그인 안 된 상태에서도 피드백 가능
      }
    }
    loadUser()
  }, [])

  return <FeedbackButton userId={userId} userEmail={userEmail} />
}
