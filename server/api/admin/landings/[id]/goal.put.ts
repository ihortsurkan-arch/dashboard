// Monthly lead plan for a landing. leads = 0 or empty removes the plan for that month.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const month = String(body?.month ?? new Date().toISOString().slice(0, 7))
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw createError({ statusCode: 400, statusMessage: 'Некоректний місяць' })
  const leads = Math.round(Number(body?.leads ?? 0))
  const [l] = await query<{ hostname: string }>('SELECT hostname FROM landings WHERE id = $1', [id])
  if (!l) throw createError({ statusCode: 404, statusMessage: 'Лендинг не знайдено' })
  if (!Number.isFinite(leads) || leads <= 0) {
    await query('DELETE FROM goals WHERE landing_id = $1 AND month = $2', [id, month])
    await audit(admin.login, 'goal.remove', `${l.hostname} ${month}`)
    return { ok: true }
  }
  if (leads > 1_000_000) throw createError({ statusCode: 400, statusMessage: 'Занадто великий план' })
  await query(
    'INSERT INTO goals (landing_id, month, leads) VALUES ($1, $2, $3) ON CONFLICT (landing_id, month) DO UPDATE SET leads = EXCLUDED.leads',
    [id, month, leads],
  )
  await audit(admin.login, 'goal.set', `${l.hostname} ${month}: ${leads}`)
  return { ok: true }
})
