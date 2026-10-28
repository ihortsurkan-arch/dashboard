<script setup lang="ts">
import { Line } from 'vue-chartjs'

// Current period as the accented line, the previous period of equal length as a quiet grey line
// under it, aligned day 1 to day 1. One axis, one unit; the hover rule shows both dates.
const props = defineProps<{
  dates: string[] // current period days, YYYY-MM-DD
  values: number[]
  prevDates: string[]
  prevValues: number[]
  seriesName: string
  colorVar?: string
}>()
const tick = useThemeTick()

const total = computed(() => props.values.reduce((a, b) => a + b, 0))
const prevTotal = computed(() => props.prevValues.reduce((a, b) => a + b, 0))
const empty = computed(() => total.value === 0 && prevTotal.value === 0)

// Vertical rule at the hovered day
const hoverRule = {
  id: 'hoverRule',
  afterDatasetsDraw(chart: any) {
    const active = chart.tooltip?.getActiveElements?.() ?? []
    if (!active.length) return
    const x = active[0].element.x
    const { top, bottom } = chart.chartArea
    const ctx = chart.ctx
    ctx.save()
    ctx.strokeStyle = cssVar('--axis')
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()
    ctx.restore()
  },
}

const data = computed(() => {
  void tick.value
  const color = cssVar(props.colorVar ?? '--sessions')
  const ghost = cssVar('--c-other')
  const surface = cssVar('--surface')
  const point = { pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: surface, tension: 0 }
  return {
    labels: props.dates.map(fmtDay),
    datasets: [
      {
        label: 'Цей період',
        data: props.values,
        borderColor: color,
        backgroundColor: color + '1a',
        pointHoverBackgroundColor: color,
        fill: 'origin',
        borderWidth: 2,
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
        order: 1,
        ...point,
      },
      {
        label: 'Попередній період',
        data: props.prevValues.slice(0, props.values.length),
        borderColor: ghost,
        pointHoverBackgroundColor: ghost,
        fill: false,
        borderWidth: 1.5,
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
        order: 2,
        ...point,
      },
    ],
  }
})

const options = computed(() => {
  void tick.value
  const tickColor = cssVar('--ink-3')
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: any[]) => {
            const i = items[0]?.dataIndex ?? 0
            const prev = props.prevDates[i]
            return prev ? `${fmtDay(props.dates[i])}, було ${fmtDay(prev)}` : fmtDay(props.dates[i])
          },
          label: (c: any) => ` ${c.dataset.label}: ${fmtInt(c.raw)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: cssVar('--axis') }, ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: true, grid: { color: cssVar('--grid') }, border: { display: false }, ticks: { color: tickColor, precision: 0, maxTicksLimit: 5 } },
    },
  }
})

const delta = computed(() => change(total.value, prevTotal.value))
</script>

<template>
  <div v-if="empty" class="empty">Немає даних за обраний період</div>
  <div v-else>
    <div class="legend">
      <span class="item"><span class="line" :style="{ background: `var(${colorVar ?? '--sessions'})` }" />Цей період <b class="num">{{ fmtInt(total) }}</b></span>
      <span class="item"><span class="line ghost" />Попередній <b class="num">{{ fmtInt(prevTotal) }}</b></span>
      <span v-if="delta != null" class="d" :class="delta >= 0 ? 'up' : 'down'">{{ delta > 0 ? '+' : delta < 0 ? '−' : '' }}{{ fmtPct(Math.abs(delta), 1) }}</span>
    </div>
    <div class="plot">
      <Line :data="data" :options="options" :plugins="[hoverRule]" role="img" :aria-label="`${seriesName} по днях проти попереднього періоду`" />
    </div>
  </div>
</template>

<style scoped>
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; font-size: 13px; color: var(--ink-2); margin-bottom: 10px; }
.item { display: inline-flex; align-items: center; gap: 7px; }
.item b { color: var(--ink); font-weight: 600; }
.line { width: 16px; height: 3px; border-radius: 2px; }
.line.ghost { background: var(--c-other); height: 2px; }
.d { font-weight: 600; }
.d.up { color: var(--good); }
.d.down { color: var(--bad); }
.plot { height: 240px; }
</style>
