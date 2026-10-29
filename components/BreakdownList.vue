<script setup lang="ts">
import type { SessionsLeads } from '~~/shared/stats'

// Ranked rows with a sessions bar on one scale, leads, and leads per session.
// Rows are clickable when `pickable` (cross-filter), e.g. a country.
const props = defineProps<{
  rows: SessionsLeads[]
  label: string
  limit?: number
  pickable?: boolean
  active?: string | null
  csv?: string
}>()
const emit = defineEmits<{ pick: [value: string] }>()
const shown = computed(() => props.rows.filter((r) => r.sessions > 0 || r.leads > 0).slice(0, props.limit ?? 10))
const max = computed(() => Math.max(...shown.value.map((r) => r.sessions), 1))
const conv = (r: SessionsLeads) => (r.sessions ? r.leads / r.sessions : null)

function exportCsv() {
  const q = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [[props.label, t('Сесії'), t('Кліки'), t('Кліки / сесії')].map(q).join(',')]
  for (const r of props.rows) lines.push([r.label, r.sessions, r.leads, conv(r)?.toFixed(4) ?? ''].map(q).join(','))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
  a.download = `${props.csv ?? 'breakdown'}.csv`
  a.click()
}
</script>

<template>
  <div v-if="!shown.length" class="empty">{{ t('Немає даних за обраний період') }}</div>
  <div v-else class="list" role="table" :aria-label="label">
    <div class="head" role="row">
      <span role="columnheader">{{ label }}</span>
      <span role="columnheader">{{ t('Сесії') }}</span>
      <span role="columnheader" class="r">{{ t('Кліки') }}</span>
      <span role="columnheader" class="r">{{ t('Кліки / сесії') }}</span>
    </div>
    <div v-for="(r, i) in shown" :key="r.label" class="line" role="row" :style="{ '--i': i }"
         :class="{ pick: pickable, dim: active && active !== r.label }" :tabindex="pickable ? 0 : undefined"
         @click="pickable && emit('pick', r.label)" @keydown.enter="pickable && emit('pick', r.label)">
      <span class="name" role="cell" :title="r.label">{{ r.label }}</span>
      <span class="bar-cell" role="cell"><span class="bar" :style="{ width: `${(r.sessions / max) * 100}%` }" /><b class="num">{{ fmtInt(r.sessions) }}</b></span>
      <span class="r num" role="cell">{{ fmtInt(r.leads) }}</span>
      <span class="r num muted" role="cell">{{ conv(r) == null ? '—' : fmtPct(conv(r), 1) }}</span>
    </div>
    <div v-if="csv" class="foot no-print"><button class="btn sm ghost" @click="exportCsv">CSV</button></div>
  </div>
</template>

<style scoped>
.list { display: grid; gap: 2px; font-size: 13.5px; }
.head, .line { display: grid; grid-template-columns: minmax(70px, 150px) 1fr 52px 76px; gap: 10px; align-items: center; }
.head { font-size: 12.5px; color: var(--ink-3); padding-bottom: 4px; }
.r { text-align: right; }
.line { padding: 5px 6px; margin: 0 -6px; border-radius: 6px; }
.line.pick { cursor: pointer; }
.line.pick:hover { background: var(--accent-wash); }
.line:focus-visible { outline: 2px solid var(--accent); }
.line.dim { opacity: .45; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
.bar-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bar { height: 12px; min-width: 3px; border-radius: 0 4px 4px 0; background: var(--sessions); }
.bar-cell b { font-weight: 600; }
.foot { display: flex; justify-content: flex-end; padding-top: 6px; }
.ghost { border-color: transparent; color: var(--ink-2); }
@media (prefers-reduced-motion: no-preference) {
  .bar { transform-origin: left; animation: grow .6s cubic-bezier(.2, .7, .2, 1) calc(.3s + var(--i) * 40ms) both; }
}
@keyframes grow { from { transform: scaleX(0); } }
</style>
