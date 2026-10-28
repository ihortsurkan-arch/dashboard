const intFmt = new Intl.NumberFormat('uk-UA')

export function fmtInt(v: number | null | undefined) {
  return v == null ? '—' : intFmt.format(Math.round(v))
}

export function fmtPct(v: number | null | undefined, digits = 2) {
  return v == null ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')}%`
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

const MONTHS = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд']

export function fmtDay(d: string) {
  const [, m, day] = d.split('-').map(Number)
  return `${day} ${MONTHS[m - 1]}`
}

export function fmtMonth(m: string) {
  const [y, mm] = m.split('-').map(Number)
  return `${MONTHS[mm - 1]} ${y}`
}

export function fmtRange(from: string, to: string) {
  const [fy] = from.split('-')
  const [ty] = to.split('-')
  return fy === ty ? `${fmtDay(from)} – ${fmtDay(to)} ${ty}` : `${fmtDay(from)} ${fy} – ${fmtDay(to)} ${ty}`
}

export function cssVar(name: string) {
  if (typeof window === 'undefined') return '#888'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

export const SERIES = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7', '--c8']
