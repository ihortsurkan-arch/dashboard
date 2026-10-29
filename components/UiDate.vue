<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-vue-next'

// Single date field with a one-month calendar popover. v-model is YYYY-MM-DD.
const props = defineProps<{ modelValue: string; min?: string; max?: string; ariaLabel?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const trigger = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, style, pos } = usePopover(trigger, panel, { width: 300 })
const view = ref((props.modelValue || today()).slice(0, 7))
const focusDay = ref<string | null>(null)

const addMonths = (ym: string, n: number) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7)
const canPrev = computed(() => !props.min || addMonths(view.value, -1) >= props.min.slice(0, 7))
const canNext = computed(() => !props.max || addMonths(view.value, 1) <= props.max.slice(0, 7))
const text = computed(() => props.modelValue
  ? new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${props.modelValue}T00:00:00Z`))
  : '—')

function show() {
  view.value = (props.modelValue || props.max || today()).slice(0, 7)
  focusDay.value = props.modelValue || null
  open.value = true
  nextTick(() => (panel.value?.querySelector<HTMLElement>(`[data-day="${focusDay.value}"]`) ?? panel.value?.querySelector<HTMLElement>('.day:not(:disabled)'))?.focus())
}
function pick(d: string) {
  emit('update:modelValue', d)
  open.value = false
  trigger.value?.focus()
}
function move(d: string) {
  if ((props.min && d < props.min) || (props.max && d > props.max)) return
  focusDay.value = d
  view.value = d.slice(0, 7)
  nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-day="${d}"]`)?.focus())
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); open.value = false; trigger.value?.focus() }
}
</script>

<template>
  <button ref="trigger" type="button" class="drp" :class="{ open }" :aria-expanded="open" aria-haspopup="dialog" :aria-label="ariaLabel" @click="open ? (open = false) : show()">
    <CalendarDays :size="16" :stroke-width="2" aria-hidden="true" />
    <span class="txt">{{ text }}</span>
  </button>
  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" ref="panel" class="drp-panel narrow" :class="{ up: pos.up }" :style="style" role="dialog" :aria-label="ariaLabel" @keydown="onKey">
        <div class="nav">
          <button type="button" class="nav-btn" :disabled="!canPrev" :aria-label="t('Попередній місяць')" @click="view = addMonths(view, -1)"><ChevronLeft :size="18" /></button>
          <button type="button" class="nav-btn" :disabled="!canNext" :aria-label="t('Наступний місяць')" @click="view = addMonths(view, 1)"><ChevronRight :size="18" /></button>
        </div>
        <div class="months">
          <UiCalendar :month="view" :min="min" :max="max" :value="modelValue" :focus-day="focusDay" @pick="pick" @move="move" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drp {
  all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  min-height: 38px; padding: 7px 12px; border: 1px solid var(--hair-strong); border-radius: var(--radius);
  background: var(--surface); color: var(--ink); font-size: 14px; white-space: nowrap; transition: border-color .15s, box-shadow .15s;
}
.drp svg { color: var(--ink-3); flex: none; }
.drp:hover { border-color: var(--ink-3); }
.drp:focus-visible, .drp.open { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-wash); }
.drp.open svg { color: var(--accent); }
</style>
