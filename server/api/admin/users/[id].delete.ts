export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  if (id === admin.id) throw createError({ statusCode: 400, statusMessage: 'Не можна видалити себе' })
  await query('DELETE FROM users WHERE id = $1', [id])
  return { ok: true }
})
