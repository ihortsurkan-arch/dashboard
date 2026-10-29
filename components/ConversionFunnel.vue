<script setup lang="ts">
import type { Kpi } from '~~/shared/stats'

// Session → lead conversion: the rate as the headline, then the two stages as bars from one
// left edge, each over a thin bar for the previous period.
const props = defineProps<{ sessions: Kpi; leadSessions: Kpi; leads: Kpi }>()

const rate = (k: Kpi, s: Kpi) => (s.value && k.value != null ? k.value / s.value : null)
const cur = computed(() => rate(props.leadSessions, props.sessions))
const prev = computed(() => (props.sessions.prev && props.leadSessions.prev != null ? props.leadSessions.prev / props.sessions.prev : null))
const pp = computed(() => (cur.value != null && prev.value != null ? (cur.value - prev.value) * 100 : null))

const max = computed(() => Math.max(props.sessions.value ?? 0, props.sessions.prev ?? 0, 1))
const w = (v: number | null) => `${Math.max(v ? 0.6 : 0, ((v ?? 0) / max.value) * 100)}%`
const counted = useCountUp(() => (cur.value == null ? null : cur.value * 100), { duration: 900, delay: 200 })
</script>

<template>
  <div class="funnel">
    <div class="hero">
      <div class="rate">{{ cur == null ? '—' : `${fmtDec(counted ?? 0)}%` }}</div>
      <div class="caption">
        {{ t('сесій закінчились кліком') }}
        <span v-if="pp != null" class="pp" :class="pp >= 0 ? 'up' : 'down'">{{ pp > 0 ? '+' : pp < 0 ? '−' : '' }}{{ fmtDec(Math.abs(pp)) }} {{ t('п.п.') }}</span>
      </div>
    </div>

    <div class="steps">
      <div class="step">
        <div class="row"><span>{{ t('Сесії') }}</span><b class="num">{{ fmtInt(sessions.value) }}</b></div>
        <div class="track"><div class="bar s" :style="{ width: w(sessions.value) }" /></div>
        <div class="track thin"><div class="bar ghost" :style="{ width: w(sessions.prev) }" /></div>
      </div>
      <div class="step">
        <div class="row"><span>{{ t('Сесії з кліком') }}</span><b class="num">{{ fmtInt(leadSessions.value) }}</b></div>
        <div class="track"><div class="bar l" :style="{ width: w(leadSessions.value) }" /></div>
        <div class="track thin"><div class="bar ghost" :style="{ width: w(leadSessions.prev) }" /></div>
      </div>
    </div>

    <p class="foot">
      <span class="key"><span class="sw ghost" />{{ t('попередній період') }}</span>
      <span>{{ t('Подій кліку:') }} <b class="num">{{ fmtInt(leads.value) }}</b><template v-if="leadSessions.value">{{ t(', у середньому {v} на сесію', { v: fmtDec(leads.value! / leadSessions.value, 2) }) }}</template></span>
    </p>
  </div>
</template>

<style scoped>
.funnel { display: grid; gap: 18px; }
.hero { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.rate { font-size: 44px; font-weight: 650; letter-spacing: -0.03em; line-height: 1; color: var(--leads); }
.caption { color: var(--ink-2); font-size: 14px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.pp { font-weight: 600; }
.pp.up { color: var(--good); }
.pp.down { color: var(--bad); }
.steps { display: grid; gap: 14px; }
.step { display: grid; gap: 5px; }
.row { display: flex; justify-content: space-between; font-size: 13.5px; color: var(--ink-2); }
.row b { color: var(--ink); font-weight: 600; }
.track { height: 14px; border-radius: 4px; background: var(--grid); overflow: hidden; }
.track.thin { height: 4px; background: transparent; }
.bar { height: 100%; border-radius: 4px; }
.bar.s { background: var(--sessions); }
.bar.l { background: var(--leads); }
.bar.ghost { background: var(--c-other); opacity: .7; border-radius: 2px; }
.foot { margin: 0; display: flex; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; font-size: 13px; color: var(--ink-3); }
.foot b { color: var(--ink-2); }
.key { display: inline-flex; align-items: center; gap: 6px; }
.sw.ghost { display: inline-block; width: 14px; height: 4px; border-radius: 2px; background: var(--c-other); }
@media (prefers-reduced-motion: no-preference) {
  .bar { transform-origin: left; animation: grow .7s cubic-bezier(.2, .7, .2, 1) .3s both; }
  .track.thin .bar { animation-delay: .45s; }
}
@keyframes grow { from { transform: scaleX(0); } }
</style>
