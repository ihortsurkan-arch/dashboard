import postgres from 'postgres'

type Row = Record<string, any>
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>

let runnerPromise: Promise<Runner> | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS landings (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_landings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  landing_id INTEGER NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, landing_id)
);
`

async function createRunner(): Promise<Runner> {
  // NUXT_DATABASE_URL, or the variables Vercel/Neon add when a database is connected
  const databaseUrl = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  if (databaseUrl) {
    const sql = postgres(databaseUrl, { max: 3, idle_timeout: 20, prepare: false })
    await sql.unsafe(SCHEMA)
    return (text, params = []) => sql.unsafe(text, params as any[]) as unknown as Promise<Row[]>
  }
  if (!import.meta.dev) throw new Error('NUXT_DATABASE_URL is not set')
  // Local development: embedded Postgres (PGlite) stored in .data/db
  // Imported by a variable name so the production bundle doesn't include PGlite.
  const pkg = '@electric-sql/pglite'
  const { PGlite } = await import(/* @vite-ignore */ pkg)
  const { mkdirSync } = await import('node:fs')
  mkdirSync('./.data', { recursive: true })
  const db = new PGlite('./.data/db')
  await db.exec(SCHEMA)
  return async (text, params = []) => (await db.query(text, params as any[])).rows as Row[]
}

async function runner(): Promise<Runner> {
  if (!runnerPromise) {
    runnerPromise = createRunner().then(async (run) => {
      await ensureFirstAdmin(run)
      return run
    }).catch((e) => {
      runnerPromise = null
      throw e
    })
  }
  return runnerPromise
}

async function ensureFirstAdmin(run: Runner) {
  const { adminLogin, adminPassword } = useRuntimeConfig()
  const [{ n }] = await run('SELECT count(*)::int AS n FROM users')
  if (n > 0 || !adminLogin || !adminPassword) return
  await run(
    `INSERT INTO users (login, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (login) DO NOTHING`,
    [adminLogin.trim().toLowerCase(), await hashPassword(adminPassword)],
  )
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await runner()
  return (await run(text, params)) as T[]
}
