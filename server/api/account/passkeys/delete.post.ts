export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const id = String(body?.id ?? '')
  const [row] = await query<{ name: string }>('DELETE FROM passkeys WHERE id = $1 AND user_id = $2 RETURNING name', [id, user.id])
  if (row) await audit(user.login, 'passkey.remove', row.name)
  return { ok: true }
})
