<script setup lang="ts">
import { Bar } from 'vue-chartjs'

// One series per chart, coloured by the metric (Sessions blue, Clicks orange).
// Horizontal bars carry their value at the bar end; vertical time bars rely on axis + tooltip.
const props = defineProps<{
  labels: string[]
  values: number[]
  horizontal?: boolean
  seriesName: string
  colorVar?: string
  /** When set, bars are clickable and emit their label (cross-filter). */
  pickable?: boolean
  active?: string | null
}>()
const emit = defineEmits<{ pick: [label: string] }>()
const tick = useThemeTick()

const empty = computed(() => !props.values.some((v) => v > 0))
const height = computed(() => (props.horizontal ? Math.max(110, props.labels.length * 36 + 36) : 240))

// Draws each bar's value just past its end (horizontal charts only).
const endLabels = {
  id: 'endLabels',
  afterDatasetsDraw(chart: any) {
    if (!props.horizontal) return
    const { ctx } = chart
    const meta = chart.getDatasetMeta(0)
    ctx.save()
    ctx.font = `500 12px Onest, system-ui, sans-serif`
    ctx.fillStyle = cssVar('--ink-2')
    ctx.textBaseline = 'middle'
    meta.data.forEach((bar: any, i: number) => {
      ctx.fillText(fmtInt(props.values[i]), bar.x + 6, bar.y)
    })
    ctx.restore()
  },
}

const data = computed(() => {
  void tick.value
  return {
    labels: props.labels,
    datasets: [{
      label: props.seriesName,
      data: props.values,
      // Scriptable (not an array) so Chart.js can tween colours when the active bar changes
      backgroundColor: (ctx: any) => {
        const c = cssVar(props.colorVar ?? '--sessions')
        return props.active && props.active !== props.labels[ctx.dataIndex] ? c + '55' : c
      },
      borderRadius: 4, // with borderSkipped 'start' only the value end is rounded
      borderSkipped: 'start' as const,
      maxBarThickness: props.horizontal ? 18 : 22,
      categoryPercentage: 0.8,
      barPercentage: 0.9,
    }],
  }
})

const options = computed(() => {
  void tick.value
  const grid = cssVar('--grid')
  const tickColor = cssVar('--ink-3')
  const max = Math.max(...props.values, 1)
  const valueAxis = {
    beginAtZero: true,
    // Room for the end labels on horizontal bars
    suggestedMax: props.horizontal ? max * 1.15 : undefined,
    grid: { color: grid, drawTicks: false },
    border: { display: false },
    ticks: { color: tickColor, precision: 0, padding: 6, maxTicksLimit: 6 },
  }
  const catAxis = {
    grid: { display: false },
    border: { color: cssVar('--axis') },
    ticks: { color: props.horizontal ? cssVar('--ink-2') : tickColor, autoSkip: true, maxRotation: 0, padding: 6 },
  }
  return {
    indexAxis: props.horizontal ? ('y' as const) : ('x' as const),
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: props.horizontal ? 8 : 0 } },
    onClick: (_e: any, els: any[]) => { if (props.pickable && els.length) emit('pick', props.labels[els[0].index]) },
    onHover: (e: any, els: any[]) => { if (props.pickable && e.native?.target) e.native.target.style.cursor = els.length ? 'pointer' : 'default' },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (c: any) => `${props.seriesName}: ${fmtInt(c.raw)}`,
          footer: () => (props.pickable ? t('Клікніть, щоб відфільтрувати') : ''),
        },
        footerColor: cssVar('--ink-3'),
        footerFont: { weight: 'normal' as const, size: 11 },
      },
    },
    interaction: { mode: 'index' as const, intersect: false, axis: props.horizontal ? ('y' as const) : ('x' as const) },
    scales: props.horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
  }
})
</script>

<template>
  <div v-if="empty" class="empty">{{ t('Немає даних за обраний період') }}</div>
  <div v-else :style="{ height: height + 'px' }">
    <Bar :data="data" :options="options" :plugins="[endLabels]" role="img" :aria-label="seriesName" />
  </div>
</template>
