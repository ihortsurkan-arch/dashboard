import { BetaAnalyticsDataClient } from '@google-analytics/data'
import {
  FILTER_KEYS,
  type DailyRow, type FilterKey, type FilterOptions, type Filters, type HeatCell, type Kpi, type LabelValue,
  type MonthlyRow, type Overview, type OverviewRow, type PrevDailyRow, type SessionsLeads, type Stats, type TableResult,
} from '~~/shared/stats'
import type { Landing } from './auth'

type Filter = Record<string, any>
type ReportRequest = Record<string, any>
type Report = { rows?: any[]; totals?: any[]; dimensionHeaders?: { name: string }[]; metricHeaders?: any[] }
type Range = { from: string; to: string }

/** GA4 dimension behind each dashboard filter. */
export const FILTER_DIMS: Record<FilterKey, string> = {
  channel: 'sessionDefaultChannelGroup',
  device: 'deviceCategory',
  source: 'sessionSource',
  medium: 'sessionMedium',
  campaign: 'sessionCampaignName',
  content: 'sessionManualAdContent',
  term: 'sessionManualTerm',
  country: 'country',
}

export function isMock() {
  const v = String(useRuntimeConfig().ga4.mock)
  return v === '1' || v === 'true'
}
export function leadEventName() {
  return useRuntimeConfig().ga4.leadEvent || 'generate_lead'
}

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

/** Runs a named set of report requests, 5 per batch (API limit), against GA4 or the mock. */
export async function runReports<K extends string>(requests: Record<K, ReportRequest>): Promise<Record<K, Report>> {
  const keys = Object.keys(requests) as K[]
  const out = {} as Record<K, Report>
  if (isMock()) {
    for (const k of keys) out[k] = mockReport(requests[k])
    return out
  }
  const { ga4 } = useRuntimeConfig()
  const chunks: K[][] = []
  for (let i = 0; i < keys.length; i += 5) chunks.push(keys.slice(i, i + 5))
  // GA4 allows ~10 concurrent requests per property: run at most 3 batches at a time
  const runChunk = async (chunk: K[]) => {
    const [res] = await gaClient().batchRunReports({
      property: `properties/${ga4.propertyId}`,
      requests: chunk.map((k) => requests[k]),
    })
    chunk.forEach((k, i) => { out[k] = (res.reports?.[i] ?? {}) as Report })
  }
  try {
    const queue = [...chunks]
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) await runChunk(queue.shift()!)
    }))
  } catch (e: any) {
    if (e?.statusCode) throw e
    console.error('GA4 error', e?.message ?? e)
    throw createError({ statusCode: 502, statusMessage: `GA4: ${e?.details || e?.message || 'помилка запиту'}` })
  }
  return out
}

// ---------- dates ----------

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`)

export function periods(from: string, to: string) {
  const f = parse(from)
  const t = parse(to)
  const days = Math.round((t - f) / DAY) + 1
  return { days, range: { from, to }, prev: { from: iso(f - days * DAY), to: iso(f - DAY) } }
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

const ymd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
const ym = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}`

// ---------- filters ----------

function str(fieldName: string, value: string): Filter {
  return { filter: { fieldName, stringFilter: { matchType: 'EXACT', value } } }
}
function and(...expressions: Filter[]): Filter {
  return expressions.length === 1 ? expressions[0] : { andGroup: { expressions } }
}

export function cleanFilters(q: Record<string, any>): Filters {
  const out: Filters = {}
  for (const k of FILTER_KEYS) {
    const v = q[k]
    if (typeof v === 'string' && v.length > 0 && v.length <= 200) out[k] = v
  }
  return out
}

function filterExprs(filters: Filters): Filter[] {
  return (Object.entries(filters) as [FilterKey, string][]).map(([k, v]) => str(FILTER_DIMS[k], v))
}

// ---------- parsing ----------

const num = (v: any) => {
  const n = Number(v?.value ?? v)
  return Number.isFinite(n) ? n : 0
}

/** Index of the date range a row belongs to (0 = current, 1 = previous). */
function rangeIndex(rep: Report, row: any): number {
  const names = rep.dimensionHeaders?.map((h) => h.name) ?? []
  let i = names.indexOf('dateRange')
  if (i < 0) i = (row.dimensionValues?.length ?? 1) - 1
  return row.dimensionValues?.[i]?.value === 'date_range_1' ? 1 : 0
}

