export function cleanLogin(v: unknown): string {
  const login = String(v ?? '').trim().toLowerCase()
  if (!/^[a-z0-9._@-]{3,64}$/.test(login)) {
    throw createError({ statusCode: 400, statusMessage: 'Логін: 3–64 символи, латиниця, цифри, . _ @ -' })
  }
  return login
}

export function cleanPassword(v: unknown): string {
  const p = String(v ?? '')
  if (p.length < 8 || p.length > 200) throw createError({ statusCode: 400, statusMessage: 'Пароль: щонайменше 8 символів' })
  return p
}

export function cleanRole(v: unknown): 'admin' | 'user' {
  return v === 'admin' ? 'admin' : 'user'
}

export function cleanIds(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
}

export function cleanHostname(v: unknown): string {
  let h = String(v ?? '').trim().toLowerCase()
  h = h.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) throw createError({ statusCode: 400, statusMessage: 'Некоректний домен лендингу' })
  return h
}

export async function setUserLandings(userId: number, landingIds: number[]) {
  await query('DELETE FROM user_landings WHERE user_id = $1', [userId])
  if (landingIds.length) {
    await query(
      `INSERT INTO user_landings (user_id, landing_id)
       SELECT $1, id FROM landings WHERE id = ANY($2::int[]) ON CONFLICT DO NOTHING`,
      [userId, landingIds],
    )
  }
}
