'use client'

import React, { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyContent() {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    if (newCode.every(d => d !== '')) {
      handleVerify(newCode.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setCode(text.split(''))
      handleVerify(text)
    }
  }

  async function handleVerify(token: string) {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()

      if (data.success) {
        router.push(next)
      } else {
        setError(data.error || 'Invalid code. Please try again.')
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (_e) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-10 w-full max-w-sm page-enter text-center">
      <Link href="/" className="inline-flex items-center justify-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
          <span className="text-ink-900 font-serif font-bold">G</span>
        </div>
        <span className="font-serif text-xl text-parchment-100">AIGhostwriter</span>
      </Link>

      <div className="bg-ink-900 border border-ink-700 rounded-2xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-ink-800 border border-gold-500/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">🔐</span>
        </div>

        <h1 className="font-serif text-2xl text-parchment-100 font-medium mb-2">
          Two-factor verification
        </h1>
        <p className="text-parchment-400 text-sm mb-8 leading-relaxed">
          Enter the 6-digit code from your authenticator app to protect your manuscript.
        </p>

        <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
              className={`
                w-12 h-14 text-center text-xl font-mono font-medium
                bg-ink-800 border rounded-xl transition-all duration-200
                text-parchment-100 disabled:opacity-50
                ${digit
                  ? 'border-gold-500 bg-ink-700'
                  : 'border-ink-600 focus:border-gold-500'}
              `}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center gap-1.5 py-2">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}

        <p className="text-ink-400 text-xs mt-6">
          Don't have an authenticator app?{' '}
          <Link href="/auth/setup" className="text-gold-400 hover:text-gold-300 transition-colors">
            Set up 2FA
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 pointer-events-none" />
      <Suspense fallback={<div className="text-parchment-400">Loading…</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  )
}
