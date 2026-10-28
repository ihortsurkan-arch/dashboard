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
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS goals (
  landing_id INTEGER NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  leads INTEGER NOT NULL CHECK (leads > 0),
  PRIMARY KEY (landing_id, month)
);
CREATE TABLE IF NOT EXISTS annotations (
  id SERIAL PRIMARY KEY,
  landing_id INTEGER NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  text TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS annotations_landing_date ON annotations (landing_id, date);
CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  backed_up BOOLEAN NOT NULL DEFAULT FALSE,
  transports TEXT NOT NULL DEFAULT '[]',
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  attempt_id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT ''
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

/**
 * First admin from NUXT_ADMIN_LOGIN / NUXT_ADMIN_PASSWORD while there are no users.
 * Later, changing NUXT_ADMIN_PASSWORD in the environment (and redeploying) resets that admin's
 * password once: only a fingerprint of the applied value is kept, so a password changed in the
 * app is not overwritten until the variable itself changes again.
 */
async function ensureFirstAdmin(run: Runner) {
  const { adminLogin, adminPassword } = useRuntimeConfig()
  if (!adminLogin || !adminPassword) return
  const login = adminLogin.trim().toLowerCase()
  const { createHash } = await import('node:crypto')
  const fingerprint = createHash('sha256').update(`admin-password:${login}:${adminPassword}`).digest('hex')
  const remember = () => run(
    `INSERT INTO settings (key, value) VALUES ('admin_password_applied', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [fingerprint])

  const [{ n }] = await run('SELECT count(*)::int AS n FROM users')
  if (n === 0) {
    await run(`INSERT INTO users (login, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (login) DO NOTHING`,
      [login, await hashPassword(adminPassword)])
    await remember()
    return
  }
  const [applied] = await run(`SELECT value FROM settings WHERE key = 'admin_password_applied'`)
  if (applied?.value === fingerprint) return
  if (!applied) {
    // First run of this version: reset only if the stored password differs from the variable
    const [u] = await run('SELECT password_hash FROM users WHERE login = $1', [login])
    if (u && await verifyPassword(u.password_hash, adminPassword)) { await remember(); return }
  }

  // The variable changed: reset (or recreate) this admin with the new password
  const hash = await hashPassword(adminPassword)
  const updated = await run(`UPDATE users SET password_hash = $2, role = 'admin', totp_enabled = FALSE, totp_secret = NULL WHERE login = $1 RETURNING id`, [login, hash])
  if (!updated.length) await run(`INSERT INTO users (login, password_hash, role) VALUES ($1, $2, 'admin')`, [login, hash])
  await remember()
  await run(`INSERT INTO audit_log (actor, action, details) VALUES ('system', 'admin.password.reset', $1)`, [login])
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await runner()
  return (await run(text, params)) as T[]
}
