import QRCode from 'qrcode'

// Creates a new (not yet active) secret and returns it as a QR code for the authenticator app.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [u] = await query<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE id = $1', [user.id])
  if (u?.totp_enabled) throw createError({ statusCode: 400, statusMessage: 'Двофакторний вхід уже ввімкнено' })
  const secret = newTotpSecret()
  await query('UPDATE users SET totp_secret = $2 WHERE id = $1', [user.id, secret])
  const url = otpauthUrl(secret, user.login)
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return { secret, qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }
})
