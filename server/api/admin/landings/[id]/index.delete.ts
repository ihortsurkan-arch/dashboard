export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  const [l] = await query<{ name: string; hostname: string }>('SELECT name, hostname FROM landings WHERE id = $1', [id])
  await query('DELETE FROM landings WHERE id = $1', [id])
  if (l) await audit(admin.login, 'landing.delete', `${l.name} (${l.hostname})`)
  return { ok: true }
})
