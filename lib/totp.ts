import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

export function encryptSecret(secret: string): string {
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
