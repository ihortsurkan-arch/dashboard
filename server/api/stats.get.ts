import type { Annotation, Goal } from '~~/shared/stats'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)
  const { from, to } = dateRange(q)
  const landing = await accessibleLanding(user, q.landing)
  const filters = cleanFilters(q)
  const fresh = q.fresh === '1'

  const [stats, goals, notes] = await Promise.all([
    getStats(landing, from, to, filters, fresh),
    query<Goal>('SELECT month, leads FROM goals WHERE landing_id = $1 AND month = $2', [landing.id, new Date().toISOString().slice(0, 7)]),
    query<{ id: number; date: string; text: string; author: string; user_id: number | null }>(
      `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, text, author, user_id FROM annotations
       WHERE landing_id = $1 AND date BETWEEN $2::date AND $3::date ORDER BY date, id`,
      [landing.id, from, to],
    ),
  ])
  const annotations: Annotation[] = notes.map((n) => ({
    id: n.id, date: n.date, text: n.text, author: n.author, canDelete: user.role === 'admin' || n.user_id === user.id,
  }))
  setHeader(event, 'Cache-Control', 'private, no-store')
  return { ...stats, goal: goals[0] ?? null, annotations }
})
