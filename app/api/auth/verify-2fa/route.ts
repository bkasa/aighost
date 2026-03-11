import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decryptSecret } from '../setup-2fa/route'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const serviceSupabase = await createServiceClient()
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('totp_secret, totp_enabled')
    .eq('id', user.id)
    .single()

  if (!profile?.totp_secret || !profile.totp_enabled) {
    return NextResponse.json({ error: '2FA not configured' }, { status: 400 })
  }

  const secret = decryptSecret(profile.totp_secret)
  const isValid = authenticator.check(token, secret)

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  }

  // Set a session cookie marking 2FA as verified
  const response = NextResponse.json({ success: true })
  response.cookies.set('totp_verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })

  return response
}
