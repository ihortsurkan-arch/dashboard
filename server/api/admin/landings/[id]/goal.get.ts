export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  const month = new Date().toISOString().slice(0, 7)
  const [g] = await query<{ leads: number }>('SELECT leads FROM goals WHERE landing_id = $1 AND month = $2', [id, month])
  return { month, leads: g?.leads ?? null }
})