/** For reports with two date ranges and no dimensions: [current, previous] metric rows. */
function byRange(rep: Report): [any[] | null, any[] | null] {
  const res: [any[] | null, any[] | null] = [null, null]
  for (const row of rep.rows ?? []) res[rangeIndex(rep, row)] = row.metricValues ?? null
  return res
}

function labelValues(rep: Report): LabelValue[] {
  return (rep.rows ?? [])
    .map((row) => ({ label: row.dimensionValues?.[0]?.value || '(not set)', value: num(row.metricValues?.[0]) }))
    .sort((a, b) => b.value - a.value)
}

function sessionsLeads(sessionsRep: Report, leadsRep: Report, limit = 50): SessionsLeads[] {
  const map = new Map<string, SessionsLeads>()
  for (const row of sessionsRep.rows ?? []) {
    const label = row.dimensionValues?.[0]?.value || '(not set)'
    map.set(label, { label, sessions: num(row.metricValues?.[0]), leads: 0 })
  }
  for (const row of leadsRep.rows ?? []) {
    const label = row.dimensionValues?.[0]?.value || '(not set)'
    const r = map.get(label) ?? { label, sessions: 0, leads: 0 }
    r.leads = num(row.metricValues?.[0])
    map.set(label, r)
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions).slice(0, limit)
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

const kpi = (cur: any[] | null, prev: any[] | null, i: number, fallback: number | null = 0): Kpi => ({
  value: cur ? num(cur[i]) : fallback,
  prev: prev ? num(prev[i]) : fallback,
})

// ---------- dashboard ----------

function buildRequests(hostname: string, leadEvent: string, cur: Range, prev: Range, filters: Filters) {
  const hostOnly = str('hostName', hostname)
  const base = and(hostOnly, ...filterExprs(filters))
  const lead = and(hostOnly, ...filterExprs(filters), str('eventName', leadEvent))
  const leadNoFilters = and(hostOnly, str('eventName', leadEvent))
  const curRange = [{ startDate: cur.from, endDate: cur.to }]
  const prevRange = [{ startDate: prev.from, endDate: prev.to }]
  const both = [...curRange, ...prevRange]
  const todayVsWeek = [{ startDate: 'today', endDate: 'today' }, { startDate: '7daysAgo', endDate: '7daysAgo' }]
  const monthStart = `${iso(Date.now()).slice(0, 8)}01`
  const r = (dims: string[], metrics: string[], filter: Filter, extra: ReportRequest = {}): ReportRequest => ({
    dimensions: dims.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dateRanges: curRange,
    dimensionFilter: filter,
    limit: 10000,
    ...extra,
  })
  const top = (metric: string, limit: number) => ({ orderBys: [{ metric: { metricName: metric }, desc: true }], limit })
  return {
    totals: r([], ['sessions', 'averageSessionDuration', 'bounceRate'], base, { dateRanges: both }),
    leadTotals: r([], ['eventCount', 'averageSessionDuration', 'sessions'], lead, { dateRanges: both }),
    daily: r(['date'], ['sessions', 'averageSessionDuration', 'bounceRate'], base),
    dailyLeads: r(['date'], ['eventCount', 'averageSessionDuration'], lead),
    dailyPrev: r(['date'], ['sessions'], base, { dateRanges: prevRange }),
    dailyLeadsPrev: r(['date'], ['eventCount'], lead, { dateRanges: prevRange }),
    heat: r(['dayOfWeek', 'hour'], ['sessions'], base),
    heatLeads: r(['dayOfWeek', 'hour'], ['eventCount'], lead),
    monthly: r(['yearMonth'], ['sessions'], base),
    monthlyLeads: r(['yearMonth'], ['eventCount'], lead),
    sessionsByDevice: r(['deviceCategory'], ['sessions'], base),
    sessionsByChannel: r(['sessionDefaultChannelGroup'], ['sessions'], base),
    leadsByDevice: r(['deviceCategory'], ['eventCount'], lead),
    leadsByChannel: r(['sessionDefaultChannelGroup'], ['eventCount'], lead),
    leadsBySource: r(['sessionSource'], ['eventCount'], lead),
    countries: r(['country'], ['sessions'], base, top('sessions', 30)),
    countryLeads: r(['country'], ['eventCount'], lead, top('eventCount', 30)),
    cities: r(['city'], ['sessions'], base, top('sessions', 15)),
    cityLeads: r(['city'], ['eventCount'], lead, top('eventCount', 50)),
    landingPages: r(['landingPage'], ['sessions'], base, top('sessions', 30)),
    landingPageLeads: r(['landingPage'], ['eventCount'], lead, top('eventCount', 50)),
    today: r([], ['sessions'], base, { dateRanges: todayVsWeek }),
    todayLeads: r([], ['eventCount'], lead, { dateRanges: todayVsWeek }),
    monthToDate: r([], ['eventCount'], leadNoFilters, { dateRanges: [{ startDate: monthStart, endDate: 'today' }] }),
    referrers: r(['pageReferrer'], ['sessions', 'eventCount'], base, { metricAggregations: ['TOTAL'] }),
    sources: r(['sessionSource'], ['sessions', 'eventCount'], base, { metricAggregations: ['TOTAL'] }),
    sourceCampaign: r(['sessionSource', 'sessionCampaignName'], ['sessions', 'eventCount'], base, { metricAggregations: ['TOTAL'] }),
  }
}

type ReportMap = Record<keyof ReturnType<typeof buildRequests>, Report>

function buildStats(landing: Landing, leadEvent: string, cur: Range, prev: Range, filters: Filters, r: ReportMap): Omit<Stats, 'goal' | 'annotations'> {
  const [tc, tp] = byRange(r.totals)
  const [lc, lp] = byRange(r.leadTotals)

  const dailyMap = new Map<string, DailyRow>()
  for (const d of allDays(cur.from, cur.to)) {
    dailyMap.set(d, { date: d, sessions: 0, avgSessionDuration: 0, bounceRate: 0, leads: 0, avgSessionDurationLeads: 0 })
  }
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

  const prevMap = new Map<string, PrevDailyRow>()
  for (const d of allDays(prev.from, prev.to)) prevMap.set(d, { date: d, sessions: 0, leads: 0 })
  for (const row of r.dailyPrev.rows ?? []) {
    const d = prevMap.get(ymd(row.dimensionValues[0].value))
    if (d) d.sessions = num(row.metricValues[0])
  }
  for (const row of r.dailyLeadsPrev.rows ?? []) {
    const d = prevMap.get(ymd(row.dimensionValues[0].value))
    if (d) d.leads = num(row.metricValues[0])
  }

  // GA4 dayOfWeek: 0 = Sunday. Stored Monday-first.
  const heat: HeatCell[] = []
  for (let dow = 0; dow < 7; dow++) for (let hour = 0; hour < 24; hour++) heat.push({ dow, hour, sessions: 0, leads: 0 })
  const cell = (row: any) => {
    const gaDow = Number(row.dimensionValues[0].value)
    const hour = Number(row.dimensionValues[1].value)
    if (!Number.isInteger(gaDow) || !Number.isInteger(hour) || hour < 0 || hour > 23 || gaDow < 0 || gaDow > 6) return null
    return heat[((gaDow + 6) % 7) * 24 + hour]
  }
  for (const row of r.heat.rows ?? []) { const c = cell(row); if (c) c.sessions = num(row.metricValues[0]) }
  for (const row of r.heatLeads.rows ?? []) { const c = cell(row); if (c) c.leads = num(row.metricValues[0]) }

  const monthMap = new Map<string, MonthlyRow>()
  for (const m of monthsBetween(cur.from, cur.to)) monthMap.set(m, { month: m, sessions: 0, leads: 0 })
  for (const row of r.monthly.rows ?? []) {
    const m = monthMap.get(ym(row.dimensionValues[0].value))
    if (m) m.sessions = num(row.metricValues[0])
  }
  for (const row of r.monthlyLeads.rows ?? []) {
    const m = monthMap.get(ym(row.dimensionValues[0].value))
    if (m) m.leads = num(row.metricValues[0])
  }

  const [todS, wkS] = byRange(r.today)
  const [todL, wkL] = byRange(r.todayLeads)
  const now = new Date()
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()

  return {
    landing: { id: landing.id, name: landing.name, hostname: landing.hostname },
    range: cur,
    prev,
    filters,
    leadEvent,
    mock: isMock(),
    fetchedAt: new Date().toISOString(),
    kpis: {
      sessions: kpi(tc, tp, 0),
      leads: kpi(lc, lp, 0),
      avgSessionDuration: kpi(tc, tp, 1, null),
      avgSessionDurationLeads: kpi(lc, lp, 1, null),
      bounceRate: kpi(tc, tp, 2, null),
    },
    daily: [...dailyMap.values()],
    dailyPrev: [...prevMap.values()],
    leadSessions: kpi(lc, lp, 2),
    heatmap: heat,
    monthly: [...monthMap.values()],
    sessionsByDevice: labelValues(r.sessionsByDevice),
    sessionsByChannel: labelValues(r.sessionsByChannel),
    leadsByDevice: labelValues(r.leadsByDevice),
    leadsByChannel: labelValues(r.leadsByChannel),
    leadsBySource: labelValues(r.leadsBySource),
    countries: sessionsLeads(r.countries, r.countryLeads, 30),
    cities: sessionsLeads(r.cities, r.cityLeads, 15),
    landingPages: sessionsLeads(r.landingPages, r.landingPageLeads, 30),
    today: { sessions: kpi(todS, wkS, 0), leads: kpi(todL, wkL, 0) },
    monthToDate: {
      month: iso(Date.now()).slice(0, 7),
      leads: num(r.monthToDate.rows?.[0]?.metricValues?.[0]),
      daysElapsed: now.getUTCDate(),
      daysInMonth,
    },
    referrers: table(r.referrers, ([referrer], [sessions, events]) => ({ referrer, sessions, events })),
    sources: table(r.sources, ([source], [sessions, events]) => ({ source, sessions, events })),
    sourceCampaign: table(r.sourceCampaign, ([source, campaign], [sessions, events]) => ({ source, campaign, sessions, events })),
  }
}

// ---------- cache ----------

const cache = new Map<string, { at: number; data: any }>()
const MIN_REFRESH_MS = 60_000

/** Cached value for `key`, or the result of `load`. `fresh` re-reads unless the copy is under a minute old. */
async function cached<T>(key: string, fresh: boolean, load: () => Promise<T>): Promise<T> {
  const ttl = Number(useRuntimeConfig().ga4.cacheTtl) * 1000
  const hit = cache.get(key)
  const age = hit ? Date.now() - hit.at : Infinity
  if (hit && age < (fresh ? MIN_REFRESH_MS : ttl)) return hit.data as T
  const data = await load()
  cache.set(key, { at: Date.now(), data })
  if (cache.size > 500) cache.delete(cache.keys().next().value!)
  return data
}

export async function getStats(landing: Landing, from: string, to: string, filters: Filters, fresh = false) {
  const leadEvent = leadEventName()
  const { range, prev } = periods(from, to)
  const key = `stats3|${landing.hostname}|${from}|${to}|${leadEvent}|${isMock()}|${JSON.stringify(filters)}`
  const data = await cached(key, fresh, async () =>
    buildStats(landing, leadEvent, range, prev, filters, await runReports(buildRequests(landing.hostname, leadEvent, range, prev, filters))),
  )
  return { ...data, landing: { id: landing.id, name: landing.name, hostname: landing.hostname } }
}

// ---------- filter options ----------

export async function getFilterOptions(landing: Landing, from: string, to: string): Promise<FilterOptions> {
  const key = `opts|${landing.hostname}|${from}|${to}|${isMock()}`
  return cached(key, false, async () => {
    const host = str('hostName', landing.hostname)
    const reqs = Object.fromEntries(FILTER_KEYS.map((k) => [k, {
      dimensions: [{ name: FILTER_DIMS[k] }],
      metrics: [{ name: 'sessions' }],
      dateRanges: [{ startDate: from, endDate: to }],
      dimensionFilter: host,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 50,
    }])) as unknown as Record<FilterKey, ReportRequest>
    const reps = await runReports(reqs)
    const out: FilterOptions = {}
    for (const k of FILTER_KEYS) {
      out[k] = (reps[k].rows ?? [])
        .map((row) => ({ value: row.dimensionValues?.[0]?.value ?? '', sessions: num(row.metricValues?.[0]) }))
        .filter((o) => o.value !== '')
    }
    return out
  })
}

// ---------- all landings ----------

export async function getOverview(landings: Landing[], from: string, to: string): Promise<Overview> {
  const { range, prev } = periods(from, to)
  const leadEvent = leadEventName()
  const hosts = landings.map((l) => l.hostname)
  const key = `ov|${hosts.join(',')}|${from}|${to}|${leadEvent}|${isMock()}`
  return cached(key, false, async () => {
    const empty = { range, prev, mock: isMock(), fetchedAt: new Date().toISOString(), rows: [] as OverviewRow[] }
    if (!hosts.length) return empty
    const hostIn = { filter: { fieldName: 'hostName', inListFilter: { values: hosts } } }
    const lead = { andGroup: { expressions: [hostIn, str('eventName', leadEvent)] } }
    const both = [{ startDate: range.from, endDate: range.to }, { startDate: prev.from, endDate: prev.to }]
    const cur = [both[0]]
    const reps = await runReports({
      totals: { dimensions: [{ name: 'hostName' }], metrics: [{ name: 'sessions' }], dateRanges: both, dimensionFilter: hostIn, limit: 1000 },
      leads: { dimensions: [{ name: 'hostName' }], metrics: [{ name: 'eventCount' }, { name: 'sessions' }], dateRanges: both, dimensionFilter: lead, limit: 1000 },
      daily: { dimensions: [{ name: 'hostName' }, { name: 'date' }], metrics: [{ name: 'sessions' }], dateRanges: cur, dimensionFilter: hostIn, limit: 50000 },
      dailyLeads: { dimensions: [{ name: 'hostName' }, { name: 'date' }], metrics: [{ name: 'eventCount' }], dateRanges: cur, dimensionFilter: lead, limit: 50000 },
    })
    const days = allDays(range.from, range.to)
    const dayIndex = new Map(days.map((d, i) => [d, i]))
    const rows = new Map<string, OverviewRow>(landings.map((l) => [l.hostname, {
      id: l.id, name: l.name, hostname: l.hostname,
      sessions: { value: 0, prev: 0 }, leads: { value: 0, prev: 0 }, leadSessions: { value: 0, prev: 0 },
      spark: new Array(days.length).fill(0), sparkLeads: new Array(days.length).fill(0),
    }]))
    for (const row of reps.totals.rows ?? []) {
      const o = rows.get(row.dimensionValues[0].value)
      if (!o) continue
      const ri = rangeIndex(reps.totals, row)
      o.sessions[ri ? 'prev' : 'value'] = num(row.metricValues[0])
    }
    for (const row of reps.leads.rows ?? []) {
      const o = rows.get(row.dimensionValues[0].value)
      if (!o) continue
      const ri = rangeIndex(reps.leads, row)
      o.leads[ri ? 'prev' : 'value'] = num(row.metricValues[0])
      o.leadSessions[ri ? 'prev' : 'value'] = num(row.metricValues[1])
    }
    for (const row of reps.daily.rows ?? []) {
      const o = rows.get(row.dimensionValues[0].value)
      const i = dayIndex.get(ymd(row.dimensionValues[1].value))
      if (o && i !== undefined) o.spark[i] = num(row.metricValues[0])
    }
    for (const row of reps.dailyLeads.rows ?? []) {
      const o = rows.get(row.dimensionValues[0].value)
      const i = dayIndex.get(ymd(row.dimensionValues[1].value))
      if (o && i !== undefined) o.sparkLeads[i] = num(row.metricValues[0])
    }
    return { ...empty, rows: [...rows.values()] }
  })
}

// ---------- for alerts ----------

/** Daily sessions and leads per hostname for the last `days` full days (yesterday back). */
export async function dailyByHost(hosts: string[], days: number) {
  const leadEvent = leadEventName()
  const hostIn = { filter: { fieldName: 'hostName', inListFilter: { values: hosts } } }
  const range = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }]
  const reps = await runReports({
    s: { dimensions: [{ name: 'hostName' }, { name: 'date' }], metrics: [{ name: 'sessions' }], dateRanges: range, dimensionFilter: hostIn, limit: 50000 },
    l: { dimensions: [{ name: 'hostName' }, { name: 'date' }], metrics: [{ name: 'eventCount' }], dateRanges: range, dimensionFilter: { andGroup: { expressions: [hostIn, str('eventName', leadEvent)] } }, limit: 50000 },
  })
  const out = new Map<string, Map<string, { sessions: number; leads: number }>>()
  const get = (h: string, d: string) => {
    if (!out.has(h)) out.set(h, new Map())
    const m = out.get(h)!
    if (!m.has(d)) m.set(d, { sessions: 0, leads: 0 })
    return m.get(d)!
  }
  for (const row of reps.s.rows ?? []) get(row.dimensionValues[0].value, ymd(row.dimensionValues[1].value)).sessions = num(row.metricValues[0])
  for (const row of reps.l.rows ?? []) get(row.dimensionValues[0].value, ymd(row.dimensionValues[1].value)).leads = num(row.metricValues[0])
  return out
}
