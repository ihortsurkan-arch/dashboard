export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const landing = await accessibleLanding(user, body?.landingId)
  const date = String(body?.date ?? '')
  const text = String(body?.text ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw createError({ statusCode: 400, statusMessage: 'Некоректна дата' })
  if (!text || text.length > 200) throw createError({ statusCode: 400, statusMessage: 'Текст позначки: 1–200 символів' })
  const [row] = await query<{ id: number }>(
    'INSERT INTO annotations (landing_id, date, text, user_id, author) VALUES ($1, $2::date, $3, $4, $5) RETURNING id',
    [landing.id, date, text, user.id, user.login],
  )
  return { id: row.id }
})
