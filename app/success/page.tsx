'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function SuccessContent() {
  const [step, setStep] = useState<'confirm' | 'create-account' | 'done'>('confirm')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email') || ''
  const supabase = createClient()

  useEffect(() => {
    setTimeout(() => setStep('create-account'), 1500)
  }, [])

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/setup` },
    })

    if (error) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) {
        setError(loginError.message)
        setLoading(false)
        return
      }
    }

    setStep('done')
    setTimeout(() => router.push('/auth/setup'), 2000)
    setLoading(false)
  }

  return (
    <div className="relative z-10 w-full max-w-md page-enter">
      {step === 'confirm' && (
        <div className="text-center">
          <div className="text-5xl mb-6 animate-bounce">✨</div>
          <h1 className="font-serif text-3xl text-parchment-100 mb-3">Payment confirmed.</h1>
          <p className="text-parchment-400">Setting up your workspace…</p>
        </div>
      )}

      {step === 'create-account' && (
        <div className="bg-ink-900 border border-ink-700 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">📖</div>
            <h1 className="font-serif text-2xl text-parchment-100 font-medium mb-2">
              Create your account
            </h1>
            <p className="text-parchment-400 text-sm">
              Your payment was successful. Create a password to access your ghostwriting workspace.
            </p>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="block text-parchment-300 text-xs font-medium mb-1.5 uppercase tracking-wider">Email</label>
              <div className="bg-ink-800 border border-ink-700 rounded-lg px-4 py-3 text-parchment-400 text-sm">
                {email}
              </div>
            </div>
            <div>
              <label className="block text-parchment-300 text-xs font-medium mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
                className="w-full bg-ink-800 border border-ink-600 focus:border-gold-500 rounded-lg px-4 py-3 text-parchment-100 placeholder:text-ink-400 text-sm transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-parchment-300 text-xs font-medium mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-ink-800 border border-ink-600 focus:border-gold-500 rounded-lg px-4 py-3 text-parchment-100 placeholder:text-ink-400 text-sm transition-all duration-200"
              />
            </div>
            {error && <p className="text-red-300 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-60 text-ink-900 font-semibold py-3.5 rounded-lg transition-all duration-200"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center">
          <div className="text-5xl mb-6">🎉</div>
          <h1 className="font-serif text-3xl text-parchment-100 mb-3">You're all set.</h1>
          <p className="text-parchment-400">Redirecting to your workspace…</p>
        </div>
      )}
    </div>
  )
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 pointer-events-none" />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gold-500 opacity-[0.04] blur-[120px] pointer-events-none" />
      <Suspense fallback={<div className="text-parchment-400">Loading…</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  )
}
