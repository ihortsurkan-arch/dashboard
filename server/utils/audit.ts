/** Appends a line to the admin action log. Never throws: logging must not break the action. */
export async function audit(actor: string, action: string, details = '') {
  try {
    await query('INSERT INTO audit_log (actor, action, details) VALUES ($1, $2, $3)', [actor, action, details.slice(0, 500)])
  } catch (e) {
    console.error('audit log failed', e)
  }
}
