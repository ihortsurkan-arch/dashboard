// Update a user's landings, role and/or password.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const [user] = await query<{ id: number; role: string }>('SELECT id, role FROM users WHERE id = $1', [id])
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Користувача не знайдено' })

  if (body?.role !== undefined) {
    const role = cleanRole(body.role)
    if (id === admin.id && role !== 'admin') {
      throw createError({ statusCode: 400, statusMessage: 'Не можна зняти права адміна з себе' })
    }
    await query('UPDATE users SET role = $2 WHERE id = $1', [id, role])
  }
  if (body?.password) {
    await query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, await hashPassword(cleanPassword(body.password))])
  }
  if (body?.landingIds !== undefined) await setUserLandings(id, cleanIds(body.landingIds))
  return { ok: true }
})
