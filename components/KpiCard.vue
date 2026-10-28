<script setup lang="ts">
import { Line } from 'vue-chartjs'

const props = defineProps<{
  title: string
  value: number | null
  prev: number | null
  format: 'int' | 'duration' | 'pct'
  goodWhen?: 'up' | 'down'
  spark?: number[]
  sparkLabels?: string[]
  hint?: string
}>()

const tick = useThemeTick()
const shown = computed(() => {
  if (props.value == null) return 'Немає даних'
  if (props.format === 'duration') return fmtDuration(props.value)
  if (props.format === 'pct') return fmtPct(props.value)
  return fmtInt(props.value)
})
const prevShown = computed(() => {
  if (props.prev == null) return '—'
  if (props.format === 'duration') return fmtDuration(props.prev)
  if (props.format === 'pct') return fmtPct(props.prev)
  return fmtInt(props.prev)
})
const delta = computed(() => change(props.value, props.prev))
const good = computed(() => delta.value == null || delta.value === 0 ? null : ((props.goodWhen ?? 'up') === 'up') === delta.value > 0)

const hasSpark = computed(() => (props.spark?.length ?? 0) > 1 && props.spark!.some((v) => v > 0))
const chartData = computed(() => {
  void tick.value
  const color = cssVar('--c1')
  return {
    labels: props.sparkLabels ?? props.spark?.map((_, i) => String(i)) ?? [],
    datasets: [{ data: props.spark ?? [], borderColor: color, backgroundColor: color + '22', fill: true, borderWidth: 1.75, pointRadius: 0, tension: 0 }],
  }
})
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: {
        label: (c: any) => props.format === 'duration' ? fmtDuration(c.raw) : props.format === 'pct' ? fmtPct(c.raw) : fmtInt(c.raw),
      },
    },
  },
  scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
  interaction: { mode: 'index' as const, intersect: false },
}))
</script>

<template>
  <div class="card kpi">
    <div class="title">{{ title }}</div>
    <div class="value num" :class="{ none: value == null }">{{ shown }}</div>
    <div class="delta num">
      <span v-if="delta != null" :class="good === true ? 'ok' : good === false ? 'bad' : ''">
        {{ delta > 0 ? '▲' : delta < 0 ? '▼' : '' }} {{ fmtPct(Math.abs(delta), 1) }}
      </span>
      <span v-else class="muted">— </span>
      <span class="muted"> · було {{ prevShown }}</span>
    </div>
    <div class="spark">
      <Line v-if="hasSpark" :data="chartData" :options="options" />
      <div v-else class="spark-empty muted">{{ hint ?? 'Немає даних за період' }}</div>
    </div>
  </div>
</template>

<style scoped>
.kpi { display: flex; flex-direction: column; gap: 2px; padding: 16px; }
.title { font-size: 13px; color: var(--muted); }
.value { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
.value.none { font-size: 18px; color: var(--muted); font-weight: 500; padding: 6px 0 3px; }
.delta { font-size: 12.5px; }
.ok { color: var(--ok); font-weight: 600; }
.bad { color: var(--bad); font-weight: 600; }
.spark { height: 44px; margin-top: 8px; }
.spark-empty { font-size: 12px; height: 100%; display: flex; align-items: flex-end; }
</style>
