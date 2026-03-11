import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = await createServiceClient()

  const { data: project } = await serviceSupabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('author_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: sections } = await serviceSupabase
    .from('manuscript_sections')
    .select('*')
    .eq('project_id', params.id)
    .order('chapter_number', { ascending: true })
    .order('section_number', { ascending: true })

  return NextResponse.json({ project, sections: sections || [] })
}
