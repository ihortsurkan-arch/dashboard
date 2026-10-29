<script setup lang="ts">
import { Flag } from 'lucide-vue-next'
import type { Goal } from '~~/shared/stats'

// Click plan for the current calendar month: done so far, linear forecast to month end.
const props = defineProps<{
  goal: Goal | null
  mtd: { month: string; leads: number; daysElapsed: number; daysInMonth: number }
  isAdmin?: boolean
  landingId: number
}>()
const done = computed(() => props.mtd.leads)
const forecast = computed(() => (props.mtd.daysElapsed ? Math.round((done.value / props.mtd.daysElapsed) * props.mtd.daysInMonth) : 0))
const share = computed(() => (props.goal ? Math.min(1, done.value / props.goal.leads) : 0))
const fShare = computed(() => (props.goal ? Math.min(1, forecast.value / props.goal.leads) : 0))
const onTrack = computed(() => (props.goal ? forecast.value >= props.goal.leads : null))
const timeShare = computed(() => props.mtd.daysElapsed / props.mtd.daysInMonth)
</script>

<template>
  <div class="goal">
    <div class="top">
      <h3><Flag :size="15" :stroke-width="2" class="ico" />{{ t('План на {m}', { m: fmtMonthLong(mtd.month) }) }}</h3>
      <span v-if="goal" class="state" :class="onTrack ? 'ok' : 'bad'">{{ onTrack ? t('Встигаємо') : t('Відстаємо') }}</span>
    </div>
    <template v-if="goal">
      <p class="big"><b class="num">{{ fmtInt(done) }}</b> <span class="muted">{{ t('з {g} кліків', { g: fmtInt(goal.leads) }) }}</span></p>
      <div class="track" role="img" :aria-label="t('{p} плану виконано', { p: fmtPct(share, 0) })">
        <div class="fc" :style="{ width: `${fShare * 100}%` }" />
        <div class="bar" :style="{ width: `${share * 100}%` }" />
        <div class="today" :style="{ left: `${timeShare * 100}%` }" :title="t('Сьогодні')" />
      </div>
      <p class="note">
        {{ t('Прогноз на кінець місяця: {f}', { f: fmtInt(forecast) }) }}<template v-if="!onTrack">. {{ t('Треба ~{n} кліків на день', { n: fmtDec(Math.max(0, goal.leads - done) / Math.max(1, mtd.daysInMonth - mtd.daysElapsed + 1), 1) }) }}</template>
      </p>
    </template>
    <template v-else>
      <p class="big"><b class="num">{{ fmtInt(done) }}</b> <span class="muted">{{ t('кліків з початку місяця') }}</span></p>
      <p class="note">
        {{ t('Прогноз на кінець місяця: {f}', { f: fmtInt(forecast) }) }}.
        <NuxtLink v-if="isAdmin" :to="{ path: '/admin', query: { tab: 'landings', goal: landingId } }">{{ t('Задати план') }}</NuxtLink>
        <template v-else>{{ t('План ще не задано.') }}</template>
      </p>
    </template>
  </div>
</template>

<style scoped>
.goal { display: grid; gap: 10px; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.top h3 { display: flex; align-items: center; gap: 7px; }
.ico { color: var(--accent); }
.state { font-size: 12.5px; font-weight: 600; padding: 2px 9px; border-radius: 99px; }
.state.ok { color: var(--good); background: color-mix(in oklab, var(--good) 12%, transparent); }
.state.bad { color: var(--bad); background: color-mix(in oklab, var(--bad) 12%, transparent); }
.big { margin: 0; font-size: 15px; }
.big b { font-size: 28px; font-weight: 650; letter-spacing: -0.02em; margin-right: 4px; }
.track { position: relative; height: 12px; border-radius: 6px; background: var(--grid); overflow: visible; }
.track .fc { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: color-mix(in oklab, var(--leads) 28%, transparent); }
.track .bar { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: var(--leads); }
.today { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); border-radius: 1px; }
.note { margin: 0; font-size: 13px; color: var(--ink-2); }
@media (prefers-reduced-motion: no-preference) {
  .track .bar, .track .fc { transform-origin: left; animation: grow .8s cubic-bezier(.2, .7, .2, 1) .35s both; }
}
@keyframes grow { from { transform: scaleX(0); } }
</style>
