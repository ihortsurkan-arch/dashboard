<script setup lang="ts">
import { Bar } from 'vue-chartjs'

const props = defineProps<{
  labels: string[]
  values: number[]
  horizontal?: boolean
  seriesName: string
  colorVar?: string
}>()
const tick = useThemeTick()

const empty = computed(() => !props.values.some((v) => v > 0))
const height = computed(() => props.horizontal ? Math.max(120, props.labels.length * 34 + 30) : 240)

const data = computed(() => {
  void tick.value
  return {
    labels: props.labels,
    datasets: [{
      label: props.seriesName,
      data: props.values,
      backgroundColor: cssVar(props.colorVar ?? '--c1'),
      borderRadius: 4,
      maxBarThickness: 32,
    }],
  }
})

const options = computed(() => {
  void tick.value
  const grid = cssVar('--grid')
  const muted = cssVar('--muted')
  const valueAxis = { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, precision: 0 } }
  const catAxis = { grid: { display: false }, ticks: { color: muted, autoSkip: true, maxRotation: 0 } }
  return {
    indexAxis: props.horizontal ? ('y' as const) : ('x' as const),
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c: any) => ` ${props.seriesName}: ${fmtInt(c.raw)}` } },
    },
    scales: props.horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
  }
})
</script>

<template>
  <div v-if="empty" class="empty">Немає даних за обраний період</div>
  <div v-else :style="{ height: height + 'px' }">
    <Bar :data="data" :options="options" />
  </div>
</template>
