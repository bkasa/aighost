import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

function encryptSecret(secret: string): string {
  const key = scryptSync(process.env.APP_SECRET!, 'salt', 32)
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptSecret(encryptedSecret: string): string {
  const [ivHex, encryptedHex] = encryptedSecret.split(':')
  const key = scryptSync(process.env.APP_SECRET!, 'salt', 32)
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString()
}

// Generate a new TOTP secret and QR code
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = authenticator.generateSecret()
  const issuer = process.env.TOTP_ISSUER || 'AIGhostwriter'
  const otpauth = authenticator.keyuri(user.email!, issuer, secret)
  const qrCode = await QRCode.toDataURL(otpauth)

  // Temporarily store secret (not yet confirmed)
  const serviceSupabase = await createServiceClient()
  const encryptedSecret = encryptSecret(secret)
  await serviceSupabase.from('profiles').update({
    totp_secret: encryptedSecret,
    totp_enabled: false, // not enabled until verified
  }).eq('id', user.id)

  return NextResponse.json({ secret, qrCode })
}

// Verify TOTP token and enable 2FA
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const serviceSupabase = await createServiceClient()
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('totp_secret')
    .eq('id', user.id)
    .single()

  if (!profile?.totp_secret) {
    return NextResponse.json({ error: 'No TOTP secret found. Generate one first.' }, { status: 400 })
  }

  const secret = decryptSecret(profile.totp_secret)
  const isValid = authenticator.check(token, secret)

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  await serviceSupabase.from('profiles').update({
    totp_enabled: true,
  }).eq('id', user.id)

  return NextResponse.json({ success: true })
}
