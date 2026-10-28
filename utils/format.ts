// Number and date formatting. Reads the current locale, so it re-renders on a language switch.

export function fmtInt(v: number | null | undefined) {
  return v == null ? '—' : new Intl.NumberFormat(intlLocale()).format(Math.round(v))
}

export function fmtPct(v: number | null | undefined, digits = 2) {
  if (v == null) return '—'
  return `${new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v * 100)}%`
}

export function fmtDec(v: number, digits = 1) {
  return new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
}

export function fmtDuration(sec: number | null | undefined) {
  if (sec == null) return '—'
  const s = Math.round(sec)
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, '0')).join(':')
}

/** Relative change; null when there is nothing to compare with. */
export function change(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null
  return (cur - prev) / prev
}

const asDate = (d: string) => new Date(`${d.length === 7 ? `${d}-01` : d}T00:00:00Z`)

export function fmtDay(d: string) {
  return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(asDate(d)).replace('.', '')
}

export function fmtMonth(m: string) {
  return new Intl.DateTimeFormat(intlLocale(), { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(asDate(m)).replace(' р.', '').replace(' г.', '')
}

export function fmtMonthLong(m: string) {
  return new Intl.DateTimeFormat(intlLocale(), { month: 'long', timeZone: 'UTC' }).format(asDate(m))
}

export function fmtRange(from: string, to: string) {
  const f = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: from.slice(0, 4) === to.slice(0, 4) ? undefined : 'numeric', timeZone: 'UTC' })
  const tt = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${f.format(asDate(from))} – ${tt.format(asDate(to))}`.replace(/\./g, '').replace(' р', '').replace(' г', '')
}

export function fmtTime(isoTime: string) {
  return new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(isoTime))
}

export function fmtDateTime(isoTime: string) {
  return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(isoTime))
}

export function cssVar(name: string) {
  if (typeof window === 'undefined') return '#888'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

export const SERIES = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6']
