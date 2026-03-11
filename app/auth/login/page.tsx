'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Check if 2FA is enabled — redirect to verify or dashboard
      const { data: profile } = await supabase
        .from('profiles')
        .select('totp_enabled, has_paid')
        .eq('email', email)
        .single()

      if (profile?.totp_enabled) {
        router.push('/auth/verify')
      } else if (!profile?.has_paid) {
        router.push('/?needs_payment=true')
      } else {
        router.push('/auth/setup')
      }
    } else {
      // Register
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setMessage('Check your email for a confirmation link, then come back to sign in.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 pointer-events-none" />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gold-500 opacity-[0.03] blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm page-enter">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
              <span className="text-ink-900 font-serif font-bold">G</span>
            </div>
            <span className="font-serif text-xl text-parchment-100">AIGhostwriter</span>
          </Link>
          <h1 className="font-serif text-2xl text-parchment-100 font-medium">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-parchment-400 text-sm mt-2">
            {mode === 'login'
              ? 'Sign in to continue your book'
              : 'Already have an account?'}
            {' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMessage('') }}
              className="text-gold-400 hover:text-gold-300 transition-colors"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-parchment-300 text-xs font-medium mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full bg-ink-800 border border-ink-600 focus:border-gold-500 rounded-lg px-4 py-3 text-parchment-100 placeholder:text-ink-400 text-sm transition-all duration-200"
              />
            </div>
          )}

          <div>
            <label className="block text-parchment-300 text-xs font-medium mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-ink-800 border border-ink-600 focus:border-gold-500 rounded-lg px-4 py-3 text-parchment-100 placeholder:text-ink-400 text-sm transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-parchment-300 text-xs font-medium mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full bg-ink-800 border border-ink-600 focus:border-gold-500 rounded-lg px-4 py-3 text-parchment-100 placeholder:text-ink-400 text-sm transition-all duration-200"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg px-4 py-3 text-green-300 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-60 disabled:cursor-not-allowed text-ink-900 font-semibold py-3.5 rounded-lg transition-all duration-200 mt-2"
          >
            {loading
              ? 'One moment…'
              : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-ink-900 border border-ink-700 rounded-xl">
          <p className="text-ink-400 text-xs text-center leading-relaxed">
            🔒 Two-factor authentication is required to protect your manuscript.
            You'll set it up after signing in.
          </p>
        </div>
      </div>
    </div>
  )
}
