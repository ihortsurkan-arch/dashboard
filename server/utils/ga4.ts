import { BetaAnalyticsDataClient } from '@google-analytics/data'
import type { DailyRow, LabelValue, MonthlyRow, Stats, TableResult } from '~~/shared/stats'
import type { Landing } from './auth'

type Filter = Record<string, any>
type ReportRequest = Record<string, any>
type Report = { rows?: any[]; totals?: any[]; dimensionHeaders?: any[]; metricHeaders?: any[] }

let client: BetaAnalyticsDataClient | null = null
function gaClient() {
  const { ga4 } = useRuntimeConfig()
  if (!ga4.clientEmail || !ga4.privateKey || !ga4.propertyId) {
    throw createError({ statusCode: 500, statusMessage: 'GA4 не налаштовано (NUXT_GA4_*)' })
  }
  if (!client) {
    client = new BetaAnalyticsDataClient({
      credentials: { client_email: ga4.clientEmail, private_key: String(ga4.privateKey).replace(/\\n/g, '\n') },
    })
  }
  return client
}

// ---------- dates ----------

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`)

export function periods(from: string, to: string) {
  const f = parse(from)
  const t = parse(to)
  const days = Math.round((t - f) / DAY) + 1
  return {
    days,
    range: { from, to },
    prev: { from: iso(f - days * DAY), to: iso(f - DAY) },
  }
}

export function allDays(from: string, to: string): string[] {
  const out: string[] = []
  for (let t = parse(from); t <= parse(to); t += DAY) out.push(iso(t))
  return out
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.slice(0, 7).split('-').map(Number)
  const end = to.slice(0, 7)
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key >= end) break
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

// ---------- GA4 requests ----------

function str(fieldName: string, value: string): Filter {
  return { filter: { fieldName, stringFilter: { matchType: 'EXACT', value } } }
}

function buildRequests(hostname: string, leadEvent: string, cur: { from: string; to: string }, prev: { from: string; to: string }) {
  const host = str('hostName', hostname)
  const lead = { andGroup: { expressions: [host, str('eventName', leadEvent)] } }
  const curRange = [{ startDate: cur.from, endDate: cur.to }]
  const both = [...curRange, { startDate: prev.from, endDate: prev.to }]
  const r = (dims: string[], metrics: string[], filter: Filter, extra: ReportRequest = {}): ReportRequest => ({
    dimensions: dims.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dateRanges: curRange,
    dimensionFilter: filter,
    limit: 10000,
    ...extra,
  })
  return {
    totals: r([], ['sessions', 'averageSessionDuration', 'bounceRate'], host, { dateRanges: both }),
    leadTotals: r([], ['eventCount', 'averageSessionDuration'], lead, { dateRanges: both }),
    daily: r(['date'], ['sessions', 'averageSessionDuration', 'bounceRate'], host),
    dailyLeads: r(['date'], ['eventCount', 'averageSessionDuration'], lead),
    monthly: r(['yearMonth'], ['sessions'], host),
    monthlyLeads: r(['yearMonth'], ['eventCount'], lead),
    sessionsByDevice: r(['deviceCategory'], ['sessions'], host),
    sessionsByChannel: r(['sessionDefaultChannelGroup'], ['sessions'], host),
    leadsByDevice: r(['deviceCategory'], ['eventCount'], lead),
    leadsByChannel: r(['sessionDefaultChannelGroup'], ['eventCount'], lead),
    leadsBySource: r(['sessionSource'], ['eventCount'], lead),
    referrers: r(['pageReferrer'], ['sessions', 'eventCount'], host, { metricAggregations: ['TOTAL'] }),
    sources: r(['sessionSource'], ['sessions', 'eventCount'], host, { metricAggregations: ['TOTAL'] }),
    sourceCampaign: r(['sessionSource', 'sessionCampaignName'], ['sessions', 'eventCount'], host, { metricAggregations: ['TOTAL'] }),
  }
}

type RequestMap = ReturnType<typeof buildRequests>
type ReportMap = { [K in keyof RequestMap]: Report }

async function runAll(requests: RequestMap): Promise<ReportMap> {
  const { ga4 } = useRuntimeConfig()
  const keys = Object.keys(requests) as (keyof RequestMap)[]
  const chunks: (keyof RequestMap)[][] = []
  for (let i = 0; i < keys.length; i += 5) chunks.push(keys.slice(i, i + 5)) // API limit: 5 per batch
  const out = {} as ReportMap
  await Promise.all(
    chunks.map(async (chunk) => {
      const [res] = await gaClient().batchRunReports({
        property: `properties/${ga4.propertyId}`,
        requests: chunk.map((k) => requests[k]),
      })
      chunk.forEach((k, i) => { out[k] = (res.reports?.[i] ?? {}) as Report })
    }),
  )
  return out
}

// ---------- answer parsing ----------

const num = (v: any) => {
  const n = Number(v?.value ?? v)
  return Number.isFinite(n) ? n : 0
}

/** For reports with two date ranges and no dimensions: [current, previous] metric rows. */
function byRange(rep: Report): [any[] | null, any[] | null] {
  const res: [any[] | null, any[] | null] = [null, null]
  for (const row of rep.rows ?? []) {
    const idx = row.dimensionValues?.[0]?.value === 'date_range_1' ? 1 : 0
    res[idx] = row.metricValues ?? null
  }
  return res
}

function labelValues(rep: Report): LabelValue[] {
  return (rep.rows ?? [])
    .map((row) => ({ label: row.dimensionValues?.[0]?.value || '(not set)', value: num(row.metricValues?.[0]) }))
    .sort((a, b) => b.value - a.value)
}

function table<T>(rep: Report, map: (dims: string[], m: number[]) => T): TableResult<T> {
  const rows = (rep.rows ?? []).map((row) =>
    map((row.dimensionValues ?? []).map((d: any) => d.value ?? ''), (row.metricValues ?? []).map(num)),
  )
  const t = rep.totals?.[0]?.metricValues
  const total = t
    ? { sessions: num(t[0]), events: num(t[1]) }
    : { sessions: rows.reduce((s: number, r: any) => s + r.sessions, 0), events: rows.reduce((s: number, r: any) => s + r.events, 0) }
  return { rows, total }
}

export function buildStats(landing: Landing, leadEvent: string, cur: { from: string; to: string }, prev: { from: string; to: string }, r: ReportMap, mock = false): Stats {
  const [tc, tp] = byRange(r.totals)
  const [lc, lp] = byRange(r.leadTotals)
  const leadsCur = lc ? num(lc[0]) : 0
  const leadsPrev = lp ? num(lp[0]) : 0

  const dailyMap = new Map<string, DailyRow>()
  for (const d of allDays(cur.from, cur.to)) {
    dailyMap.set(d, { date: d, sessions: 0, avgSessionDuration: 0, bounceRate: 0, leads: 0, avgSessionDurationLeads: 0 })
  }
  const ymd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  for (const row of r.daily.rows ?? []) {
    const d = dailyMap.get(ymd(row.dimensionValues[0].value))
    if (!d) continue
    d.sessions = num(row.metricValues[0])
    d.avgSessionDuration = num(row.metricValues[1])
    d.bounceRate = num(row.metricValues[2])
  }
  for (const row of r.dailyLeads.rows ?? []) {
    const d = dailyMap.get(ymd(row.dimensionValues[0].value))
    if (!d) continue
    d.leads = num(row.metricValues[0])
    d.avgSessionDurationLeads = num(row.metricValues[1])
  }

  const monthMap = new Map<string, MonthlyRow>()
  for (const m of monthsBetween(cur.from, cur.to)) monthMap.set(m, { month: m, sessions: 0, leads: 0 })
  const ym = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}`
  for (const row of r.monthly.rows ?? []) {
    const m = monthMap.get(ym(row.dimensionValues[0].value))
    if (m) m.sessions = num(row.metricValues[0])
  }
  for (const row of r.monthlyLeads.rows ?? []) {
    const m = monthMap.get(ym(row.dimensionValues[0].value))
    if (m) m.leads = num(row.metricValues[0])
  }

  return {
    landing: { id: landing.id, name: landing.name, hostname: landing.hostname },
    range: cur,
    prev,
    leadEvent,
    mock,
    kpis: {
      sessions: { value: tc ? num(tc[0]) : 0, prev: tp ? num(tp[0]) : 0 },
      leads: { value: leadsCur, prev: leadsPrev },
      avgSessionDuration: { value: tc ? num(tc[1]) : null, prev: tp ? num(tp[1]) : null },
      avgSessionDurationLeads: { value: lc ? num(lc[1]) : null, prev: lp ? num(lp[1]) : null },
      bounceRate: { value: tc ? num(tc[2]) : null, prev: tp ? num(tp[2]) : null },
    },
    daily: [...dailyMap.values()],
    monthly: [...monthMap.values()],
    sessionsByDevice: labelValues(r.sessionsByDevice),
    sessionsByChannel: labelValues(r.sessionsByChannel),
    leadsByDevice: labelValues(r.leadsByDevice),
    leadsByChannel: labelValues(r.leadsByChannel),
    leadsBySource: labelValues(r.leadsBySource),
    referrers: table(r.referrers, ([referrer], [sessions, events]) => ({ referrer, sessions, events })),
    sources: table(r.sources, ([source], [sessions, events]) => ({ source, sessions, events })),
    sourceCampaign: table(r.sourceCampaign, ([source, campaign], [sessions, events]) => ({ source, campaign, sessions, events })),
  }
}

