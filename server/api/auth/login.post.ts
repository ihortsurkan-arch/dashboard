// Simple per-instance brute-force guard: 10 failed attempts per login+IP in 15 minutes.
const failures = new Map<string, { count: number; until: number }>()
const WINDOW_MS = 15 * 60 * 1000

export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: string; password?: string; code?: string }>(event)
  const login = String(body?.login ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  if (!login || !password) throw createError({ statusCode: 400, statusMessage: 'Вкажіть логін і пароль' })

  const key = `${login}|${getRequestIP(event, { xForwardedFor: true }) ?? ''}`
  const now = Date.now()
  const f = failures.get(key)
  if (f && f.until > now && f.count >= 10) {
    throw createError({ statusCode: 429, statusMessage: 'Забагато спроб. Спробуйте пізніше' })
  }

  const [user] = await query<{ id: number; login: string; role: 'admin' | 'user'; password_hash: string; totp_enabled: boolean; totp_secret: string | null }>(
    'SELECT id, login, role, password_hash, totp_enabled, totp_secret FROM users WHERE login = $1',
    [login],
  )
  const ok = user ? await verifyPassword(user.password_hash, password) : false
  const fail = async (message: string, data?: Record<string, unknown>) => {
    const cur = f && f.until > now ? f : { count: 0, until: now + WINDOW_MS }
    cur.count++
    failures.set(key, cur)
    await audit(login, 'login.fail', message)
    throw createError({ statusCode: 401, statusMessage: message, data })
  }
  if (!user || !ok) await fail('Невірний логін або пароль')
  // Second factor: password was right, now the 6-digit code from the authenticator app
  if (user!.totp_enabled && user!.totp_secret) {
    if (!body?.code) throw createError({ statusCode: 401, statusMessage: 'Введіть код з додатка-автентифікатора', data: { totp: true } })
    if (!verifyTotp(user!.totp_secret, body.code)) await fail('Невірний код', { totp: true })
  }
  failures.delete(key)
  await setUserSession(event, { user: { id: user!.id, login: user!.login, role: user!.role } })
  await audit(user!.login, 'login', '')
  return { ok: true }
})
