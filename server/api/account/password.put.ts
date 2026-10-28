export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const [u] = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id])
  if (!u || !(await verifyPassword(u.password_hash, String(body?.current ?? '')))) {
    throw createError({ statusCode: 400, statusMessage: 'Поточний пароль невірний' })
  }
  const next = cleanPassword(body?.next)
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, await hashPassword(next)])
  await audit(user.login, 'account.password', '')
  return { ok: true }
})
