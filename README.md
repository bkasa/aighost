# AIGhostwriter.org

A full-stack AI-powered ghostwriting service. Conducts 10–20+ hours of guided interviews with an author, builds a chapter framework, collects 50+ stories, and produces a complete manuscript draft in the author's voice.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 14 (App Router) |
| Database + Auth + Storage | Supabase (Postgres + RLS) |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Payments | Stripe (one-time, $2,500) |
| 2FA | TOTP via `otplib` (Google Authenticator compatible) |
| Deployment | Vercel |

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key
- A [Stripe](https://stripe.com) account
- A Vercel account (for deployment to aighostwriter.org)

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd aighost
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL` — from your Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (keep secret)

**Anthropic:**
- `ANTHROPIC_API_KEY` — from console.anthropic.com

**Stripe:**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — pk_live_... or pk_test_...
- `STRIPE_SECRET_KEY` — sk_live_... or sk_test_...
- `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard (after setting up webhook)
- `STRIPE_PRICE_ID` — optional, for preset price

**App:**
- `NEXT_PUBLIC_APP_URL` — https://aighostwriter.org (or localhost for dev)
- `APP_SECRET` — any long random string, used to encrypt TOTP secrets
- `TOTP_ISSUER` — display name in authenticator app (e.g. "AIGhostwriter")

### 3. Database setup

In your Supabase dashboard, go to **SQL Editor** and run:

```sql
-- Copy and paste the contents of:
supabase/migrations/001_initial.sql
```

Then in your Supabase dashboard:
1. Go to **Storage** → Create bucket `transcripts` (private)
2. Go to **Storage** → Create bucket `manuscripts` (private)
3. Go to **Auth** → **Settings** → Enable Email auth
4. Disable "Confirm email" if you want immediate access after signup (optional)

### 4. Stripe webhook

For local development, install the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

For production, add a webhook endpoint in the Stripe dashboard pointing to:
`https://aighostwriter.org/api/stripe/webhook`

Events to listen for:
- `checkout.session.completed`
- `payment_intent.payment_failed`

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment to Vercel

1. Push to GitHub
2. Import the repo in Vercel
3. Add all env variables in Vercel's project settings
4. Set `NEXT_PUBLIC_APP_URL=https://aighostwriter.org`
5. Connect your domain `aighostwriter.org` in Vercel

---

## User Flow

```
Landing page (aighostwriter.org)
  ↓  Enter email + pay $2,500 via Stripe
Payment success page
  ↓  Create password
Auth → Login page
  ↓  Sign in with email + password
2FA setup (first time)
  ↓  Scan QR code with authenticator app
2FA verify (every login)
  ↓  Enter 6-digit code
Project workspace
  ├── Interview tab (AI chat)
  ├── Framework tab (chapter structure)
  ├── Manuscript tab (read the draft)
  └── Transcripts tab (upload external interviews)
```

---

## AI Ghostwriter Behavior

The ghostwriter operates in phases:

| Phase | What it does |
|-------|-------------|
| `onboarding` | Learns who the author is, what the book is about, and who the audience is |
| `story_gathering` | Excavates 50+ stories through conversational interviews |
| `drafting` | Writes manuscript sections (800–1,200 words each) in the author's voice |
| `revision` | Accepts and evaluates author feedback; pushes back when needed |
| `proofing` | Final grammar and consistency check |

The AI maintains state by:
- Storing full message history per session in the database
- Maintaining a rolling `project_summary` (~500 words) as working memory
- Keeping structured JSON for the framework, stories, and author profile

---

## Architecture Notes

### State updates
After every AI response, the model appends a `<state_update>` JSON block. The API route parses this out, hides it from the author, and uses it to:
- Add stories to the database
- Update the chapter framework
- Write manuscript sections
- Update the project phase

### Writing quality
The system prompt includes an explicit list of forbidden AI-vocabulary words and anti-patterns derived from the Wikipedia field guide on signs of AI writing. The ghostwriter is trained to write specific > generic, concrete > abstract, story-first > lecture-first.

### Security
- Email + password auth via Supabase
- TOTP 2FA required for all workspace access (verified per-session via cookie)
- TOTP secrets encrypted at rest using AES-256-CBC
- Row-Level Security on all database tables
- Service role key never exposed to client

---

## File Structure

```
aighost/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── auth/
│   │   ├── login/page.tsx          # Step 1 auth
│   │   ├── verify/page.tsx         # Step 2 auth (2FA)
│   │   └── setup/page.tsx          # First-time 2FA setup
│   ├── checkout/                   # (handled via Stripe redirect)
│   ├── success/page.tsx            # Post-payment account creation
│   ├── dashboard/page.tsx          # Redirects to project
│   ├── project/[id]/page.tsx       # Main workspace
│   └── api/
│       ├── ghostwriter/chat/       # Streaming AI chat
│       ├── stripe/checkout/        # Create Stripe session
│       ├── stripe/webhook/         # Handle Stripe events
│       ├── auth/setup-2fa/         # Generate + verify TOTP
│       ├── auth/verify-2fa/        # Session 2FA verification
│       ├── manuscript/download/    # DOCX + TXT download
│       ├── transcripts/upload/     # Upload external transcripts
│       ├── sessions/create/        # New chat session
│       ├── sessions/[id]/messages/ # Load session messages
│       └── project/[id]/           # Refresh project state
├── components/
│   └── ProjectWorkspace.tsx        # Full workspace UI
├── lib/
│   ├── anthropic.ts                # Anthropic client
│   ├── stripe.ts                   # Stripe client
│   ├── types.ts                    # TypeScript types
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase
│   │   └── server.ts               # Server Supabase
│   └── prompts/
│       └── ghostwriter.ts          # The AI's complete instructions
├── middleware.ts                   # Auth + 2FA protection
└── supabase/
    └── migrations/001_initial.sql  # Full database schema
```

---

## License

Private — AIGhostwriter.org. All rights reserved.
