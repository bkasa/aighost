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
  const { data: messages } = await serviceSupabase
    .from('messages')
    .select('*')
    .eq('session_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages || [] })
}
