export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { from, to } = dateRange(getQuery(event))
  setHeader(event, 'Cache-Control', 'private, no-store')
  return getOverview(await landingsFor(user), from, to)
})
