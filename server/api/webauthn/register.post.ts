// Adds a passkey to the signed-in user's account (Face ID / Touch ID / Windows Hello).
export default defineWebAuthnRegisterEventHandler({
  async validateUser(userBody, event) {
    const user = await requireUser(event)
    if (userBody.userName !== user.login) throw createError({ statusCode: 400, statusMessage: 'Невідповідний користувач' })
    return { userName: user.login, displayName: user.login }
  },
  // Discoverable credential: sign-in works without typing the login
  getOptions: () => ({
    rpName: 'Landing Stats',
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
  }),
  async excludeCredentials(event) {
    const user = await requireUser(event)
    const rows = await query<{ id: string; transports: string }>('SELECT id, transports FROM passkeys WHERE user_id = $1', [user.id])
    return rows.map((r) => ({ id: r.id, transports: JSON.parse(r.transports || '[]') }))
  },
  storeChallenge: storeWebAuthnChallenge,
  getChallenge: takeWebAuthnChallenge,
  async onSuccess(event, { credential }) {
    const user = await requireUser(event)
    const name = deviceName(getHeader(event, 'user-agent') ?? '')
    await query(
      'INSERT INTO passkeys (id, user_id, public_key, counter, backed_up, transports, name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [credential.id, user.id, credential.publicKey, credential.counter, credential.backedUp, JSON.stringify(credential.transports ?? []), name],
    )
    await audit(user.login, 'passkey.add', name)
  },
})
