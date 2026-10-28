import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — what Google Authenticator, 1Password, Authy expect.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function newTotpSecret(): string {
  const bytes = randomBytes(20)
  let bits = ''
  for (const b of bytes) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function base32Decode(s: string): Buffer {
  let bits = ''
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = ALPHABET.indexOf(c)
    if (v < 0) continue
    bits += v.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function codeAt(secret: string, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const off = h[h.length - 1] & 0xf
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(bin % 1_000_000).padStart(6, '0')
}

/** Accepts the current code and one step either side, for clock drift. */
export function verifyTotp(secret: string, code: unknown): boolean {
  const c = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return false
  const step = Math.floor(Date.now() / 30_000)
  return [-1, 0, 1].some((d) => {
    const expected = Buffer.from(codeAt(secret, step + d))
    return timingSafeEqual(expected, Buffer.from(c))
  })
}

export function otpauthUrl(secret: string, login: string) {
  const label = encodeURIComponent(`Landing Stats:${login}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Landing Stats')}&algorithm=SHA1&digits=6&period=30`
}
