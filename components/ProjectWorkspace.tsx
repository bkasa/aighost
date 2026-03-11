'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ProjectState, Session, ManuscriptSection, Message } from '@/lib/types'

type Panel = 'chat' | 'framework' | 'manuscript' | 'transcripts'

interface Props {
  project: ProjectState
  sessions: Session[]
  sections: ManuscriptSection[]
  userProfile: { full_name: string | null; email: string }
}

export function ProjectWorkspace({ project: initialProject, sessions: initialSessions, sections: initialSections, userProfile }: Props) {
  const [project, setProject] = useState(initialProject)
  const [sessions, setSessions] = useState(initialSessions)
  const [sections, setSections] = useState(initialSections)
  const [activePanel, setActivePanel] = useState<Panel>('chat')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Start or resume a session
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      loadSession(sessions[0].id)
    }
  }, [])

  async function loadSession(sessionId: string) {
    setActiveSessionId(sessionId)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      // Session exists but no messages yet
      setMessages([])
    }
  }

  async function startNewSession() {
    try {
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id }),
      })
      const data = await res.json()
      if (data.session) {
        setSessions(prev => [data.session, ...prev])
        setActiveSessionId(data.session.id)
        setMessages([])
      }
    } catch {
      console.error('Failed to create session')
    }
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText])

  function autoResizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim()
    if (!messageText || isStreaming) return
    if (!activeSessionId) {
      await startNewSession()
      return
    }

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const userMessage: Message = {
      id: `temp_${Date.now()}`,
      session_id: activeSessionId,
      project_id: project.id,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])
    setIsStreaming(true)
    setStreamingText('')

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ghostwriter/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          session_id: activeSessionId,
          message: messageText,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.text) {
              accumulated += data.text
              setStreamingText(accumulated)
            }
            if (data.done) {
              // Finalize message
              const assistantMessage: Message = {
                id: `temp_ai_${Date.now()}`,
                session_id: activeSessionId,
                project_id: project.id,
                role: 'assistant',
                content: accumulated,
                created_at: new Date().toISOString(),
              }
              setMessages(prev => [...prev, assistantMessage])
              setStreamingText('')

              // Refresh project state
              await refreshProjectState()
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Stream error:', err)
      }
    } finally {
      setIsStreaming(false)
      setStreamingText('')
    }
  }

  async function refreshProjectState() {
    try {
      const res = await fetch(`/api/project/${project.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.project) setProject(data.project)
        if (data.sections) setSections(data.sections)
      }
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const authorName = project.author_profile?.name || userProfile.full_name || 'Author'
  const bookTitle = project.title || 'Untitled Book'
  const phaseLabels: Record<string, string> = {
    onboarding: 'Getting to know you',
    story_gathering: 'Finding your stories',
    drafting: 'Writing your book',
    revision: 'Refining the draft',
    proofing: 'Final review',
    complete: 'Complete',
  }

  async function handleDownload(format: 'docx' | 'txt') {
    const url = `/api/manuscript/download?project_id=${project.id}&format=${format}`
    const a = document.createElement('a')
    a.href = url
    a.download = `${bookTitle.replace(/[^a-z0-9]/gi, '_')}_draft.${format}`
    a.click()
  }

  return (
    <div className="h-screen bg-ink-950 flex overflow-hidden">

      {/* Left Sidebar */}
      <aside className={`
        flex-shrink-0 bg-ink-900 border-r border-ink-700 flex flex-col
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-64' : 'w-14'}
      `}>
        {/* Logo + toggle */}
        <div className="p-4 border-b border-ink-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex-shrink-0 flex items-center justify-center">
            <span className="text-ink-900 font-serif font-bold text-xs">G</span>
          </div>
          {sidebarOpen && (
            <span className="font-serif text-sm text-parchment-100 truncate flex-1">AIGhostwriter</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-ink-400 hover:text-parchment-300 transition-colors flex-shrink-0"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Phase indicator */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-b border-ink-700">
            <div className="text-ink-400 text-xs uppercase tracking-wider mb-1">Current phase</div>
            <div className="text-gold-400 text-xs font-medium">{phaseLabels[project.phase] || project.phase}</div>
            <div className="mt-2 h-1 bg-ink-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-600 to-gold-400 rounded-full transition-all duration-1000"
                style={{ width: `${(['onboarding','story_gathering','drafting','revision','proofing','complete'].indexOf(project.phase) + 1) / 6 * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-b border-ink-700 grid grid-cols-2 gap-3">
            <div className="bg-ink-800 rounded-lg p-2.5 text-center">
              <div className="text-gold-400 font-serif text-lg font-medium">{project.total_stories || 0}</div>
              <div className="text-ink-400 text-xs">stories</div>
            </div>
            <div className="bg-ink-800 rounded-lg p-2.5 text-center">
              <div className="text-gold-400 font-serif text-lg font-medium">{Math.round((project.total_words || 0) / 1000)}k</div>
              <div className="text-ink-400 text-xs">words</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {[
            { id: 'chat' as Panel, icon: '💬', label: 'Interview' },
            { id: 'framework' as Panel, icon: '📋', label: 'Framework' },
            { id: 'manuscript' as Panel, icon: '📖', label: 'Manuscript' },
            { id: 'transcripts' as Panel, icon: '🎙️', label: 'Transcripts' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                ${activePanel === item.id
                  ? 'bg-gold-500/10 border border-gold-500/20 text-gold-300'
                  : 'text-parchment-400 hover:text-parchment-200 hover:bg-ink-800'}
              `}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Sessions */}
        {sidebarOpen && (
          <div className="border-t border-ink-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-400 text-xs uppercase tracking-wider">Sessions</span>
              <button
                onClick={startNewSession}
                className="text-gold-400 hover:text-gold-300 text-xs transition-colors"
              >
                + New
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => { loadSession(session.id); setActivePanel('chat') }}
                  className={`
                    w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all duration-200
                    ${activeSessionId === session.id
                      ? 'bg-ink-700 text-parchment-200'
                      : 'text-parchment-400 hover:bg-ink-800 hover:text-parchment-300'}
                  `}
                >
                  <div className="font-medium truncate">{session.title}</div>
                  <div className="text-ink-500 mt-0.5">{new Date(session.created_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Download */}
        {sidebarOpen && (
          <div className="border-t border-ink-700 p-3 space-y-1.5">
            <button
              onClick={() => handleDownload('docx')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-parchment-300 hover:text-parchment-100 text-xs transition-all duration-200"
            >
              <span>⬇</span> Download DOCX
            </button>
            <button
              onClick={() => handleDownload('txt')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-parchment-300 hover:text-parchment-100 text-xs transition-all duration-200"
            >
              <span>⬇</span> Download TXT
            </button>
          </div>
        )}
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-14 bg-ink-900/80 backdrop-blur border-b border-ink-700 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-sm text-parchment-200 truncate">{bookTitle}</h1>
            <p className="text-ink-400 text-xs">{authorName}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span className="hidden sm:block">{phaseLabels[project.phase]}</span>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
        </header>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">

          {/* CHAT PANEL */}
          {activePanel === 'chat' && (
            <div className="h-full flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 && !isStreaming && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md">
                      <div className="font-serif text-4xl text-parchment-400 mb-4 opacity-40">✦</div>
                      <p className="font-serif text-xl text-parchment-300 mb-3">Ready when you are.</p>
                      <p className="text-parchment-500 text-sm leading-relaxed">
                        Your ghostwriter is here to listen. Start by telling them a little about yourself,
                        or just say hello.
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} authorName={authorName} />
                ))}

                {isStreaming && streamingText && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex-shrink-0 flex items-center justify-center mt-1">
                      <span className="text-ink-900 font-serif font-bold text-xs">G</span>
                    </div>
                    <div className="flex-1 bg-ink-800/50 rounded-2xl rounded-tl-sm px-5 py-4 max-w-3xl">
                      <div className="chat-prose text-parchment-200 whitespace-pre-wrap">{streamingText}</div>
                    </div>
                  </div>
                )}

                {isStreaming && !streamingText && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex-shrink-0 flex items-center justify-center">
                      <span className="text-ink-900 font-serif font-bold text-xs">G</span>
                    </div>
                    <div className="bg-ink-800/50 rounded-2xl rounded-tl-sm px-5 py-4">
                      <div className="flex gap-1.5 items-center h-5">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-ink-700 bg-ink-900/80 backdrop-blur p-4">
                <div className="max-w-3xl mx-auto">
                  <div className="flex gap-3 items-end bg-ink-800 border border-ink-600 hover:border-ink-500 focus-within:border-gold-500 rounded-xl p-3 transition-all duration-200">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); autoResizeTextarea() }}
                      onKeyDown={handleKeyDown}
                      placeholder="Share a story, answer a question, or ask anything…"
                      rows={1}
                      disabled={isStreaming}
                      className="flex-1 bg-transparent text-parchment-100 placeholder:text-ink-400 text-sm resize-none outline-none leading-relaxed disabled:opacity-50 font-sans min-h-[24px] max-h-[200px]"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={isStreaming || !input.trim()}
                      className="
                        flex-shrink-0 w-9 h-9 rounded-lg bg-gold-500 hover:bg-gold-400
                        disabled:opacity-40 disabled:cursor-not-allowed
                        flex items-center justify-center transition-all duration-200
                      "
                    >
                      <span className="text-ink-900 text-sm">↑</span>
                    </button>
                  </div>
                  <p className="text-ink-600 text-xs text-center mt-2">
                    Press Enter to send · Shift+Enter for new line
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* FRAMEWORK PANEL */}
          {activePanel === 'framework' && (
            <FrameworkPanel project={project} sections={sections} />
          )}

          {/* MANUSCRIPT PANEL */}
          {activePanel === 'manuscript' && (
            <ManuscriptPanel project={project} sections={sections} />
          )}

          {/* TRANSCRIPTS PANEL */}
          {activePanel === 'transcripts' && (
            <TranscriptsPanel project={project} sessions={sessions} onSessionAdded={(s) => setSessions(prev => [s, ...prev])} />
          )}
        </div>
      </main>
    </div>
  )
}

// =============================================
// ChatMessage component
// =============================================

function ChatMessage({ message, authorName }: { message: Message; authorName: string }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`
        w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 text-xs font-medium
        ${isUser
          ? 'bg-ink-700 text-parchment-300 border border-ink-600'
          : 'bg-gradient-to-br from-gold-400 to-gold-600 text-ink-900 font-serif font-bold'}
      `}>
        {isUser ? authorName.charAt(0).toUpperCase() : 'G'}
      </div>
      <div className={`
        max-w-3xl rounded-2xl px-5 py-4
        ${isUser
          ? 'bg-ink-700 text-parchment-200 rounded-tr-sm'
          : 'bg-ink-800/50 text-parchment-200 rounded-tl-sm'}
      `}>
        <div className="chat-prose whitespace-pre-wrap">{message.content}</div>
        <div className={`text-ink-500 text-xs mt-2 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

// =============================================
// FrameworkPanel component
// =============================================

function FrameworkPanel({ project, sections }: { project: ProjectState; sections: ManuscriptSection[] }) {
  const chapters = project.framework?.chapters || []
  const statusColors = {
    placeholder: 'bg-ink-700 text-ink-400',
    drafted: 'bg-blue-900/40 text-blue-300 border-blue-500/20',
    revised: 'bg-green-900/40 text-green-300 border-green-500/20',
    approved: 'bg-gold-500/20 text-gold-300 border-gold-500/20',
  }

  if (chapters.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center px-8">
        <div>
          <div className="text-4xl mb-4 opacity-30">📋</div>
          <p className="font-serif text-xl text-parchment-300 mb-2">Framework is taking shape</p>
          <p className="text-parchment-500 text-sm max-w-sm leading-relaxed">
            As you talk with your ghostwriter, a chapter framework will emerge here. You can ask to
            see or change the framework at any time during your interview.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-parchment-100 mb-1">{project.title}</h2>
          <p className="text-parchment-400 text-sm">
            {chapters.length} chapters · {sections.length} sections total
            {' · '}{sections.filter(s => s.status !== 'placeholder').length} written
          </p>
          <p className="text-ink-400 text-xs mt-2">
            To reorganize, add, or remove chapters and sections, tell your ghostwriter in the Interview tab.
          </p>
        </div>

        <div className="space-y-4">
          {chapters.map((chapter, ci) => {
            const chapterSections = sections.filter(s => s.chapter_id === chapter.id)
            return (
              <div key={chapter.id} className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-ink-700 flex items-start gap-4">
                  <span className="font-serif text-3xl font-bold text-ink-600 leading-none mt-0.5 flex-shrink-0">
                    {String(chapter.number).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-parchment-100 font-medium">{chapter.title}</h3>
                    <p className="text-parchment-400 text-sm mt-1">{chapter.description}</p>
                    {chapter.core_message && (
                      <p className="text-gold-400/70 text-xs mt-2 italic">
                        "{chapter.core_message}"
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-ink-400 text-xs">{chapterSections.filter(s => s.status !== 'placeholder').length}/{chapter.sections?.length || 0} written</div>
                  </div>
                </div>
                <div className="divide-y divide-ink-800">
                  {chapter.sections?.map((section, si) => {
                    const manuscriptSection = chapterSections.find(ms => ms.section_id === section.id)
                    const status = manuscriptSection?.status || section.status || 'placeholder'
                    return (
                      <div key={section.id} className="px-6 py-3 flex items-center gap-4 hover:bg-ink-800/30 transition-colors">
                        <span className="text-ink-600 text-xs font-mono w-8 flex-shrink-0">{chapter.number}.{section.number}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-parchment-300 text-sm font-medium truncate">{section.title}</div>
                          <div className="text-parchment-500 text-xs truncate mt-0.5">{section.description}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {(manuscriptSection?.story_ids?.length || section.story_ids?.length || 0) > 0 && (
                            <span className="text-ink-400 text-xs">
                              {manuscriptSection?.story_ids?.length || section.story_ids?.length || 0} stories
                            </span>
                          )}
                          {manuscriptSection?.word_count ? (
                            <span className="text-ink-400 text-xs">{manuscriptSection.word_count}w</span>
                          ) : null}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[status as keyof typeof statusColors] || statusColors.placeholder}`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================
// ManuscriptPanel component
// =============================================

function ManuscriptPanel({ project, sections }: { project: ProjectState; sections: ManuscriptSection[] }) {
  const [activeSection, setActiveSection] = useState<ManuscriptSection | null>(null)
  const chapters = project.framework?.chapters || []

  if (sections.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center px-8">
        <div>
          <div className="text-4xl mb-4 opacity-30">📖</div>
          <p className="font-serif text-xl text-parchment-300 mb-2">Manuscript in progress</p>
          <p className="text-parchment-500 text-sm max-w-sm leading-relaxed">
            Your ghostwriter will begin drafting sections as interviews progress. Sections appear here as they're written.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Section list */}
      <div className="w-64 flex-shrink-0 border-r border-ink-700 overflow-y-auto bg-ink-900">
        <div className="p-4 border-b border-ink-700">
          <div className="font-serif text-sm text-parchment-200 mb-1">{project.title}</div>
          <div className="text-ink-400 text-xs">{Math.round((project.total_words || 0) / 1000)}k words</div>
        </div>
        {chapters.map(chapter => {
          const chapterSections = sections.filter(s => s.chapter_id === chapter.id)
          return (
            <div key={chapter.id}>
              <div className="px-4 py-2 bg-ink-800/50 border-b border-ink-700">
                <div className="text-ink-400 text-xs uppercase tracking-wider">Ch. {chapter.number}</div>
                <div className="text-parchment-300 text-xs font-medium truncate">{chapter.title}</div>
              </div>
              {chapterSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section)}
                  className={`
                    w-full text-left px-4 py-2.5 border-b border-ink-800 transition-colors
                    ${activeSection?.id === section.id ? 'bg-gold-500/10' : 'hover:bg-ink-800'}
                  `}
                >
                  <div className="text-parchment-300 text-xs font-medium truncate">{section.section_title}</div>
                  <div className="text-ink-500 text-xs mt-0.5">
                    {section.status === 'placeholder' ? '—' : `${section.word_count}w`}
                  </div>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection ? (
          <div className="max-w-2xl mx-auto px-8 py-10">
            <div className="text-ink-400 text-xs uppercase tracking-wider mb-2">
              Chapter {activeSection.chapter_number} · Section {activeSection.section_number}
            </div>
            <h1 className="font-serif text-3xl text-parchment-100 mb-1 font-medium">{activeSection.section_title}</h1>
            <h2 className="font-serif text-lg text-parchment-400 mb-8">{activeSection.chapter_title}</h2>

            {activeSection.status === 'placeholder' || !activeSection.content ? (
              <div className="border-2 border-dashed border-ink-700 rounded-xl p-8 text-center">
                <p className="text-parchment-500 text-sm italic">This section hasn't been written yet.</p>
                <p className="text-ink-500 text-xs mt-2">
                  Tell your ghostwriter you'd like to work on "{activeSection.section_title}"
                </p>
              </div>
            ) : (
              <div className="manuscript-prose">
                {activeSection.content.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center px-8">
            <p className="text-parchment-500 text-sm">Select a section to read</p>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================
// TranscriptsPanel component
// =============================================

function TranscriptsPanel({ project, sessions, onSessionAdded }: {
  project: ProjectState
  sessions: Session[]
  onSessionAdded: (session: Session) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    setUploadMsg('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', project.id)

    try {
      const res = await fetch('/api/transcripts/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.success) {
        setUploadMsg(`Transcript uploaded and analyzed. Session ${data.session_number} created.`)
        // Refresh sessions
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-parchment-100 mb-2">Session Transcripts</h2>
          <p className="text-parchment-400 text-sm leading-relaxed">
            Every conversation is saved here. You can also upload transcripts from interviews you've
            conducted with others — your ghostwriter will read them and extract the stories.
          </p>
        </div>

        {/* Upload */}
        <div className="bg-ink-900 border border-ink-700 rounded-2xl p-6 mb-8">
          <h3 className="font-serif text-lg text-parchment-100 mb-2">Upload a transcript</h3>
          <p className="text-parchment-400 text-sm mb-4">
            Accepted formats: .txt or .md. If the transcript has labelled speakers
            (e.g. "Interviewer:" or "Author:") it will be parsed automatically.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-ink-700 hover:bg-ink-600 disabled:opacity-50 text-parchment-200 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors border border-ink-600"
          >
            {uploading ? 'Processing…' : '⬆ Choose File'}
          </button>
          {uploadMsg && <p className="text-green-300 text-sm mt-3">{uploadMsg}</p>}
          {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
        </div>

        {/* Session list */}
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id} className="bg-ink-900 border border-ink-700 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-ink-700 text-ink-300 px-2 py-0.5 rounded-full">
                      {session.source === 'uploaded_transcript' ? '⬆ Uploaded' : '💬 Interview'}
                    </span>
                    <span className="text-ink-500 text-xs">Session {session.session_number}</span>
                  </div>
                  <div className="text-parchment-200 text-sm font-medium truncate">{session.title}</div>
                  {session.summary && (
                    <p className="text-parchment-500 text-xs mt-1.5 leading-relaxed line-clamp-2">{session.summary}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {session.stories_found > 0 && (
                    <div className="text-gold-400 text-xs mb-1">{session.stories_found} stories</div>
                  )}
                  <div className="text-ink-500 text-xs">{new Date(session.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-parchment-500 text-sm text-center py-8">No sessions yet. Start chatting!</p>
          )}
        </div>
      </div>
    </div>
  )
}
