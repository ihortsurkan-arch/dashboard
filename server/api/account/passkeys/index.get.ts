export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return query<{ id: string; name: string; created_at: string; last_used_at: string | null }>(
    'SELECT id, name, created_at, last_used_at FROM passkeys WHERE user_id = $1 ORDER BY created_at', [user.id],
  )
})
