<script setup lang="ts">
// A tiny inline-SVG line for table rows: no axes, scaled to its own max.
const props = defineProps<{ values: number[]; colorVar?: string; width?: number; height?: number }>()
const w = computed(() => props.width ?? 96)
const h = computed(() => props.height ?? 28)
const path = computed(() => {
  const v = props.values
  if (v.length < 2) return ''
  const max = Math.max(...v, 1)
  return v.map((y, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * (w.value - 2) + 1).toFixed(1)},${(h.value - 2 - (y / max) * (h.value - 4)).toFixed(1)}`).join('')
})
const area = computed(() => (path.value ? `${path.value}L${w.value - 1},${h.value - 1}L1,${h.value - 1}Z` : ''))
</script>

<template>
  <svg :width="w" :height="h" :viewBox="`0 0 ${w} ${h}`" aria-hidden="true" class="spark">
    <path v-if="area" :d="area" :style="{ fill: `var(${colorVar ?? '--sessions'})`, opacity: 0.12 }" />
    <path v-if="path" :d="path" fill="none" :style="{ stroke: `var(${colorVar ?? '--sessions'})` }" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>

<style scoped>
.spark { display: block; }
</style>
