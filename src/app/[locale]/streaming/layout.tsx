import { Pacifico } from 'next/font/google'
import type { Metadata } from 'next'

const pacifico = Pacifico({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pacifico',
})

export const metadata: Metadata = {
  title: 'PraiseHub - 찬양 스트리밍',
  description: '온라인 찬양 음악 스트리밍 서비스',
}

export default function StreamingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${pacifico.variable} min-h-screen bg-slate-900`}>
      {children}
    </div>
  )
}