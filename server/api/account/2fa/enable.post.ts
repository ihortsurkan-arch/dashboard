export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const [u] = await query<{ totp_secret: string | null }>('SELECT totp_secret FROM users WHERE id = $1', [user.id])
  if (!u?.totp_secret) throw createError({ statusCode: 400, statusMessage: 'Спершу відскануйте QR-код' })
  if (!verifyTotp(u.totp_secret, body?.code)) throw createError({ statusCode: 400, statusMessage: 'Код не підходить. Перевірте час на телефоні й спробуйте ще раз' })
  await query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [user.id])
  await audit(user.login, 'account.2fa.enable', '')
  return { ok: true }
})
