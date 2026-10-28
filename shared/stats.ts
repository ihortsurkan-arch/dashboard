// Shape of /api/stats answers, shared by server and client.

export interface Kpi {
  value: number | null
  prev: number | null
}

export interface LabelValue {
  label: string
  value: number
}

export interface DailyRow {
  date: string // YYYY-MM-DD
  sessions: number
  avgSessionDuration: number
  bounceRate: number
  leads: number
  avgSessionDurationLeads: number
}

export interface PrevDailyRow {
  date: string // YYYY-MM-DD, a day of the previous period
  sessions: number
  leads: number
}

export interface HeatCell {
  dow: number // 0 = Monday … 6 = Sunday
  hour: number // 0–23, property time zone
  sessions: number
  leads: number
}

export interface MonthlyRow {
  month: string // YYYY-MM
  sessions: number
  leads: number
}

export interface TableResult<T> {
  rows: T[]
  total: { sessions: number; events: number }
}

export interface Stats {
  landing: { id: number; name: string; hostname: string }
  range: { from: string; to: string }
  prev: { from: string; to: string }
  leadEvent: string
  mock: boolean
  kpis: {
    sessions: Kpi
    leads: Kpi
    avgSessionDuration: Kpi
    avgSessionDurationLeads: Kpi
    bounceRate: Kpi
  }
  daily: DailyRow[]
  /** Same length as the current period, day i of the previous period. */
  dailyPrev: PrevDailyRow[]
  /** Sessions that had at least one lead event (current and previous period). */
  leadSessions: Kpi
  heatmap: HeatCell[]
  monthly: MonthlyRow[]
  sessionsByDevice: LabelValue[]
  sessionsByChannel: LabelValue[]
  leadsByDevice: LabelValue[]
  leadsByChannel: LabelValue[]
  leadsBySource: LabelValue[]
  referrers: TableResult<{ referrer: string; sessions: number; events: number }>
  sources: TableResult<{ source: string; sessions: number; events: number }>
  sourceCampaign: TableResult<{ source: string; campaign: string; sessions: number; events: number }>
}
