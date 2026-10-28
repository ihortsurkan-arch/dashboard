<script setup lang="ts">
import { Pie } from 'vue-chartjs'

const props = defineProps<{ labels: string[]; values: number[]; seriesName: string }>()
const tick = useThemeTick()
const empty = computed(() => !props.values.some((v) => v > 0))
const total = computed(() => props.values.reduce((a, b) => a + b, 0))

const data = computed(() => {
  void tick.value
  return {
    labels: props.labels,
    datasets: [{
      data: props.values,
      backgroundColor: props.labels.map((_, i) => cssVar(SERIES[i % SERIES.length])),
      borderColor: cssVar('--panel'),
      borderWidth: 2,
    }],
  }
})
const options = computed(() => {
  void tick.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: (window.innerWidth < 520 ? 'bottom' : 'right') as 'bottom' | 'right', labels: { color: cssVar('--fg'), boxWidth: 10, boxHeight: 10, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (c: any) => ` ${c.label}: ${fmtInt(c.raw)} (${fmtPct(total.value ? c.raw / total.value : 0, 1)})`,
        },
      },
    },
  }
})
</script>

<template>
  <div v-if="empty" class="empty">Немає даних за обраний період</div>
  <div v-else class="pie"><Pie :data="data" :options="options" /></div>
</template>

<style scoped>
.pie { height: 240px; }
</style>
