// Period selection shared by the dashboard and the all-landings page: presets relative to today,
// a custom from–to, both kept in the URL and remembered per browser.

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
export const today = () => {
  const d = new Date()
  return iso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}
const shift = (d: string, n: number) => iso(Date.parse(`${d}T00:00:00Z`) + n * DAY)

export const PRESETS = [
  { id: '7', label: '7 днів', range: () => [shift(today(), -7), shift(today(), -1)] },
  { id: '28', label: '28 днів', range: () => [shift(today(), -28), shift(today(), -1)] },
  { id: '90', label: '90 днів', range: () => [shift(today(), -90), shift(today(), -1)] },
  { id: 'month', label: 'Цей місяць', range: () => [today().slice(0, 8) + '01', today()] },
  {
    id: 'lastmonth', label: 'Минулий місяць', range: () => {
      const end = shift(today().slice(0, 8) + '01', -1)
      return [end.slice(0, 8) + '01', end]
    },
  },
] as const

const STORAGE_KEY = 'ls:selection'
export interface Saved { landing?: number; preset?: string; from?: string; to?: string }
export function readSaved(): Saved {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
export function writeSaved(patch: Saved) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSaved(), ...patch })) } catch {}
}

export function usePeriod() {
  const route = useRoute()
  const saved = readSaved()
  const valid = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

  let initial: string[] = PRESETS[1].range() as unknown as string[]
  if (valid(route.query.from) && valid(route.query.to)) initial = [String(route.query.from), String(route.query.to)]
  else if (saved.preset) initial = (PRESETS.find((p) => p.id === saved.preset)?.range() as unknown as string[]) ?? initial
  else if (valid(saved.from) && valid(saved.to)) initial = [saved.from!, saved.to!]

  const from = ref(initial[0])
  const to = ref(initial[1])
  const draftFrom = ref(from.value)
  const draftTo = ref(to.value)

  const activePreset = computed(() => PRESETS.find((p) => { const [f, tt] = p.range(); return f === from.value && tt === to.value })?.id)
  watch([from, to], () => {
    draftFrom.value = from.value
    draftTo.value = to.value
    writeSaved({ preset: activePreset.value, from: from.value, to: to.value })
  })

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    const [f, tt] = p.range()
    from.value = f
    to.value = tt
  }
  const draftValid = computed(() => valid(draftFrom.value) && valid(draftTo.value) && draftFrom.value <= draftTo.value)
  const draftChanged = computed(() => draftFrom.value !== from.value || draftTo.value !== to.value)
  function applyDates() {
    if (!draftValid.value) return
    from.value = draftFrom.value
    to.value = draftTo.value
  }
  return { from, to, draftFrom, draftTo, activePreset, applyPreset, applyDates, draftValid, draftChanged }
}
