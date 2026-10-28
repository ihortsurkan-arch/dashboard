<script setup lang="ts">
import type { LabelValue } from '~~/shared/stats'

// Lead sources ranked by leads, one bar length scale, with each source's leads per session beside it.
const props = defineProps<{
  leadsBySource: LabelValue[]
  sources: { source: string; sessions: number }[]
  limit?: number
}>()

const rows = computed(() => {
  const sessions = new Map(props.sources.map((s) => [s.source, s.sessions]))
  return props.leadsBySource
    .filter((r) => r.value > 0)
    .map((r) => {
      const s = sessions.get(r.label) ?? 0
      return { source: r.label, leads: r.value, sessions: s, conv: s ? r.value / s : null }
    })
    .slice(0, props.limit ?? 8)
})
const max = computed(() => Math.max(...rows.value.map((r) => r.leads), 1))
const bestConv = computed(() => Math.max(...rows.value.map((r) => r.conv ?? 0)))
</script>

<template>
  <div v-if="!rows.length" class="empty">Немає лідів за обраний період</div>
  <div v-else class="rank" role="table" aria-label="Джерела лідів">
    <div class="head" role="row">
      <span role="columnheader">Джерело</span>
      <span role="columnheader" class="r">Ліди</span>
      <span role="columnheader" class="r">Ліди / сесії</span>
    </div>
    <div v-for="(r, i) in rows" :key="r.source" class="line" role="row" :style="{ '--i': i }">
      <span class="name" role="cell" :title="r.source">{{ r.source }}</span>
      <span class="bar-cell" role="cell">
        <span class="bar" :style="{ width: `${(r.leads / max) * 100}%` }" />
        <b class="num">{{ fmtInt(r.leads) }}</b>
      </span>
      <span class="conv num" :class="{ best: r.conv != null && r.conv === bestConv && rows.length > 1 }" role="cell"
            :title="r.sessions ? `${fmtInt(r.leads)} лідів на ${fmtInt(r.sessions)} сесій` : 'Немає даних про сесії'">
        {{ r.conv == null ? '—' : fmtPct(r.conv, 1) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.rank { display: grid; gap: 4px; font-size: 13.5px; }
.head, .line { display: grid; grid-template-columns: minmax(80px, 140px) 1fr 84px; gap: 12px; align-items: center; }
.head { font-size: 12.5px; color: var(--ink-3); padding-bottom: 4px; }
.r { text-align: right; }
.line { padding: 5px 0; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
.bar-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bar { height: 14px; min-width: 3px; border-radius: 0 4px 4px 0; background: var(--leads); }
.bar-cell b { font-weight: 600; }
.conv { text-align: right; color: var(--ink-2); }
.conv.best { color: var(--good); font-weight: 600; }
@media (prefers-reduced-motion: no-preference) {
  .bar { transform-origin: left; animation: grow .6s cubic-bezier(.2, .7, .2, 1) calc(.3s + var(--i) * 50ms) both; }
}
@keyframes grow { from { transform: scaleX(0); } }
</style>
