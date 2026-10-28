export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)
  const { from, to } = dateRange(q)
  const landing = await accessibleLanding(user, q.landing)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return getFilterOptions(landing, from, to)
})
