export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  if (id === admin.id) throw createError({ statusCode: 400, statusMessage: 'Не можна видалити себе' })
  const [u] = await query<{ login: string }>('SELECT login FROM users WHERE id = $1', [id])
  await query('DELETE FROM users WHERE id = $1', [id])
  if (u) await audit(admin.login, 'user.delete', u.login)
  return { ok: true }
})
