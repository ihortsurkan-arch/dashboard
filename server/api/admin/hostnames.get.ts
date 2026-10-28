import { BetaAnalyticsDataClient } from '@google-analytics/data'

// Hostnames seen in GA4 over the last 90 days — helps the admin add landings.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { ga4 } = useRuntimeConfig()
  if (String(ga4.mock) === '1' || String(ga4.mock) === 'true') {
    return [{ hostname: 'fans-guider.com', sessions: 820 }, { hostname: 'model-anna.example.com', sessions: 410 }]
  }
  if (!ga4.clientEmail || !ga4.privateKey || !ga4.propertyId) return []
  const client = new BetaAnalyticsDataClient({
    credentials: { client_email: ga4.clientEmail, private_key: String(ga4.privateKey).replace(/\\n/g, '\n') },
  })
  try {
    const [res] = await client.runReport({
      property: `properties/${ga4.propertyId}`,
      dimensions: [{ name: 'hostName' }],
      metrics: [{ name: 'sessions' }],
      dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 500,
    })
    return (res.rows ?? []).map((r) => ({ hostname: r.dimensionValues?.[0]?.value ?? '', sessions: Number(r.metricValues?.[0]?.value ?? 0) }))
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: `GA4: ${e?.details || e?.message}` })
  }
})
