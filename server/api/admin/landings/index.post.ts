export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const hostname = cleanHostname(body?.hostname)
  const name = String(body?.name ?? '').trim() || hostname
  const [exists] = await query('SELECT 1 FROM landings WHERE hostname = $1', [hostname])
  if (exists) throw createError({ statusCode: 409, statusMessage: 'Лендинг з таким доменом уже є' })
  const [row] = await query<{ id: number }>(
    'INSERT INTO landings (name, hostname) VALUES ($1, $2) RETURNING id',
    [name.slice(0, 120), hostname],
  )
  await audit(admin.login, 'landing.create', `${name} (${hostname})`)
  return { id: row.id }
})