// ---------- cache + entry point ----------

const cache = new Map<string, { at: number; data: Stats }>()

export async function getStats(landing: Landing, from: string, to: string): Promise<Stats> {
  const { ga4 } = useRuntimeConfig()
  const leadEvent = ga4.leadEvent || 'generate_lead'
  const { range, prev } = periods(from, to)
  const mock = String(ga4.mock) === '1' || String(ga4.mock) === 'true'
  const key = `${landing.hostname}|${from}|${to}|${leadEvent}|${mock}`
  const ttl = Number(ga4.cacheTtl) * 1000
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return { ...hit.data, landing: { id: landing.id, name: landing.name, hostname: landing.hostname } }

  const requests = buildRequests(landing.hostname, leadEvent, range, prev)
  let reports: ReportMap
  if (mock) {
    reports = mockReports(landing.hostname, requests)
  } else {
    try {
      reports = await runAll(requests)
    } catch (e: any) {
      console.error('GA4 error', e?.message ?? e)
      throw createError({ statusCode: 502, statusMessage: `GA4: ${e?.details || e?.message || 'помилка запиту'}` })
    }
  }
  const data = buildStats(landing, leadEvent, range, prev, reports, mock)
  cache.set(key, { at: Date.now(), data })
  if (cache.size > 500) cache.delete(cache.keys().next().value!)
  return data
}
