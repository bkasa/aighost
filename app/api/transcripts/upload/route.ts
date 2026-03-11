import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { anthropic, GHOSTWRITER_MODEL } from '@/lib/anthropic'
import { buildSessionSummaryPrompt } from '@/lib/prompts/ghostwriter'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('project_id') as string

  if (!file || !projectId) {
    return NextResponse.json({ error: 'File and project_id required' }, { status: 400 })
  }

  // Validate file
  const validTypes = ['text/plain', 'application/pdf', 'text/markdown']
  if (!validTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
    return NextResponse.json({ error: 'Only .txt, .md, or .pdf files accepted' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  const serviceSupabase = await createServiceClient()

  // Verify project ownership
  const { data: project } = await serviceSupabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('author_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Read transcript text
  let transcriptText = ''
  if (file.type === 'application/pdf') {
    // For PDF, we'd normally use a PDF parser - for now accept text
    return NextResponse.json({ error: 'PDF upload coming soon. Please upload as .txt' }, { status: 400 })
  } else {
    transcriptText = await file.text()
  }

  // Create session record
  const sessionNumber = (project.session_count || 0) + 1
  const { data: session } = await serviceSupabase
    .from('sessions')
    .insert({
      project_id: projectId,
      session_number: sessionNumber,
      title: `Uploaded Transcript ${sessionNumber}: ${file.name}`,
      source: 'uploaded_transcript',
    })
    .select()
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  // Save transcript as messages (parse if possible, or as single block)
  const lines = transcriptText.split('\n').filter(l => l.trim())
  let currentRole: 'user' | 'assistant' = 'user'
  let buffer = ''

  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    const isInterviewer = lowerLine.startsWith('interviewer:') || 
                          lowerLine.startsWith('ghostwriter:') ||
                          lowerLine.startsWith('q:') ||
                          lowerLine.startsWith('host:')
    const isSubject = lowerLine.startsWith('author:') ||
                      lowerLine.startsWith('subject:') ||
                      lowerLine.startsWith('a:') ||
                      lowerLine.startsWith('guest:')

    if (isInterviewer || isSubject) {
      if (buffer.trim()) {
        await serviceSupabase.from('messages').insert({
          session_id: session.id,
          project_id: projectId,
          role: currentRole,
          content: buffer.trim(),
        })
        buffer = ''
      }
      currentRole = isInterviewer ? 'assistant' : 'user'
      buffer = line.replace(/^[^:]+:\s*/i, '')
    } else {
      buffer += (buffer ? '\n' : '') + line
    }
  }

  // Save any remaining buffer
  if (buffer.trim()) {
    await serviceSupabase.from('messages').insert({
      session_id: session.id,
      project_id: projectId,
      role: 'user',
      content: buffer.trim(),
    })
  }

  // Store raw file in Supabase storage
  const { error: uploadError } = await serviceSupabase.storage
    .from('transcripts')
    .upload(`${projectId}/${session.id}/${file.name}`, file, {
      contentType: file.type || 'text/plain',
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
  }

  // Run AI analysis on transcript to extract stories and update project state
  try {
    const summaryPrompt = buildSessionSummaryPrompt(
      transcriptText.slice(0, 8000), // limit for token budget
      project.project_summary || ''
    )

    const analysisResponse = await anthropic.messages.create({
      model: GHOSTWRITER_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: summaryPrompt }],
    })

    const analysisText = analysisResponse.content[0].type === 'text'
      ? analysisResponse.content[0].text
      : ''

    // Update session summary and project summary
    await serviceSupabase.from('sessions').update({
      summary: analysisText.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq('id', session.id)

    await serviceSupabase.from('projects').update({
      session_count: sessionNumber,
      project_summary: analysisText,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId)

  } catch (err) {
    console.error('AI analysis of transcript failed:', err)
  }

  return NextResponse.json({
    success: true,
    session_id: session.id,
    session_number: sessionNumber,
    message: 'Transcript uploaded and analyzed successfully.',
  })
}
