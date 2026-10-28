<script setup lang="ts">
// Presets + custom from–to. Works with the refs returned by usePeriod().
const props = defineProps<{ period: ReturnType<typeof usePeriod> }>()
const p = props.period
</script>

<template>
  <div class="period">
    <div class="presets" role="group" :aria-label="t('Швидкий вибір періоду')">
      <button v-for="x in PRESETS" :key="x.id" class="preset" :aria-pressed="p.activePreset.value === x.id" @click="p.applyPreset(x.id)">{{ t(x.label) }}</button>
    </div>
    <div class="dates">
      <label class="field">{{ t('З') }}
        <input v-model="p.draftFrom.value" class="input" type="date" min="2015-08-14" :max="today()" @keydown.enter="p.applyDates()">
      </label>
      <label class="field">{{ t('По') }}
        <input v-model="p.draftTo.value" class="input" type="date" min="2015-08-14" :max="today()" @keydown.enter="p.applyDates()">
      </label>
      <button class="btn primary apply" :disabled="!p.draftValid.value || !p.draftChanged.value" @click="p.applyDates()">{{ t('Показати') }}</button>
    </div>
  </div>
</template>

<style scoped>
.period { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: flex-end; }
.presets { display: flex; gap: 2px; padding: 3px; background: var(--hair); border-radius: 10px; flex-wrap: wrap; }
.preset { all: unset; cursor: pointer; padding: 6px 11px; border-radius: 7px; font-size: 13.5px; color: var(--ink-2); white-space: nowrap; }
.preset:hover { color: var(--ink); }
.preset[aria-pressed='true'] { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
.preset:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.dates { display: flex; gap: 8px; align-items: flex-end; }
@media (max-width: 640px) {
  .period, .dates { width: 100%; }
  .dates .field { flex: 1 1 0; }
  .dates .input { width: 100%; }
}
</style>
