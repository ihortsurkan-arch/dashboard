<script setup lang="ts">
import type { HeatCell } from '~~/shared/stats'

// Day of week × hour: one sequential hue per metric (blue sessions, orange leads),
// light = few, dark = many. Hover or focus a cell for its exact number.
const props = defineProps<{ cells: HeatCell[] }>()

const DAYS = computed(() => ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => t(d)))
const DAYS_FULL = computed(() => ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'].map((d) => t(d)))
const metric = ref<'sessions' | 'leads'>('sessions')
const colorVar = computed(() => (metric.value === 'sessions' ? '--sessions' : '--leads'))

const max = computed(() => Math.max(...props.cells.map((c) => c[metric.value]), 0))
const total = computed(() => props.cells.reduce((a, c) => a + c[metric.value], 0))
const peak = computed(() => props.cells.reduce((best, c) => (c[metric.value] > best[metric.value] ? c : best), props.cells[0]))

function bg(v: number) {
  if (!v || !max.value) return 'var(--grid)'
  const share = 12 + Math.round((v / max.value) * 88)
  return `color-mix(in oklab, var(${colorVar.value}) ${share}%, var(--surface))`
}
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`
const unit = computed(() => (metric.value === 'sessions' ? t('сес.') : t('лід.')))

const hover = ref<HeatCell | null>(null)
const tipStyle = ref<Record<string, string>>({})
const wrap = ref<HTMLElement | null>(null)
function show(c: HeatCell, e: Event) {
  hover.value = c
  const el = e.currentTarget as HTMLElement
  const box = wrap.value!.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const left = Math.min(Math.max(r.left - box.left + r.width / 2, 70), box.width - 70)
  tipStyle.value = { left: `${left}px`, top: `${r.top - box.top - 8}px` }
}
</script>

<template>
  <div class="heat">
    <div class="top">
      <div class="seg" role="group" :aria-label="t('Показник')">
        <button :aria-pressed="metric === 'sessions'" @click="metric = 'sessions'"><span class="sw" style="background: var(--sessions)" />{{ t('Сесії') }}</button>
        <button :aria-pressed="metric === 'leads'" @click="metric = 'leads'"><span class="sw" style="background: var(--leads)" />{{ t('Ліди') }}</button>
      </div>
      <p v-if="total" class="peak">{{ t('Пік:') }} <b>{{ DAYS_FULL[peak.dow] }}, {{ hourLabel(peak.hour) }}</b> ({{ fmtInt(peak[metric]) }} {{ unit }})</p>
    </div>

    <div v-if="!total" class="empty">{{ t('Немає даних за обраний період') }}</div>
    <div v-else ref="wrap" class="grid-wrap" @mouseleave="hover = null">
      <div class="grid" role="grid" :aria-label="t('{m} за днем тижня і годиною', { m: metric === 'sessions' ? t('Сесії') : t('Ліди') })">
        <template v-for="d in 7" :key="d">
          <span class="day" role="rowheader">{{ DAYS[d - 1] }}</span>
          <button
            v-for="h in 24" :key="h" class="cell" role="gridcell"
            :style="{ background: bg(cells[(d - 1) * 24 + h - 1][metric]) }"
            :aria-label="`${DAYS_FULL[d - 1]}, ${hourLabel(h - 1)}: ${cells[(d - 1) * 24 + h - 1][metric]}`"
            @mouseenter="show(cells[(d - 1) * 24 + h - 1], $event)"
            @focus="show(cells[(d - 1) * 24 + h - 1], $event)"
            @blur="hover = null"
          />
        </template>
        <span />
        <span v-for="h in 24" :key="'h' + h" class="hour">{{ (h - 1) % 3 === 0 ? String(h - 1).padStart(2, '0') : '' }}</span>
      </div>
      <div v-if="hover" class="tip" :style="tipStyle" role="status">
        <span class="t">{{ DAYS_FULL[hover.dow] }}, {{ hourLabel(hover.hour) }}–{{ hourLabel((hover.hour + 1) % 24) }}</span>
        <span><b class="num">{{ fmtInt(hover.sessions) }}</b> {{ t('сесій') }}, <b class="num">{{ fmtInt(hover.leads) }}</b> {{ t('лідів') }}</span>
      </div>
    </div>

    <div v-if="total" class="scale">
      <span>{{ t('менше') }}</span>
      <span class="ramp" :style="{ background: `linear-gradient(90deg, color-mix(in oklab, var(${colorVar}) 12%, var(--surface)), var(${colorVar}))` }" />
      <span>{{ t('більше') }}</span>
      <span class="tz">{{ t('Час у часовому поясі ресурсу GA4') }}</span>
    </div>
  </div>
</template>

<style scoped>
.heat { display: grid; gap: 14px; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 10px 16px; flex-wrap: wrap; }
.seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--hair); border-radius: 10px; }
.seg button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 7px; font-size: 13.5px; color: var(--ink-2); }
.seg button[aria-pressed='true'] { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
.seg button:focus-visible { outline: 2px solid var(--accent); }
.sw { width: 9px; height: 9px; border-radius: 3px; }
.peak { margin: 0; font-size: 13.5px; color: var(--ink-2); }
.peak b { color: var(--ink); font-weight: 600; }
.grid-wrap { position: relative; overflow-x: auto; }
.grid { display: grid; grid-template-columns: 28px repeat(24, minmax(14px, 1fr)); gap: 3px; min-width: 420px; }
.day { font-size: 12px; color: var(--ink-3); display: flex; align-items: center; }
.cell { all: unset; height: clamp(16px, 2.4vw, 26px); border-radius: 4px; cursor: default; transition: background-color .3s ease; }
.cell:hover, .cell:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
.hour { font-size: 11px; color: var(--ink-3); text-align: left; padding-top: 2px; }
.tip {
  position: absolute; transform: translate(-50%, -100%); pointer-events: none; z-index: 2;
  background: var(--surface); border: 1px solid var(--hair-strong); border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .12); padding: 6px 10px; font-size: 12.5px;
  display: grid; gap: 2px; white-space: nowrap; color: var(--ink-2);
}
.tip .t { color: var(--ink-3); }
.tip b { color: var(--ink); }
.scale { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-3); flex-wrap: wrap; }
.ramp { width: 120px; height: 8px; border-radius: 4px; }
.tz { margin-left: auto; }
@media (prefers-reduced-motion: no-preference) {
  .grid { animation: fadein .6s ease-out .45s both; }
}
@keyframes fadein { from { opacity: 0; } }
@media (max-width: 600px) { .tz { margin-left: 0; flex-basis: 100%; } }
</style>
