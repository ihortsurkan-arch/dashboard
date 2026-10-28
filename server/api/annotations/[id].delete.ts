export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = intParam(getRouterParam(event, 'id'))
  const [note] = await query<{ landing_id: number; user_id: number | null }>('SELECT landing_id, user_id FROM annotations WHERE id = $1', [id])
  if (!note) throw createError({ statusCode: 404, statusMessage: 'Позначку не знайдено' })
  await accessibleLanding(user, note.landing_id)
  if (user.role !== 'admin' && note.user_id !== user.id) throw createError({ statusCode: 403, statusMessage: 'Можна видаляти лише свої позначки' })
  await query('DELETE FROM annotations WHERE id = $1', [id])
  return { ok: true }
})
