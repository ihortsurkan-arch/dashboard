<script setup lang="ts">
// One month grid (Monday first). Dates are YYYY-MM-DD strings throughout.
const props = defineProps<{
  month: string // YYYY-MM
  min?: string
  max?: string
  /** single date, or range start/end; `hover` previews an unfinished range */
  value?: string | null
  from?: string | null
  to?: string | null
  hover?: string | null
  focusDay?: string | null
}>()
const emit = defineEmits<{ pick: [string]; hover: [string | null]; move: [string] }>()

const pad = (n: number) => String(n).padStart(2, '0')
const y = computed(() => Number(props.month.slice(0, 4)))
const m = computed(() => Number(props.month.slice(5, 7)))

const title = computed(() => {
  const d = new Date(Date.UTC(y.value, m.value - 1, 1))
  const s = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d).replace(' р.', '').replace(' г.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
})
const weekdays = computed(() => {
  const f = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i))).replace('.', '')) // 2024-01-01 is a Monday
})
const cells = computed(() => {
  const first = new Date(Date.UTC(y.value, m.value - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(y.value, m.value, 0)).getUTCDate()
  const out: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) out.push(`${y.value}-${pad(m.value)}-${pad(d)}`)
  while (out.length % 7) out.push(null)
  return out
})

const todayStr = today()
const lo = computed(() => {
  const a = props.from ?? null
  const b = props.to ?? props.hover ?? null
  if (!a) return null
  return b && b < a ? b : a
})
const hi = computed(() => {
  const a = props.from ?? null
  const b = props.to ?? props.hover ?? null
  if (!a) return null
  return b && b > a ? b : a
})
const off = (d: string) => (props.min && d < props.min) || (props.max && d > props.max)
function cls(d: string) {
  const single = props.value === d
  const inRange = lo.value && hi.value && d >= lo.value && d <= hi.value
  return {
    off: off(d),
    today: d === todayStr,
    start: single || d === lo.value,
    end: single || d === hi.value,
    mid: inRange && d !== lo.value && d !== hi.value,
    preview: !props.to && !!props.hover,
  }
}
const label = (d: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))

function key(e: KeyboardEvent, d: string) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
  if (!step) return
  e.preventDefault()
  const t = new Date(Date.parse(`${d}T00:00:00Z`) + step * 86_400_000).toISOString().slice(0, 10)
  emit('move', t)
}
</script>

<template>
  <div class="cal">
    <div class="cal-title">{{ title }}</div>
    <div class="grid" role="grid" :aria-label="title">
      <span v-for="w in weekdays" :key="w" class="wd" role="columnheader">{{ w }}</span>
      <template v-for="(d, i) in cells" :key="i">
        <span v-if="!d" class="blank" />
        <button v-else type="button" class="day" :class="cls(d)" :disabled="!!off(d)" :data-day="d"
                :tabindex="d === focusDay ? 0 : -1" :aria-label="label(d)" :aria-pressed="!!(cls(d).start || cls(d).end)"
                @click="emit('pick', d)" @mouseenter="emit('hover', d)" @focus="emit('hover', d)" @keydown="key($event, d)">
          <span>{{ Number(d.slice(8)) }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cal { min-width: 0; }
.cal-title { text-align: center; font-weight: 600; font-size: 14px; height: 32px; line-height: 32px; }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 2px; }
.wd { text-align: center; font-size: 11.5px; color: var(--ink-3); padding: 4px 0 6px; text-transform: lowercase; }
.day {
  all: unset; box-sizing: border-box; cursor: pointer; height: 36px; position: relative;
  display: grid; place-items: center; font-size: 13.5px; font-variant-numeric: tabular-nums; color: var(--ink);
}
.day span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; position: relative; z-index: 1; transition: background .12s; }
.day:hover:not(:disabled) span { background: var(--grid); }
.day.today span { box-shadow: inset 0 0 0 1px var(--hair-strong); font-weight: 600; }
.day.mid { background: var(--accent-wash); }
.day.mid.preview { background: color-mix(in srgb, var(--accent-wash) 60%, transparent); }
.day.start:not(.end)::before, .day.end:not(.start)::before {
  content: ''; position: absolute; top: 0; bottom: 0; background: var(--accent-wash); z-index: 0;
}
.day.start:not(.end)::before { left: 50%; right: 0; }
.day.end:not(.start)::before { left: 0; right: 50%; }
.day.start span, .day.end span { background: var(--accent) !important; color: var(--accent-ink); font-weight: 600; box-shadow: none; }
.day:disabled { cursor: default; color: var(--ink-3); opacity: .45; }
.day:focus-visible { outline: none; }
.day:focus-visible span { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
