import { redirect } from 'next/navigation'

export default function CommunityDetailPage({ params }: { params: { id: string } }) {
  redirect(`/explore/${params.id}`)
}
