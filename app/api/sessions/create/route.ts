import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id } = await req.json()
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const serviceSupabase = await createServiceClient()

  // Verify ownership
  const { data: project } = await serviceSupabase
    .from('projects')
    .select('id, session_count')
    .eq('id', project_id)
    .eq('author_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const sessionNumber = (project.session_count || 0) + 1

  const { data: session } = await serviceSupabase
    .from('sessions')
    .insert({
      project_id,
      session_number: sessionNumber,
      title: `Session ${sessionNumber}`,
      source: 'chat',
    })
    .select()
    .single()

  await serviceSupabase
    .from('projects')
    .update({ session_count: sessionNumber })
    .eq('id', project_id)

  return NextResponse.json({ session })
}
