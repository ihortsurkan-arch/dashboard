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
