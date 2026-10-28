// Shapes of the API answers, shared by server and client.

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

export interface SessionsLeads {
  label: string
  sessions: number
  leads: number
}

/** Filters that narrow every number on the dashboard (exact match on a GA4 dimension). */
export const FILTER_KEYS = ['channel', 'device', 'source', 'medium', 'campaign', 'content', 'term', 'country'] as const
export type FilterKey = typeof FILTER_KEYS[number]
export type Filters = Partial<Record<FilterKey, string>>

export interface Annotation {
  id: number
  date: string
  text: string
  author: string
  canDelete: boolean
}

export interface Goal {
  month: string // YYYY-MM
  leads: number
}

export interface Stats {
  landing: { id: number; name: string; hostname: string }
  range: { from: string; to: string }
  prev: { from: string; to: string }
  filters: Filters
  leadEvent: string
  mock: boolean
  /** ISO time the numbers were read from GA4 (cache time). */
  fetchedAt: string
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
  countries: SessionsLeads[]
  cities: SessionsLeads[]
  landingPages: SessionsLeads[]
  /** Today vs the same weekday a week ago (GA4 processing lag applies). */
  today: { sessions: Kpi; leads: Kpi }
  /** Leads in the current calendar month for the plan card; ignores filters. */
  monthToDate: { month: string; leads: number; daysElapsed: number; daysInMonth: number }
  goal: Goal | null
  annotations: Annotation[]
  referrers: TableResult<{ referrer: string; sessions: number; events: number }>
  sources: TableResult<{ source: string; sessions: number; events: number }>
  sourceCampaign: TableResult<{ source: string; campaign: string; sessions: number; events: number }>
}

export interface FilterOptions {
  [key: string]: { value: string; sessions: number }[]
}

export interface OverviewRow {
  id: number
  name: string
  hostname: string
  sessions: Kpi
  leads: Kpi
  leadSessions: Kpi
  spark: number[]
  sparkLeads: number[]
}

export interface Overview {
  range: { from: string; to: string }
  prev: { from: string; to: string }
  mock: boolean
  fetchedAt: string
  rows: OverviewRow[]
}
