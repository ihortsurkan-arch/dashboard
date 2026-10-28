export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [u] = await query<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE id = $1', [user.id])
  return { login: user.login, role: user.role, totpEnabled: !!u?.totp_enabled }
})
