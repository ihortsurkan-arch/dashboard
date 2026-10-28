// action = "test": a short test message; "run": the daily check now, with the weekly summary.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  if (body?.action === 'run') {
    const res = await runAlerts({ forceWeekly: true })
    await audit(admin.login, 'telegram.run', `alerts=${res.alerts} sent=${res.sent}`)
    return res
  }
  await sendTelegram(`✅ Landing Stats підключено. Сповіщення надходитимуть у цей чат.`)
  await audit(admin.login, 'telegram.test', '')
  return { ok: true }
})
