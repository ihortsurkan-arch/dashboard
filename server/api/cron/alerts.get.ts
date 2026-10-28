// Called daily by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (!secret || getHeader(event, 'authorization') !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const res = await runAlerts()
  return { alerts: res.alerts, weekly: res.weekly, sent: res.sent }
})
