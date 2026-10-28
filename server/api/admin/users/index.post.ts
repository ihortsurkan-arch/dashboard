export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const login = cleanLogin(body?.login)
  const password = cleanPassword(body?.password)
  const role = cleanRole(body?.role)
  const [exists] = await query('SELECT 1 FROM users WHERE login = $1', [login])
  if (exists) throw createError({ statusCode: 409, statusMessage: 'Такий логін уже є' })
  const [user] = await query<{ id: number }>(
    'INSERT INTO users (login, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
    [login, await hashPassword(password), role],
  )
  await setUserLandings(user.id, cleanIds(body?.landingIds))
  return { id: user.id }
})
