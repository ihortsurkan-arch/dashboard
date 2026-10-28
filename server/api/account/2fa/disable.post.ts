export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const [u] = await query<{ totp_secret: string | null; totp_enabled: boolean }>('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [user.id])
  if (!u?.totp_enabled || !u.totp_secret) return { ok: true }
  if (!verifyTotp(u.totp_secret, body?.code)) throw createError({ statusCode: 400, statusMessage: 'Код не підходить' })
  await query('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1', [user.id])
  await audit(user.login, 'account.2fa.disable', '')
  return { ok: true }
})
