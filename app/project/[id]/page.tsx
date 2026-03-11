import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectWorkspace } from '@/components/ProjectWorkspace'

interface Props {
  params: { id: string }
}

export default async function ProjectPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('author_id', user.id)
    .single()

  if (!project) redirect('/dashboard')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })

  const { data: sections } = await supabase
    .from('manuscript_sections')
    .select('*')
    .eq('project_id', params.id)
    .order('chapter_number', { ascending: true })
    .order('section_number', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <ProjectWorkspace
      project={project}
      sessions={sessions || []}
      sections={sections || []}
      userProfile={profile || { full_name: null, email: user.email || '' }}
    />
  )
}
