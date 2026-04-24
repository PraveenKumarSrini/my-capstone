import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ repoId: string }>
}

export default async function OldRepoDetail({ params }: PageProps) {
  const { repoId } = await params
  redirect(`/dashboard/repos/${repoId}`)
}
