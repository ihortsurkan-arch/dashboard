// Simple per-instance brute-force guard: 10 failed attempts per login+IP in 15 minutes.
const failures = new Map<string, { count: number; until: number }>()
const WINDOW_MS = 15 * 60 * 1000

export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: string; password?: string }>(event)
  const login = String(body?.login ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  if (!login || !password) throw createError({ statusCode: 400, statusMessage: 'Вкажіть логін і пароль' })

  const key = `${login}|${getRequestIP(event, { xForwardedFor: true }) ?? ''}`
  const now = Date.now()
  const f = failures.get(key)
  if (f && f.until > now && f.count >= 10) {
    throw createError({ statusCode: 429, statusMessage: 'Забагато спроб. Спробуйте пізніше' })
  }

  const [user] = await query<{ id: number; login: string; role: 'admin' | 'user'; password_hash: string }>(
    'SELECT id, login, role, password_hash FROM users WHERE login = $1',
    [login],
  )
  const ok = user ? await verifyPassword(user.password_hash, password) : false
  if (!user || !ok) {
    const cur = f && f.until > now ? f : { count: 0, until: now + WINDOW_MS }
    cur.count++
    failures.set(key, cur)
    throw createError({ statusCode: 401, statusMessage: 'Невірний логін або пароль' })
  }
  failures.delete(key)
  await setUserSession(event, { user: { id: user.id, login: user.login, role: user.role } })
  return { ok: true }
})
