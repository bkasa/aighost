'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SetupPage() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'generate' | 'verify'>('generate')
  const router = useRouter()

  useEffect(() => {
    generateSecret()
  }, [])

  async function generateSecret() {
    try {
      const res = await fetch('/api/auth/setup-2fa')
      const data = await res.json()
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep('verify')
    } catch {
      setError('Failed to generate 2FA secret. Please refresh.')
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/setup-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()

    if (data.success) {
      // Also mark session as 2FA verified
      await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      router.push('/dashboard')
    } else {
      setError(data.error || 'Invalid code. Try again.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md page-enter">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
              <span className="text-ink-900 font-serif font-bold">G</span>
            </div>
            <span className="font-serif text-xl text-parchment-100">AIGhostwriter</span>
          </div>
        </div>

        <div className="bg-ink-900 border border-ink-700 rounded-2xl p-8">
          <h1 className="font-serif text-2xl text-parchment-100 font-medium mb-2 text-center">
            Secure your manuscript
          </h1>
          <p className="text-parchment-400 text-sm text-center mb-8 leading-relaxed">
            Two-factor authentication protects your work. Scan the QR code with
            Google Authenticator, Authy, or any TOTP app.
          </p>

          {qrCode && (
            <div className="mb-8">
              <div className="bg-white p-4 rounded-xl inline-block mx-auto flex justify-center mb-4">
                <img src={qrCode} alt="QR Code for 2FA" width={180} height={180} />
              </div>

              <div className="bg-ink-800 rounded-lg px-4 py-3 text-center">
                <p className="text-ink-400 text-xs mb-1 uppercase tracking-wider">Manual entry code</p>
                <code className="text-gold-300 font-mono text-sm tracking-widest">{secret}</code>
              </div>
            </div>
          )}

          {!qrCode && (
            <div className="flex justify-center py-12">
              <div className="flex gap-1.5">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-parchment-300 text-xs font-medium mb-1.5 uppercase tracking-wider">
                  Enter the 6-digit code to confirm setup
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={token}
                  onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="w-full bg-ink-800 border border-ink-600 focus:border-gold-500 rounded-lg px-4 py-3 text-parchment-100 placeholder:text-ink-400 text-center font-mono text-xl tracking-widest transition-all duration-200"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || token.length < 6}
                className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-60 disabled:cursor-not-allowed text-ink-900 font-semibold py-3.5 rounded-lg transition-all duration-200"
              >
                {loading ? 'Verifying…' : 'Enable 2FA & Continue'}
              </button>
            </form>
          )}
        </div>

        <p className="text-ink-500 text-xs text-center mt-4 leading-relaxed">
          You'll need this app every time you sign in.
          Save your backup codes somewhere safe.
        </p>
      </div>
    </div>
  )
}
