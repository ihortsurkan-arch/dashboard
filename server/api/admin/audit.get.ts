export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return query<{ id: number; at: string; actor: string; action: string; details: string }>(
    'SELECT id, at, actor, action, details FROM audit_log ORDER BY id DESC LIMIT 300',
  )
})
