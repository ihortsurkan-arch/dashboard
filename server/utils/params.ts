const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Validates ?from&to: real dates, from <= to, at most two years, not before GA4 existed. */
export function dateRange(q: Record<string, any>) {
  const from = String(q.from ?? '')
  const to = String(q.to ?? '')
  if (!DATE.test(from) || !DATE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw createError({ statusCode: 400, statusMessage: 'Некоректні дати' })
  }
  if (from > to) throw createError({ statusCode: 400, statusMessage: 'Дата «з» пізніша за «по»' })
  if (from < '2015-08-14') throw createError({ statusCode: 400, statusMessage: 'Занадто рання дата' })
  if (periods(from, to).days > 731) throw createError({ statusCode: 400, statusMessage: 'Період не довший за 2 роки' })
  return { from, to }
}

export async function accessibleLanding(user: DbUser, id: unknown) {
  const landingId = intParam(id, 'landing')
  const landing = (await landingsFor(user)).find((l) => l.id === landingId)
  if (!landing) throw createError({ statusCode: 404, statusMessage: 'Лендинг не знайдено або немає доступу' })
  return landing
}
