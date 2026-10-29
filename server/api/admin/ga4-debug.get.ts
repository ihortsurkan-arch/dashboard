import { BetaAnalyticsDataClient } from '@google-analytics/data'

// Admin-only diagnostics: raw event counts per hostname, and what the click events point to.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { ga4 } = useRuntimeConfig()
  if (!ga4.clientEmail || !ga4.privateKey || !ga4.propertyId) throw createError({ statusCode: 400, statusMessage: 'GA4 not configured' })
  const q = getQuery(event)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(q.from)) ? String(q.from) : '7daysAgo'
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(q.to)) ? String(q.to) : 'today'
  const client = new BetaAnalyticsDataClient({
    credentials: { client_email: ga4.clientEmail, private_key: String(ga4.privateKey).replace(/\\n/g, '\n') },
  })
  const property = `properties/${ga4.propertyId}`
  const dateRanges = [{ startDate: from, endDate: to }]
  const rows = (res: any) => (res.rows ?? []).map((r: any) => [...r.dimensionValues.map((d: any) => d.value), ...r.metricValues.map((m: any) => Number(m.value))])
  try {
    const [events] = await gaCall(() => client.runReport({
      property, dateRanges, limit: 500,
      dimensions: [{ name: 'hostName' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ dimension: { dimensionName: 'hostName' } }, { metric: { metricName: 'eventCount' }, desc: true }],
    }))
    const [clicks] = await gaCall(() => client.runReport({
      property, dateRanges, limit: 500,
      dimensions: [{ name: 'hostName' }, { name: 'linkUrl' }, { name: 'outbound' }],
      metrics: [{ name: 'eventCount' }, { name: 'sessions' }],
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: String(ga4.leadEvent || 'click') } } },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    }))
    const [totals] = await gaCall(() => client.runReport({
      property, dateRanges, limit: 100,
      dimensions: [{ name: 'hostName' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
    }))
    return {
      range: { from, to },
      leadEvent: ga4.leadEvent,
      totals: { columns: ['hostName', 'sessions', 'users', 'pageViews'], rows: rows(totals) },
      events: { columns: ['hostName', 'eventName', 'eventCount', 'sessions', 'users'], rows: rows(events) },
      clicks: { columns: ['hostName', 'linkUrl', 'outbound', 'eventCount', 'sessions'], rows: rows(clicks) },
    }
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: `GA4: ${e?.details || e?.message}` })
  }
})
