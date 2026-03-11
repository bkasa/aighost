// =============================================
// Core domain types for AIGhostwriter
// =============================================

export type Phase =
  | 'onboarding'
  | 'story_gathering'
  | 'drafting'
  | 'revision'
  | 'proofing'
  | 'complete'

// --- Author & Book Brief ---

export interface AuthorProfile {
  name: string
  background: string       // professional background
  expertise: string[]      // key areas of expertise
  known_for: string        // what they're publicly recognized for
  writing_voice_notes: string  // notes on voice/style gathered during interviews
}

export interface BookBrief {
  working_title: string
  topic: string
  thesis: string           // the book's central argument/promise
  key_insights: string[]
  target_audience: string
  reader_benefits: string[]
  unique_qualification: string  // why this author uniquely should write this book
  estimated_chapters: number
  comparable_titles: string[]
}

// --- Framework ---

export interface Section {
  id: string               // e.g. "s1", "s2"
  number: number
  title: string
  description: string
  status: 'placeholder' | 'drafted' | 'revised' | 'approved'
  story_ids: string[]
  word_count?: number
}

export interface Chapter {
  id: string               // e.g. "ch1", "ch2"
  number: number
  title: string
  description: string
  core_message: string     // what this chapter should leave readers believing/feeling
  sections: Section[]
}

export interface Framework {
  chapters: Chapter[]
}

// --- Stories ---

export interface Story {
  id: string
  title: string
  summary: string
  key_lesson: string
  source: 'author_experience' | 'research' | 'client_case' | 'third_party' | 'anecdote'
  chapter_assigned?: string   // chapter id
  section_assigned?: string   // section id
  session_id?: string
  collected_at: string
}

// --- Project State ---

export interface ProjectState {
  id: string
  author_id: string
  title: string
  phase: Phase
  author_profile: Partial<AuthorProfile>
  book_brief: Partial<BookBrief>
  framework: Framework
  stories: Story[]
  project_summary: string   // running narrative summary for AI working memory
  total_stories: number
  total_words: number
  session_count: number
  created_at: string
  updated_at: string
}

// --- Sessions & Messages ---

export interface Session {
  id: string
  project_id: string
  session_number: number
  title: string
  source: 'chat' | 'uploaded_transcript'
  summary: string
  stories_found: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// --- Manuscript ---

export interface ManuscriptSection {
  id: string
  project_id: string
  chapter_id: string
  section_id: string
  chapter_number: number
  section_number: number
  chapter_title: string
  section_title: string
  content: string
  status: 'placeholder' | 'drafted' | 'revised' | 'approved'
  word_count: number
  story_ids: string[]
  created_at: string
  updated_at: string
}

// --- Post-AI-response state updates ---

export interface StateUpdate {
  framework_updated?: boolean
  new_framework?: Framework
  stories_extracted?: Story[]
  sections_written?: Array<{
    chapter_id: string
    section_id: string
    chapter_title: string
    section_title: string
    content: string
  }>
  project_summary_updated?: string
  phase_change?: Phase
  onboarding_data?: {
    author_profile?: Partial<AuthorProfile>
    book_brief?: Partial<BookBrief>
  }
}

// --- API payloads ---

export interface ChatRequest {
  project_id: string
  session_id: string
  message: string
  is_guest?: boolean
  guest_name?: string
}

export interface ChatResponse {
  reply: string
  state_update?: StateUpdate
}

// --- Profile ---

export interface Profile {
  id: string
  email: string
  full_name: string | null
  totp_enabled: boolean
  has_paid: boolean
  paid_at: string | null
  stripe_customer_id: string | null
  created_at: string
}
