-- AIGhostwriter.org Database Schema
-- Run this in your Supabase SQL editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USERS / AUTHORS
-- =============================================

-- The auth.users table is managed by Supabase Auth.
-- We extend it with a profiles table.

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  totp_secret   TEXT,            -- encrypted TOTP secret for 2FA
  totp_enabled  BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  has_paid      BOOLEAN DEFAULT FALSE,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================
-- PROJECTS (one per author/book)
-- =============================================

CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT DEFAULT 'Untitled Book',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  -- Phase tracking
  phase         TEXT DEFAULT 'onboarding'
                  CHECK (phase IN ('onboarding','story_gathering','drafting','revision','proofing','complete')),

  -- Structured project state (JSON)
  author_profile  JSONB DEFAULT '{}'::jsonb,   -- name, background, expertise, known_for
  book_brief      JSONB DEFAULT '{}'::jsonb,   -- topic, thesis, audience, benefits, unique_qualification
  framework       JSONB DEFAULT '{"chapters":[]}'::jsonb,  -- chapters + sections
  stories         JSONB DEFAULT '[]'::jsonb,   -- collected stories array
  
  -- Running summary the AI uses as working memory between sessions
  project_summary TEXT DEFAULT '',
  
  -- Stats
  total_stories   INT DEFAULT 0,
  total_words     INT DEFAULT 0,
  session_count   INT DEFAULT 0
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = author_id);

-- =============================================
-- MANUSCRIPT SECTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.manuscript_sections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chapter_id      TEXT NOT NULL,   -- e.g. "ch1"
  section_id      TEXT NOT NULL,   -- e.g. "s1"
  chapter_number  INT NOT NULL,
  section_number  INT NOT NULL,
  chapter_title   TEXT NOT NULL,
  section_title   TEXT NOT NULL,
  content         TEXT DEFAULT '',  -- the actual written prose
  status          TEXT DEFAULT 'placeholder'
                    CHECK (status IN ('placeholder','drafted','revised','approved')),
  word_count      INT DEFAULT 0,
  story_ids       TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (project_id, chapter_id, section_id)
);

ALTER TABLE public.manuscript_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage own sections"
  ON public.manuscript_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = manuscript_sections.project_id
        AND p.author_id = auth.uid()
    )
  );

-- =============================================
-- SESSIONS (interview/conversation sessions)
-- =============================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_number INT NOT NULL,
  title         TEXT DEFAULT 'Session',
  source        TEXT DEFAULT 'chat'
                  CHECK (source IN ('chat', 'uploaded_transcript')),
  summary       TEXT DEFAULT '',   -- AI-generated session summary
  stories_found INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage own sessions"
  ON public.sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = sessions.project_id
        AND p.author_id = auth.uid()
    )
  );

-- =============================================
-- MESSAGES (individual turns in a session)
-- =============================================

CREATE TABLE IF NOT EXISTS public.messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage own messages"
  ON public.messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = messages.project_id
        AND p.author_id = auth.uid()
    )
  );

CREATE INDEX idx_messages_session ON public.messages(session_id, created_at);
CREATE INDEX idx_messages_project ON public.messages(project_id, created_at);

-- =============================================
-- GUEST PARTICIPANTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.guest_invites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  invite_token  TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  guest_name    TEXT,
  guest_email   TEXT,
  expires_at    TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  used          BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.guest_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage invites"
  ON public.guest_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = guest_invites.project_id
        AND p.author_id = auth.uid()
    )
  );

-- =============================================
-- STORAGE BUCKETS (set up via Supabase dashboard)
-- =============================================
-- Create bucket: "transcripts" (private)
-- Create bucket: "manuscripts" (private)

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sections_updated_at
  BEFORE UPDATE ON public.manuscript_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update word count when section content changes
CREATE OR REPLACE FUNCTION update_project_word_count()
RETURNS TRIGGER AS $$
DECLARE
  total_wc INT;
BEGIN
  SELECT COALESCE(SUM(word_count), 0)
  INTO total_wc
  FROM public.manuscript_sections
  WHERE project_id = NEW.project_id;

  UPDATE public.projects
  SET total_words = total_wc
  WHERE id = NEW.project_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER section_word_count_trigger
  AFTER INSERT OR UPDATE ON public.manuscript_sections
  FOR EACH ROW EXECUTE FUNCTION update_project_word_count();
