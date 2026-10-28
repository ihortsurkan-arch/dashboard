<script setup lang="ts">
import { Pie } from 'vue-chartjs'

// Part-to-whole for lead sources: at most 5 named slices, the tail folds into "Інше".
// Colours are fixed by slot order; the legend lists every value so colour is never alone.
const props = defineProps<{ labels: string[]; values: number[]; seriesName: string; pickable?: boolean; active?: string | null }>()
const emit = defineEmits<{ pick: [label: string] }>()
const tick = useThemeTick()

const slices = computed(() => {
  const rows = props.labels.map((label, i) => ({ label, value: props.values[i] })).filter((r) => r.value > 0)
  if (rows.length <= 6) return rows.map((r, i) => ({ ...r, colorVar: SERIES[i] }))
  const head = rows.slice(0, 5).map((r, i) => ({ ...r, colorVar: SERIES[i] }))
  const rest = rows.slice(5).reduce((a, r) => a + r.value, 0)
  return [...head, { label: t('Інше'), value: rest, colorVar: '--c-other', other: true }]
})
const total = computed(() => slices.value.reduce((a, s) => a + s.value, 0))
const empty = computed(() => total.value === 0)

const data = computed(() => {
  void tick.value
  return {
    labels: slices.value.map((s) => s.label),
    datasets: [{
      data: slices.value.map((s) => s.value),
      backgroundColor: slices.value.map((s) => cssVar(s.colorVar)),
      borderColor: cssVar('--surface'),
      borderWidth: 2,
      hoverOffset: 4,
    }],
  }
})
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: (_e: any, els: any[]) => { const s = slices.value[els[0]?.index]; if (props.pickable && s && !(s as any).other) emit('pick', s.label) },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: { label: (c: any) => ` ${c.label}: ${fmtInt(c.raw)} (${fmtPct(total.value ? c.raw / total.value : 0, 1)})` },
    },
  },
}))
</script>

<template>
  <div v-if="empty" class="empty">{{ t('Немає даних за обраний період') }}</div>
  <div v-else class="wrap">
    <div class="pie"><Pie :data="data" :options="options" role="img" :aria-label="seriesName" /></div>
    <ul class="legend">
      <li v-for="s in slices" :key="s.label" :class="{ pick: pickable && !(s as any).other, dim: active && active !== s.label }" @click="pickable && !(s as any).other && emit('pick', s.label)">
        <span class="sw" :style="{ background: `var(${s.colorVar})` }" aria-hidden="true" />
        <span class="name" :title="s.label">{{ s.label }}</span>
        <span class="val num">{{ fmtInt(s.value) }}</span>
        <span class="pct num">{{ fmtPct(s.value / total, 0) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.wrap { display: grid; grid-template-columns: 150px 1fr; gap: 18px; align-items: center; }
.pie { height: 150px; }
.legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; font-size: 13px; min-width: 0; }
.legend li { display: grid; grid-template-columns: 10px 1fr auto 38px; gap: 8px; align-items: center; }
.legend li.pick { cursor: pointer; border-radius: 6px; }
.legend li.pick:hover .name { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.legend li.dim { opacity: .45; }
.sw { width: 10px; height: 10px; border-radius: 3px; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
.val { font-weight: 600; }
.pct { color: var(--ink-3); text-align: right; }
@media (max-width: 420px) {
  .wrap { grid-template-columns: 1fr; }
  .pie { height: 170px; }
}
</style>
