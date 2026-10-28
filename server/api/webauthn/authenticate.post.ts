// Signs in with a passkey; no login or password needed.
export default defineWebAuthnAuthenticateEventHandler({
  storeChallenge: storeWebAuthnChallenge,
  getChallenge: takeWebAuthnChallenge,
  async getCredential(_event, credentialId) {
    const [row] = await query<{ id: string; public_key: string; counter: string | number; transports: string; backed_up: boolean }>(
      'SELECT id, public_key, counter, transports, backed_up FROM passkeys WHERE id = $1', [credentialId],
    )
    if (!row) throw createError({ statusCode: 400, statusMessage: 'Цей ключ доступу не привʼязаний до жодного акаунта' })
    return { id: row.id, publicKey: row.public_key, counter: Number(row.counter), backedUp: row.backed_up, transports: JSON.parse(row.transports || '[]') }
  },
  async onSuccess(event, { credential, authenticationInfo }) {
    const [user] = await query<{ id: number; login: string; role: 'admin' | 'user' }>(
      'SELECT u.id, u.login, u.role FROM passkeys p JOIN users u ON u.id = p.user_id WHERE p.id = $1', [credential.id],
    )
    if (!user) throw createError({ statusCode: 400, statusMessage: 'Користувача не знайдено' })
    await query('UPDATE passkeys SET counter = $2, last_used_at = now() WHERE id = $1', [credential.id, authenticationInfo.newCounter])
    await setUserSession(event, { user: { id: user.id, login: user.login, role: user.role } })
    await audit(user.login, 'login.passkey', '')
  },
})
