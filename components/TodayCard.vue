<script setup lang="ts">
import { Sun } from 'lucide-vue-next'
import type { Kpi } from '~~/shared/stats'

// Today so far against the same weekday a week ago. GA4 processes with a lag of a few hours.
const props = defineProps<{ sessions: Kpi; leads: Kpi }>()
const items = computed(() => [
  { label: t('Сесії'), k: props.sessions, color: '--sessions' },
  { label: t('Кліки'), k: props.leads, color: '--leads' },
])
</script>

<template>
  <div class="today">
    <h3><Sun :size="15" :stroke-width="2" class="ico" />{{ t('Сьогодні') }}</h3>
    <div class="nums">
      <div v-for="it in items" :key="it.label" class="n">
        <span class="lbl"><span class="sw" :style="{ background: `var(${it.color})` }" />{{ it.label }}</span>
        <b class="num">{{ fmtInt(it.k.value) }}</b>
        <span class="cmp">
          <template v-if="change(it.k.value, it.k.prev) != null">
            <span :class="(change(it.k.value, it.k.prev) ?? 0) >= 0 ? 'up' : 'down'">{{ (change(it.k.value, it.k.prev) ?? 0) > 0 ? '+' : '' }}{{ fmtPct(change(it.k.value, it.k.prev), 0) }}</span>
          </template>
          {{ t('тиждень тому {v}', { v: fmtInt(it.k.prev) }) }}
        </span>
      </div>
    </div>
    <p class="note">{{ t('GA4 обробляє дані із затримкою до кількох годин, тож за сьогодні цифри неповні.') }}</p>
  </div>
</template>

<style scoped>
.today { display: grid; gap: 10px; }
h3 { display: flex; align-items: center; gap: 7px; }
.ico { color: var(--c4); }
.nums { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.n { display: grid; gap: 2px; }
.lbl { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); }
.sw { width: 9px; height: 9px; border-radius: 3px; }
.n b { font-size: 28px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.15; }
.cmp { font-size: 12.5px; color: var(--ink-3); display: flex; gap: 6px; flex-wrap: wrap; }
.up { color: var(--good); font-weight: 600; }
.down { color: var(--bad); font-weight: 600; }
.note { margin: 0; font-size: 12.5px; color: var(--ink-3); }
</style>
