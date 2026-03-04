import { redirect } from 'next/navigation'

export default function CommunityPage() {
  redirect('/explore?tab=shared')
}
