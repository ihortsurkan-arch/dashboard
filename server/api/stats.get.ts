const DATE = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)
  const landingId = intParam(q.landing, 'landing')
  const from = String(q.from ?? '')
  const to = String(q.to ?? '')
  if (!DATE.test(from) || !DATE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректні дати' })
  }
  if (from > to) throw createError({ statusCode: 400, statusMessage: 'Дата «з» пізніша за «по»' })
  if (from < '2015-08-14') throw createError({ statusCode: 400, statusMessage: 'Занадто рання дата' })
  const { days } = periods(from, to)
  if (days > 731) throw createError({ statusCode: 400, statusMessage: 'Період не довший за 2 роки' })

  const landing = (await landingsFor(user)).find((l) => l.id === landingId)
  if (!landing) throw createError({ statusCode: 404, statusMessage: 'Лендинг не знайдено або немає доступу' })

  setHeader(event, 'Cache-Control', 'private, no-store')
  return getStats(landing, from, to)
})
