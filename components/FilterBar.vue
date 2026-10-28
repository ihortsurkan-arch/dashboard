<script setup lang="ts">
import { ChevronDown, SlidersHorizontal, X } from 'lucide-vue-next'
import { FILTER_KEYS, type FilterKey, type FilterOptions, type Filters } from '~~/shared/stats'

// The Looker-style filter row: one select per dimension, chips for what is set.
const props = defineProps<{ modelValue: Filters; options: FilterOptions | null; loading?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [f: Filters] }>()

const LABELS: Record<FilterKey, string> = {
  channel: 'Channel', device: 'Device', source: 'UTM_Source', medium: 'UTM_Medium',
  campaign: 'UTM_Campaign', content: 'UTM_Content', term: 'UTM_Term', country: 'Країна',
}
const open = ref(false)
const active = computed(() => (Object.entries(props.modelValue) as [FilterKey, string][]).filter(([, v]) => v))

function set(key: FilterKey, value: string) {
  const next = { ...props.modelValue }
  if (value) next[key] = value
  else delete next[key]
  emit('update:modelValue', next)
}
function clear() { emit('update:modelValue', {}) }
const label = (k: FilterKey) => (k === 'country' ? t(LABELS[k]) : LABELS[k])
</script>

<template>
  <div class="fbar no-print">
    <div class="row">
      <button class="toggle" :aria-expanded="open" @click="open = !open">
        <SlidersHorizontal :size="16" :stroke-width="1.9" />
        {{ t('Фільтри') }}
        <span v-if="active.length" class="count">{{ active.length }}</span>
        <ChevronDown :size="15" class="chev" :class="{ up: open }" />
      </button>
      <TransitionGroup name="chip" tag="div" class="chips">
        <span v-for="[k, v] in active" :key="k" class="chip">
          <span class="k">{{ label(k) }}</span>{{ v }}
          <button :aria-label="t('Прибрати фільтр {f}', { f: label(k) })" @click="set(k, '')"><X :size="13" :stroke-width="2.2" /></button>
        </span>
      </TransitionGroup>
      <button v-if="active.length" class="reset" @click="clear">{{ t('Скинути всі') }}</button>
    </div>
    <Transition name="expand">
      <div v-if="open" class="grid">
        <label v-for="k in FILTER_KEYS" :key="k" class="field">
          {{ label(k) }}
          <select class="input" :value="modelValue[k] ?? ''" :disabled="loading && !options" @change="set(k, ($event.target as HTMLSelectElement).value)">
            <option value="">{{ t('Усі') }}</option>
            <option v-if="modelValue[k] && !options?.[k]?.some((o) => o.value === modelValue[k])" :value="modelValue[k]">{{ modelValue[k] }}</option>
            <option v-for="o in options?.[k] ?? []" :key="o.value" :value="o.value">{{ o.value }} ({{ fmtInt(o.sessions) }})</option>
          </select>
        </label>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fbar { display: grid; gap: 12px; }
.row { display: flex; align-items: center; gap: 8px 10px; flex-wrap: wrap; }
.toggle { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border: 1px solid var(--hair-strong); border-radius: 8px; font-size: 14px; font-weight: 500; background: var(--surface); }
.toggle:hover { border-color: var(--ink-3); }
.toggle:focus-visible { outline: 2px solid var(--accent); }
.count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--accent); color: var(--accent-ink); font-size: 12px; font-weight: 700; }
.chev { transition: transform .2s; color: var(--ink-3); }
.chev.up { transform: rotate(180deg); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 4px 4px 10px; border-radius: 99px; background: var(--accent-wash); color: var(--accent); font-size: 13px; font-weight: 600; max-width: 100%; }
.chip .k { font-weight: 500; opacity: .75; }
.chip button { all: unset; cursor: pointer; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; }
.chip button:hover { background: color-mix(in oklab, var(--accent) 18%, transparent); }
.chip button:focus-visible { outline: 2px solid var(--accent); }
.reset { all: unset; cursor: pointer; font-size: 13px; color: var(--ink-2); text-decoration: underline; text-underline-offset: 3px; }
.grid { display: grid; gap: 10px 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr)); padding: 14px; border: 1px solid var(--hair); border-radius: 12px; background: var(--surface); }
.grid .input { width: 100%; }
@media (prefers-reduced-motion: no-preference) {
  .chip-enter-active, .chip-leave-active { transition: opacity .2s, transform .2s; }
  .chip-enter-from, .chip-leave-to { opacity: 0; transform: scale(.9); }
}
</style>
