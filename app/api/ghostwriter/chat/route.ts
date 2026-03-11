import { NextRequest, NextResponse } from 'next/server'
import { anthropic, GHOSTWRITER_MODEL, parseStateUpdate, countWords } from '@/lib/anthropic'
import { buildGhostwriterSystemPrompt } from '@/lib/prompts/ghostwriter'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { ProjectState, StateUpdate, Story, ManuscriptSection } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { project_id, session_id, message, is_guest, guest_name } = await req.json()

    if (!project_id || !session_id || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Auth check (unless guest)
    const supabase = await createClient()
    let userId: string | null = null

    if (!is_guest) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      userId = user.id
    }

    const serviceSupabase = await createServiceClient()

    // Load project state
    const { data: project, error: projectError } = await serviceSupabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Load recent session messages for context
    const { data: recentMessages } = await serviceSupabase
      .from('messages')
      .select('role, content, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(50)

    // Save user message
    await serviceSupabase.from('messages').insert({
      session_id,
      project_id,
      role: 'user',
      content: is_guest ? `[${guest_name || 'Guest'}]: ${message}` : message,
    })

    // Build conversation history for Claude
    const conversationHistory = (recentMessages || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Add current user message
    conversationHistory.push({ role: 'user', content: message })

    // Build system prompt with full project context
    const projectState: ProjectState = {
      ...project,
      framework: project.framework || { chapters: [] },
      stories: project.stories || [],
      author_profile: project.author_profile || {},
      book_brief: project.book_brief || {},
    }

    const systemPrompt = buildGhostwriterSystemPrompt(projectState)

    // Stream response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''

        try {
          const claudeStream = await anthropic.messages.create({
            model: GHOSTWRITER_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages: conversationHistory,
            stream: true,
          })

          for await (const chunk of claudeStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              fullResponse += text

              // Stream text chunks (excluding state_update block)
              if (!fullResponse.includes('<state_update>')) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
              } else {
                // We're inside the state_update block — don't stream it
                const beforeState = fullResponse.split('<state_update>')[0]
                const alreadySent = conversationHistory.slice(-1)[0]?.content?.length || 0
                if (beforeState.length > alreadySent) {
                  // Don't re-stream already-sent content
                }
              }
            }
          }

          // Parse out the state update from full response
          const { cleanResponse, stateUpdate } = parseStateUpdate(fullResponse)

          // Save assistant message (clean version without state_update block)
          await serviceSupabase.from('messages').insert({
            session_id,
            project_id,
            role: 'assistant',
            content: cleanResponse,
          })

          // Process state updates
          if (stateUpdate) {
            await processStateUpdate(serviceSupabase, project_id, projectState, stateUpdate as StateUpdate)
          }

          // Update session metadata
          await serviceSupabase
            .from('sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', session_id)

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================
// Process state updates from AI response
// =============================================

async function processStateUpdate(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  projectId: string,
  currentState: ProjectState,
  update: StateUpdate
) {
  const projectUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  // Framework update
  if (update.framework_updated && update.new_framework) {
    projectUpdates.framework = update.new_framework

    // Sync manuscript_sections table with new framework
    for (const chapter of update.new_framework.chapters) {
      for (const section of chapter.sections) {
        await supabase.from('manuscript_sections').upsert({
          project_id: projectId,
          chapter_id: chapter.id,
          section_id: section.id,
          chapter_number: chapter.number,
          section_number: section.number,
          chapter_title: chapter.title,
          section_title: section.title,
          status: section.status || 'placeholder',
          story_ids: section.story_ids || [],
        }, {
          onConflict: 'project_id,chapter_id,section_id',
          ignoreDuplicates: false,
        })
      }
    }
  }

  // New stories
  if (update.stories_extracted && update.stories_extracted.length > 0) {
    const newStories = update.stories_extracted.map(s => ({
      ...s,
      id: s.id || `story_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      collected_at: s.collected_at || new Date().toISOString(),
    }))

    const allStories: Story[] = [
      ...(currentState.stories || []),
      ...newStories,
    ]

    projectUpdates.stories = allStories
    projectUpdates.total_stories = allStories.length
  }

  // Written sections
  if (update.sections_written && update.sections_written.length > 0) {
    for (const section of update.sections_written) {
      const wordCount = countWords(section.content)
      await supabase.from('manuscript_sections').upsert({
        project_id: projectId,
        chapter_id: section.chapter_id,
        section_id: section.section_id,
        chapter_title: section.chapter_title,
        section_title: section.section_title,
        content: section.content,
        status: 'drafted',
        word_count: wordCount,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,chapter_id,section_id',
        ignoreDuplicates: false,
      })
    }
  }

  // Summary update
  if (update.project_summary_updated) {
    projectUpdates.project_summary = update.project_summary_updated
  }

  // Phase change
  if (update.phase_change) {
    projectUpdates.phase = update.phase_change
  }

  // Onboarding data
  if (update.onboarding_data) {
    if (update.onboarding_data.author_profile) {
      projectUpdates.author_profile = {
        ...(currentState.author_profile || {}),
        ...update.onboarding_data.author_profile,
      }
    }
    if (update.onboarding_data.book_brief) {
      projectUpdates.book_brief = {
        ...(currentState.book_brief || {}),
        ...update.onboarding_data.book_brief,
        // Update project title if working_title provided
        ...(update.onboarding_data.book_brief.working_title ? {} : {}),
      }
      if (update.onboarding_data.book_brief.working_title) {
        projectUpdates.title = update.onboarding_data.book_brief.working_title
      }
    }
  }

  // Apply all project updates
  await supabase.from('projects').update(projectUpdates).eq('id', projectId)
}
