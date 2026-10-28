import { createHash } from 'node:crypto'

// When NUXT_SESSION_PASSWORD isn't set, derive a stable session secret from the
// database connection string (already a secret in the environment), so one less
// variable has to be configured by hand. Setting NUXT_SESSION_PASSWORD overrides it.
export default defineNitroPlugin(() => {
  if (process.env.NUXT_SESSION_PASSWORD) return
  const base = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!base) return
  process.env.NUXT_SESSION_PASSWORD = createHash('sha256').update(`landing-stats-session:${base}`).digest('base64url')
})
