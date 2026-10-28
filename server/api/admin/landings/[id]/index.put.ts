export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = intParam(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const hostname = cleanHostname(body?.hostname)
  const name = String(body?.name ?? '').trim() || hostname
  const [clash] = await query('SELECT 1 FROM landings WHERE hostname = $1 AND id <> $2', [hostname, id])
  if (clash) throw createError({ statusCode: 409, statusMessage: 'Лендинг з таким доменом уже є' })
  await query('UPDATE landings SET name = $2, hostname = $3 WHERE id = $1', [id, name.slice(0, 120), hostname])
  await audit(admin.login, 'landing.update', `#${id} ${name} (${hostname})`)
  return { ok: true }
})
