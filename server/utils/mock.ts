// Demo data for local development and NUXT_GA4_MOCK=1.
// Reads any GA4 report request (dimensions, metrics, date ranges, filters) and answers in the
// shape of the GA4 Data API, with numbers that are deterministic per hostname + day, so periods,
// filters and breakdowns stay consistent with each other.

type Req = Record<string, any>

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const todayUtc = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
function resolveDate(s: string): number {
  if (s === 'today') return todayUtc()
  if (s === 'yesterday') return todayUtc() - DAY
  const m = /^(\d+)daysAgo$/.exec(s)
  if (m) return todayUtc() - Number(m[1]) * DAY
  return Date.parse(`${s}T00:00:00Z`)
}
function days(range: { startDate: string; endDate: string }) {
  const out: string[] = []
  for (let t = resolveDate(range.startDate); t <= resolveDate(range.endDate); t += DAY) out.push(iso(t))
  return out
}

// ---- category shares per dimension ----
type Cat = [string, number]
const CATS: Record<string, Cat[]> = {
  deviceCategory: [['mobile', 0.71], ['desktop', 0.26], ['tablet', 0.03]],
  sessionDefaultChannelGroup: [['Organic Social', 0.42], ['Direct', 0.28], ['Referral', 0.17], ['Unassigned', 0.13]],
  sessionSource: [['instagram', 0.36], ['(direct)', 0.28], ['tiktok', 0.14], ['ytb_channel', 0.12], ['t.me', 0.06], ['(not set)', 0.04]],
  sessionMedium: [['social', 0.52], ['(none)', 0.28], ['referral', 0.12], ['(not set)', 0.08]],
  sessionManualAdContent: [['(not set)', 0.7], ['story', 0.18], ['bio_link', 0.12]],
  sessionManualTerm: [['(not set)', 0.9], ['promo', 0.1]],
  country: [['Spain', 0.31], ['Ukraine', 0.18], ['Germany', 0.12], ['United States', 0.1], ['Poland', 0.08], ['Italy', 0.07], ['France', 0.06], ['United Kingdom', 0.05], ['Portugal', 0.03]],
  city: [['Madrid', 0.12], ['Barcelona', 0.09], ['Kyiv', 0.08], ['Valencia', 0.06], ['Berlin', 0.05], ['Warsaw', 0.05], ['Lviv', 0.04], ['Milan', 0.04], ['New York', 0.04], ['(not set)', 0.43]],
  landingPage: [['/', 0.58], ['/join', 0.21], ['/gallery', 0.11], ['/promo', 0.07], ['(not set)', 0.03]],
  pageReferrer: [['', 0.31], ['https://l.instagram.com/', 0.33], ['https://www.tiktok.com/', 0.14], ['https://bit.ly/4jNgcAE', 0.12], ['https://t.me/', 0.1]],
}
const CAMPAIGN_FOR: Record<string, string> = {
  instagram: 'model_bio', '(direct)': '(direct)', tiktok: 'model_bio', ytb_channel: 'fansguider', 't.me': '(referral)', '(not set)': '(not set)',
}
// Leads convert differently by category, so filters and breakdowns tell a story.
const LEAD_BIAS: Record<string, number> = {
  mobile: 1.1, desktop: 0.85, tablet: 0.7, tiktok: 0.8, 't.me': 1.25, instagram: 1.05, '/join': 1.9, '/gallery': 0.5,
}

function heatWeight(gaDow: number, hour: number, salt: string) {
  const evening = Math.exp(-((hour - 21) ** 2) / 18) + 0.55 * Math.exp(-((hour - 13) ** 2) / 10) + 0.08
  const weekend = gaDow === 0 || gaDow === 6 ? 1.25 : 1
  return evening * weekend * (0.7 + hash(salt + gaDow + ':' + hour) * 0.6)
}

function baseDay(host: string, d: string) {
  const base = 40 + hash(host) * 160
  const weekday = new Date(`${d}T00:00:00Z`).getUTCDay()
  const sessions = base * (0.6 + hash(host + d) * 0.8) * (weekday === 0 || weekday === 6 ? 0.8 : 1)
  const leadRate = 0.03 + hash(d + host) * 0.07
  return {
    sessions,
    leads: sessions * leadRate,
    dur: 20 + hash('dur' + host + d) * 90,
    durLeads: 90 + hash('dl' + host + d) * 200,
    bounce: 0.35 + hash('b' + host + d) * 0.4,
  }
}

// ---- reading the request ----
function collectFilters(f: any, out: { hosts: string[]; lead: boolean; eq: Record<string, string> }) {
  if (!f) return out
  if (f.andGroup) for (const e of f.andGroup.expressions ?? []) collectFilters(e, out)
  const flt = f.filter
  if (flt) {
    const name = flt.fieldName
    if (name === 'hostName') {
      if (flt.stringFilter) out.hosts.push(flt.stringFilter.value)
      if (flt.inListFilter) out.hosts.push(...flt.inListFilter.values)
    } else if (name === 'eventName') out.lead = true
    else if (flt.stringFilter) out.eq[name] = flt.stringFilter.value
  }
  return out
}

function shareOf(dim: string, value: string) {
  const cats = CATS[dim]
  if (!cats) return 0.5
  if (dim === 'sessionCampaignName') return 1
  return cats.find(([v]) => v === value)?.[1] ?? 0
}

type Combo = { values: string[]; share: number; leadBias: number; heat?: [number, number]; day?: string; host: string }

