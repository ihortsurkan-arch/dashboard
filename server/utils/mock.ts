// Demo data in the same shape as GA4 Data API answers, for local development (NUXT_GA4_MOCK=1).
// Numbers are deterministic per hostname + day, so periods compare consistently.

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

const DAY = 86_400_000
function days(from: string, to: string) {
  const out: string[] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

function day(host: string, d: string) {
  const base = 40 + hash(host) * 160
  const weekday = new Date(`${d}T00:00:00Z`).getUTCDay()
  const sessions = Math.round(base * (0.6 + hash(host + d) * 0.8) * (weekday === 0 || weekday === 6 ? 0.8 : 1))
  const leads = Math.round(sessions * (0.03 + hash(d + host) * 0.07))
  return {
    sessions,
    leads,
    dur: 20 + hash('dur' + host + d) * 90,
    durLeads: 90 + hash('dl' + host + d) * 200,
    bounce: 0.35 + hash('b' + host + d) * 0.4,
  }
}

const mv = (...v: number[]) => v.map((x) => ({ value: String(x) }))
const dv = (...v: string[]) => v.map((x) => ({ value: x }))

function agg(host: string, from: string, to: string) {
  const ds = days(from, to).map((d) => ({ d, ...day(host, d) }))
  const s = ds.reduce((a, x) => a + x.sessions, 0)
  const l = ds.reduce((a, x) => a + x.leads, 0)
  const w = (f: (x: any) => number, by: (x: any) => number) => {
    const tot = ds.reduce((a, x) => a + by(x), 0)
    return tot ? ds.reduce((a, x) => a + f(x) * by(x), 0) / tot : 0
  }
  return { ds, s, l, dur: w((x) => x.dur, (x) => x.sessions), durLeads: w((x) => x.durLeads, (x) => x.leads), bounce: w((x) => x.bounce, (x) => x.sessions) }
}

function split(total: number, parts: [string, number][]) {
  let left = total
  return parts.map(([label, share], i) => {
    const v = i === parts.length - 1 ? left : Math.round(total * share)
    left -= v
    return { label, v: Math.max(0, v) }
  }).filter((p) => p.v > 0)
}

const DEVICES: [string, number][] = [['mobile', 0.71], ['desktop', 0.26], ['tablet', 0.03]]
const CHANNELS: [string, number][] = [['Organic Social', 0.42], ['Direct', 0.28], ['Referral', 0.17], ['Unassigned', 0.13]]
const SOURCES: [string, string, number][] = [
  ['instagram', 'model_bio', 0.36], ['(direct)', '(direct)', 0.28], ['tiktok', 'model_bio', 0.14],
  ['ytb_channel', 'fansguider', 0.12], ['t.me', '(referral)', 0.06], ['(not set)', '(not set)', 0.04],
]
const REFERRERS: [string, number][] = [
  ['', 0.31], ['https://l.instagram.com/', 0.33], ['https://www.tiktok.com/', 0.14], ['https://bit.ly/4jNgcAE', 0.12], ['https://t.me/', 0.1],
]

export function mockReports(host: string, requests: Record<string, any>): any {
  const cur = requests.daily.dateRanges[0]
  const prevR = requests.totals.dateRanges[1]
  const c = agg(host, cur.startDate, cur.endDate)
  const p = agg(host, prevR.startDate, prevR.endDate)
  const events = (s: number) => Math.round(s * 3.4)
  const lv = (parts: { label: string; v: number }[]) => parts.map((x) => ({ dimensionValues: dv(x.label), metricValues: mv(x.v) }))
  const months = new Map<string, { s: number; l: number }>()
  for (const x of c.ds) {
    const k = x.d.slice(0, 7).replace('-', '')
    const m = months.get(k) ?? { s: 0, l: 0 }
    m.s += x.sessions
    m.l += x.leads
    months.set(k, m)
  }
  const tab = (rows: { dims: string[]; s: number }[]) => ({
    rows: rows.map((r) => ({ dimensionValues: dv(...r.dims), metricValues: mv(r.s, events(r.s)) })),
    totals: [{ metricValues: mv(c.s, events(c.s)) }],
  })
  const srcSplit = split(c.s, SOURCES.map(([s, , sh]) => [s, sh]))
  return {
    totals: { rows: [
      { dimensionValues: dv('date_range_0'), metricValues: mv(c.s, c.dur, c.bounce) },
      { dimensionValues: dv('date_range_1'), metricValues: mv(p.s, p.dur, p.bounce) },
    ] },
    leadTotals: { rows: [
      { dimensionValues: dv('date_range_0'), metricValues: mv(c.l, c.durLeads) },
      { dimensionValues: dv('date_range_1'), metricValues: mv(p.l, p.durLeads) },
    ] },
    daily: { rows: c.ds.map((x) => ({ dimensionValues: dv(x.d.replaceAll('-', '')), metricValues: mv(x.sessions, x.dur, x.bounce) })) },
    dailyLeads: { rows: c.ds.filter((x) => x.leads).map((x) => ({ dimensionValues: dv(x.d.replaceAll('-', '')), metricValues: mv(x.leads, x.durLeads) })) },
    monthly: { rows: [...months].map(([k, m]) => ({ dimensionValues: dv(k), metricValues: mv(m.s) })) },
    monthlyLeads: { rows: [...months].map(([k, m]) => ({ dimensionValues: dv(k), metricValues: mv(m.l) })) },
    sessionsByDevice: { rows: lv(split(c.s, DEVICES)) },
    sessionsByChannel: { rows: lv(split(c.s, CHANNELS)) },
    leadsByDevice: { rows: lv(split(c.l, DEVICES)) },
    leadsByChannel: { rows: lv(split(c.l, CHANNELS)) },
    leadsBySource: { rows: lv(split(c.l, SOURCES.map(([s, , sh]) => [s, sh]))) },
    referrers: tab(split(c.s, REFERRERS).map((x) => ({ dims: [x.label], s: x.v }))),
    sources: tab(srcSplit.map((x) => ({ dims: [x.label], s: x.v }))),
    sourceCampaign: tab(srcSplit.map((x) => ({ dims: [x.label, SOURCES.find((s) => s[0] === x.label)![1]], s: x.v }))),
  }
}
