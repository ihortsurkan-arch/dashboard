<script setup lang="ts">
import { Line } from 'vue-chartjs'

// One cell of the metric strip: label, value, change vs previous period, daily sparkline.
const props = defineProps<{
  title: string
  value: number | null
  prev: number | null
  format: 'int' | 'duration' | 'pct'
  goodWhen?: 'up' | 'down'
  spark?: number[]
  sparkLabels?: string[]
  colorVar?: string
  hint?: string
}>()

const tick = useThemeTick()
const fmt = (v: number | null) =>
  v == null ? '—' : props.format === 'duration' ? fmtDuration(v) : props.format === 'pct' ? fmtPct(v, 1) : fmtInt(v)

const delta = computed(() => change(props.value, props.prev))
const good = computed(() => (delta.value == null || delta.value === 0 ? null : ((props.goodWhen ?? 'up') === 'up') === delta.value > 0))
const hasSpark = computed(() => (props.spark?.length ?? 0) > 1 && props.spark!.some((v) => v > 0))

const chartData = computed(() => {
  void tick.value
  const color = cssVar(props.colorVar ?? '--sessions')
  return {
    labels: props.sparkLabels ?? props.spark?.map((_, i) => String(i)) ?? [],
    datasets: [{
      data: props.spark ?? [],
      borderColor: color,
      backgroundColor: color + '1f',
      fill: 'origin',
      borderWidth: 2,
      borderCapStyle: 'round' as const,
      borderJoinStyle: 'round' as const,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor: cssVar('--surface'),
      pointHoverBorderWidth: 2,
      tension: 0,
    }],
  }
})
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  plugins: {
    legend: { display: false },
    tooltip: { displayColors: false, callbacks: { label: (c: any) => fmt(c.raw) } },
  },
  scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
  interaction: { mode: 'index' as const, intersect: false },
}))
</script>

<template>
  <div class="metric">
    <div class="title">{{ title }}</div>
    <div class="value" :class="{ none: value == null }">{{ value == null ? 'Немає даних' : fmt(value) }}</div>
    <div class="delta">
      <span v-if="delta != null" class="chg" :class="good === true ? 'up' : good === false ? 'down' : ''">
        <span aria-hidden="true">{{ delta > 0 ? '▲' : delta < 0 ? '▼' : '' }}</span>
        {{ delta > 0 ? '+' : delta < 0 ? '−' : '' }}{{ fmtPct(Math.abs(delta), 1) }}
      </span>
      <span class="prev">було {{ fmt(prev) }}</span>
    </div>
    <div class="spark">
      <Line v-if="hasSpark" :data="chartData" :options="options" :aria-label="`${title} по днях`" role="img" />
      <div v-else class="spark-empty">{{ hint ?? 'Немає даних за період' }}</div>
    </div>
  </div>
</template>

<style scoped>
.metric { display: flex; flex-direction: column; min-width: 0; padding: 18px 20px 14px; }
.title { font-size: 13.5px; color: var(--ink-2); line-height: 1.3; min-height: 2.6em; }
.value { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin-top: 4px; }
.value.none { font-size: 17px; font-weight: 500; color: var(--ink-3); padding: 8px 0 4px; }
.delta { font-size: 13px; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; color: var(--ink-3); }
.chg { font-weight: 600; color: var(--ink-2); }
.chg.up { color: var(--good); }
.chg.down { color: var(--bad); }
.spark { height: 40px; margin-top: 12px; }
.spark-empty { font-size: 12.5px; height: 100%; display: flex; align-items: flex-end; color: var(--ink-3); }
</style>
