export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  await query('DELETE FROM landings WHERE id = $1', [id])
  return { ok: true }
})
