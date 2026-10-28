import type { H3Event } from 'h3'

// Challenges live in the database: serverless instances don't share memory.
export async function storeWebAuthnChallenge(_event: H3Event, challenge: string, attemptId: string) {
  await query("DELETE FROM webauthn_challenges WHERE created_at < now() - interval '10 minutes'")
  await query('INSERT INTO webauthn_challenges (attempt_id, challenge) VALUES ($1, $2)', [attemptId, challenge])
}

export async function takeWebAuthnChallenge(_event: H3Event, attemptId: string) {
  const [row] = await query<{ challenge: string }>(
    "DELETE FROM webauthn_challenges WHERE attempt_id = $1 AND created_at > now() - interval '10 minutes' RETURNING challenge",
    [attemptId],
  )
  if (!row) throw createError({ statusCode: 400, statusMessage: 'Час підтвердження минув, спробуйте ще раз' })
  return row.challenge
}

/** A readable default name for a new passkey, from the browser's user agent. */
export function deviceName(ua: string) {
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X|Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Пристрій'
}
