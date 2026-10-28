import type { H3Event } from 'h3'

export interface DbUser {
  id: number
  login: string
  role: 'admin' | 'user'
}

declare module '#auth-utils' {
  interface User {
    id: number
    login: string
    role: 'admin' | 'user'
  }
}

/** Session user, re-checked against the database so a deleted user loses access at once. */
export async function requireUser(event: H3Event): Promise<DbUser> {
  const session = await requireUserSession(event)
  const [user] = await query<DbUser>('SELECT id, login, role FROM users WHERE id = $1', [session.user.id])
  if (!user) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (user.role !== session.user.role) await setUserSession(event, { user })
  return user
}

export async function requireAdmin(event: H3Event): Promise<DbUser> {
  const user = await requireUser(event)
  if (user.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}

export interface Landing {
  id: number
  name: string
  hostname: string
}

export async function landingsFor(user: DbUser): Promise<Landing[]> {
  if (user.role === 'admin') {
    return query<Landing>('SELECT id, name, hostname FROM landings ORDER BY name')
  }
  return query<Landing>(
    `SELECT l.id, l.name, l.hostname FROM landings l
     JOIN user_landings ul ON ul.landing_id = l.id
     WHERE ul.user_id = $1 ORDER BY l.name`,
    [user.id],
  )
}

export function intParam(value: unknown, name = 'id'): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` })
  return n
}
