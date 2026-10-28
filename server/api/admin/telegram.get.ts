export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { configured: telegramConfigured(), cron: !!process.env.CRON_SECRET }
})
