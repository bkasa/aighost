import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.has_paid) redirect('/?needs_payment=true')

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false })

  const project = projects?.[0]

  if (project) redirect(`/project/${project.id}`)

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="font-serif text-3xl text-parchment-100 mb-4">Welcome.</div>
        <p className="text-parchment-400 mb-8">Setting up your workspace…</p>
        <div className="flex justify-center gap-1.5">
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </div>
      </div>
    </div>
  )
}
