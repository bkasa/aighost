'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleGetStarted(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 overflow-hidden">
      {/* Background texture */}
      <div className="fixed inset-0 bg-paper-texture opacity-40 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 pointer-events-none" />

      {/* Ambient gold glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gold-500 opacity-[0.04] blur-[120px] pointer-events-none" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="px-8 py-6 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
              <span className="text-ink-900 text-xs font-serif font-bold">G</span>
            </div>
            <span className="font-serif text-lg text-parchment-100 tracking-wide">AIGhostwriter</span>
          </div>
          <button
            onClick={() => router.push('/auth/login')}
            className="text-parchment-300 hover:text-gold-400 text-sm font-medium transition-colors duration-200"
          >
            Sign In
          </button>
        </nav>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-8 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-ink-800 border border-gold-500/20 rounded-full px-4 py-1.5 mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
            <span className="text-gold-300 text-xs font-medium tracking-widest uppercase">Now Open</span>
          </div>

          <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl font-medium text-parchment-50 leading-[1.08] mb-8 tracking-tight">
            Your book has been
            <br />
            <em className="text-gold-400 not-italic">waiting to be told.</em>
          </h1>

          <p className="text-parchment-300 text-xl md:text-2xl font-light leading-relaxed max-w-2xl mx-auto mb-14">
            Through 10–20 hours of guided conversations, your AI ghostwriter
            will find your stories, shape your chapters, and write a full
            manuscript that sounds exactly like you.
          </p>

          {/* CTA Form */}
          <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-6">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 bg-ink-800 border border-ink-600 hover:border-gold-500/40 focus:border-gold-500 rounded-lg px-4 py-3.5 text-parchment-100 placeholder:text-ink-400 text-sm transition-all duration-200"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-gold-500 hover:bg-gold-400 disabled:opacity-60 disabled:cursor-not-allowed text-ink-900 font-semibold text-sm px-6 py-3.5 rounded-lg transition-all duration-200 whitespace-nowrap"
            >
              {loading ? 'Redirecting…' : 'Begin Your Book — $2,500'}
            </button>
          </form>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <p className="text-ink-400 text-sm">
            One-time payment. Full manuscript. No subscription.
          </p>
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-8 pb-24">
          <h2 className="font-serif text-3xl md:text-4xl text-parchment-100 text-center mb-16 font-medium">
            How it works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                number: '01',
                title: 'Conversation, not a form',
                body: 'Your ghostwriter starts with open questions and follows every thread with genuine curiosity. Most authors discover stories they'd forgotten they had.',
              },
              {
                number: '02',
                title: 'Your stories, organized',
                body: 'As you talk, a chapter framework takes shape — 8 to 15 chapters, each with sections designed to flex and move as the book grows.',
              },
              {
                number: '03',
                title: 'A draft that sounds like you',
                body: 'Once enough material is gathered, your ghostwriter writes each section in your voice, using your words and your way of seeing the world.',
              },
            ].map((step) => (
              <div key={step.number} className="relative p-8 bg-ink-900 rounded-2xl border border-ink-700 hover:border-gold-500/30 transition-all duration-300 group">
                <div className="font-serif text-5xl font-bold text-ink-700 group-hover:text-ink-600 transition-colors mb-4 leading-none">
                  {step.number}
                </div>
                <h3 className="font-serif text-xl text-parchment-100 mb-3 font-medium">{step.title}</h3>
                <p className="text-parchment-400 text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What's included */}
        <section className="max-w-4xl mx-auto px-8 pb-24">
          <div className="bg-ink-900 border border-gold-500/20 rounded-3xl p-10 md:p-14">
            <h2 className="font-serif text-3xl text-parchment-100 mb-10 font-medium text-center">
              What's included
            </h2>
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-5">
              {[
                '10–20+ hours of guided interviews',
                'Complete chapter + section framework',
                'Full manuscript draft (50,000–80,000 words)',
                '50+ stories excavated from your experience',
                'All session transcripts saved & downloadable',
                'Revision support with author feedback',
                'Final proofread for consistency & typos',
                'Download as DOCX or plain text anytime',
                'Upload external interview transcripts',
                'Invite guests to participate in sessions',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="text-gold-400 mt-0.5 flex-shrink-0">✦</span>
                  <span className="text-parchment-300 text-sm leading-relaxed">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-12 pt-10 border-t border-ink-700 text-center">
              <div className="font-serif text-5xl text-gold-400 font-medium mb-2">$2,500</div>
              <div className="text-parchment-400 text-sm mb-8">One-time. No recurring fees. Yours to keep.</div>
              <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 bg-ink-800 border border-ink-600 hover:border-gold-500/40 focus:border-gold-500 rounded-lg px-4 py-3.5 text-parchment-100 placeholder:text-ink-400 text-sm transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gold-500 hover:bg-gold-400 disabled:opacity-60 text-ink-900 font-semibold text-sm px-6 py-3.5 rounded-lg transition-all duration-200 whitespace-nowrap"
                >
                  Get Started
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-ink-800 py-10 text-center">
          <div className="text-ink-500 text-sm">
            © {new Date().getFullYear()} AIGhostwriter.org · All rights reserved
          </div>
        </footer>
      </div>
    </div>
  )
}