export function mockReport(req: Req) {
  const { hosts, lead, eq } = collectFilters(req.dimensionFilter, { hosts: [], lead: false, eq: {} })
  const hostList = hosts.length ? hosts : ['demo.example.com']
  const dims: string[] = (req.dimensions ?? []).map((d: any) => d.name)
  const metrics: string[] = (req.metrics ?? []).map((m: any) => m.name)
  const ranges: any[] = req.dateRanges ?? [{ startDate: '28daysAgo', endDate: 'yesterday' }]

  // Filters narrow volume by their category share, and shift conversion by the category bias.
  let fShare = 1
  let fBias = 1
  for (const [dim, value] of Object.entries(eq)) {
    fShare *= dim === 'sessionCampaignName' ? (Object.values(CAMPAIGN_FOR).includes(value) ? 0.5 : 0) : shareOf(dim, value)
    fBias *= LEAD_BIAS[value] ?? 1
  }

  const rows: any[] = []
  const totals = new Array(metrics.length).fill(0)
  const weightSums = new Array(metrics.length).fill(0)

  ranges.forEach((range, ri) => {
    const dayList = days(range)
    for (const host of hostList) {
      // Build the combinations of non-time dimensions with their shares
      let combos: Combo[] = [{ values: [], share: 1, leadBias: 1, host }]
      for (const dim of dims) {
        const next: Combo[] = []
        for (const c of combos) {
          if (dim === 'hostName') next.push({ ...c, values: [...c.values, host] })
          else if (dim === 'date' || dim === 'yearMonth') next.push({ ...c, values: [...c.values, `@${dim}`] })
          else if (dim === 'dayOfWeek' || dim === 'hour') next.push({ ...c, values: [...c.values, `@${dim}`] })
          else if (dim === 'sessionCampaignName') {
            const src = c.values[dims.indexOf('sessionSource')]
            next.push({ ...c, values: [...c.values, src ? (CAMPAIGN_FOR[src] ?? '(not set)') : 'model_bio'] })
          } else {
            for (const [v, sh] of CATS[dim] ?? [['(not set)', 1] as Cat]) {
              if (eq[dim] !== undefined && eq[dim] !== v) continue
              const share = eq[dim] !== undefined ? 1 : sh
              next.push({ ...c, values: [...c.values, v], share: c.share * share, leadBias: c.leadBias * (LEAD_BIAS[v] ?? 1) })
            }
          }
        }
        combos = next
      }

      const hasDate = dims.includes('date')
      const hasMonth = dims.includes('yearMonth')
      const hasHeat = dims.includes('dayOfWeek') || dims.includes('hour')
      // Expand time dimensions
      const buckets = new Map<string, { combo: Combo; days: string[]; heat?: [number, number] }>()
      for (const c of combos) {
        if (hasHeat) {
          for (let gaDow = 0; gaDow < 7; gaDow++) for (let hour = 0; hour < 24; hour++) {
            const values = c.values.map((v) => (v === '@dayOfWeek' ? String(gaDow) : v === '@hour' ? String(hour).padStart(2, '0') : v))
            buckets.set(values.join('|'), { combo: { ...c, values }, days: dayList, heat: [gaDow, hour] })
          }
        } else if (hasDate || hasMonth) {
          for (const d of dayList) {
            const values = c.values.map((v) => (v === '@date' ? d.replaceAll('-', '') : v === '@yearMonth' ? d.slice(0, 7).replace('-', '') : v))
            const key = values.join('|')
            const b = buckets.get(key)
            if (b) b.days.push(d)
            else buckets.set(key, { combo: { ...c, values }, days: [d] })
          }
        } else buckets.set(c.values.join('|'), { combo: c, days: dayList })
      }

      let heatSum = 0
      if (hasHeat) for (let g = 0; g < 7; g++) for (let h = 0; h < 24; h++) heatSum += heatWeight(g, h, host)

      for (const { combo, days: ds, heat } of buckets.values()) {
        let s = 0, l = 0, dur = 0, durL = 0, bounce = 0
        for (const d of ds) {
          const b = baseDay(host, d)
          s += b.sessions; l += b.leads; dur += b.dur * b.sessions; durL += b.durLeads * b.leads; bounce += b.bounce * b.sessions
        }
        const sh = combo.share * fShare * (heat ? heatWeight(heat[0], heat[1], host) / heatSum : 1)
        const sessions = s * sh
        const leads = l * sh * combo.leadBias * fBias
        const leadSessions = leads * 0.86
        const vals = metrics.map((m) => {
          switch (m) {
            case 'sessions': return Math.round(lead ? leadSessions : sessions)
            case 'eventCount': return Math.round(lead ? leads : sessions * 3.4)
            case 'averageSessionDuration': return lead ? (l ? durL / l : 0) : (s ? dur / s : 0)
            case 'bounceRate': return s ? bounce / s : 0
            case 'activeUsers': return Math.round(sessions * 0.8)
            default: return 0
          }
        })
        if (!vals.some((v) => v > 0)) continue
        const dimValues = ranges.length > 1 ? [...combo.values, `date_range_${ri}`] : combo.values
        rows.push({ dimensionValues: dimValues.map((value) => ({ value })), metricValues: vals.map((v) => ({ value: String(v) })) })
        if (ri === 0) vals.forEach((v, i) => {
          if (metrics[i] === 'averageSessionDuration' || metrics[i] === 'bounceRate') { totals[i] += v * sessions; weightSums[i] += sessions }
          else totals[i] += v
        })
      }
    }
  })

  const totalVals = totals.map((t, i) => (weightSums[i] ? t / weightSums[i] : t))
  const dimHeaders = ranges.length > 1 ? [...dims, 'dateRange'] : dims
  return {
    dimensionHeaders: dimHeaders.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows,
    totals: req.metricAggregations?.includes('TOTAL') ? [{ metricValues: totalVals.map((v) => ({ value: String(v) })) }] : undefined,
  }
}
