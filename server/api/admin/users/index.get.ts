export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const users = await query<{ id: number; login: string; role: string; created_at: string; landing_ids: number[] | null }>(
    `SELECT u.id, u.login, u.role, u.created_at, u.totp_enabled,
            array_remove(array_agg(ul.landing_id ORDER BY ul.landing_id), NULL) AS landing_ids
     FROM users u LEFT JOIN user_landings ul ON ul.user_id = u.id
     GROUP BY u.id, u.login, u.role, u.created_at, u.totp_enabled ORDER BY u.role, u.login`,
  )
  return users.map((u) => ({ ...u, landing_ids: u.landing_ids ?? [] }))
})
