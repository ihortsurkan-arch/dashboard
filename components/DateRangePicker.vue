<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{ from: string; to: string; min?: string; max?: string }>()
const emit = defineEmits<{ apply: [string, string] }>()

const trigger = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const narrow = ref(false)
const { open, style, pos, place } = usePopover(trigger, panel, { width: 600 })

const a = ref<string | null>(props.from) // range start being edited
const b = ref<string | null>(props.to) // range end; null while picking the second date
const hover = ref<string | null>(null)
const focusDay = ref<string | null>(null)
const view = ref(props.to.slice(0, 7)) // right-hand (or only) month

const addMonths = (ym: string, n: number) => {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}
const months = computed(() => (narrow.value ? [view.value] : [addMonths(view.value, -1), view.value]))
const canPrev = computed(() => !props.min || addMonths(months.value[0], -1) >= props.min.slice(0, 7))
const canNext = computed(() => !props.max || addMonths(view.value, 1) <= props.max.slice(0, 7))

function show() {
  narrow.value = window.innerWidth < 680
  a.value = props.from
  b.value = props.to
  hover.value = null
  view.value = props.to.slice(0, 7)
  focusDay.value = props.to
  open.value = true
  nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-day="${focusDay.value}"]`)?.focus())
}
watch(narrow, () => nextTick(place))

function pick(d: string) {
  if (!a.value || b.value) { a.value = d; b.value = null }
  else if (d < a.value) { b.value = a.value; a.value = d }
  else b.value = d
  focusDay.value = d
}
function move(d: string) {
  if ((props.min && d < props.min) || (props.max && d > props.max)) return
  focusDay.value = d
  const ym = d.slice(0, 7)
  if (!months.value.includes(ym)) view.value = narrow.value || ym > view.value ? ym : addMonths(ym, 1)
  nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-day="${d}"]`)?.focus())
}
function apply() {
  if (!a.value || !b.value) return
  emit('apply', a.value, b.value)
  open.value = false
  trigger.value?.focus()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); open.value = false; trigger.value?.focus() }
}

const days = (f: string, t: string) => Math.round((Date.parse(t) - Date.parse(f)) / 86_400_000) + 1
const summary = computed(() => {
  if (a.value && b.value) return t('{r} · {n} дн.', { r: fmtRange(a.value, b.value), n: days(a.value, b.value) })
  return t('Оберіть кінцеву дату')
})
</script>

<template>
  <button ref="trigger" type="button" class="drp" :class="{ open }" :aria-expanded="open" aria-haspopup="dialog" @click="open ? (open = false) : show()">
    <CalendarDays :size="16" :stroke-width="2" aria-hidden="true" />
    <span class="txt">{{ fmtRange(from, to) }}</span>
  </button>

  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" ref="panel" class="drp-panel" :class="{ up: pos.up, narrow }" :style="narrow ? { ...style, width: `${Math.min(380, pos.width)}px` } : style"
           role="dialog" :aria-label="t('Вибір періоду')" @keydown="onKey">
        <div class="nav">
          <button type="button" class="nav-btn" :disabled="!canPrev" :aria-label="t('Попередній місяць')" @click="view = addMonths(view, -1)"><ChevronLeft :size="18" /></button>
          <button type="button" class="nav-btn" :disabled="!canNext" :aria-label="t('Наступний місяць')" @click="view = addMonths(view, 1)"><ChevronRight :size="18" /></button>
        </div>
        <div class="months" @mouseleave="hover = null">
          <UiCalendar v-for="mo in months" :key="mo" :month="mo" :min="min" :max="max" :from="a" :to="b" :hover="b ? null : hover"
                      :focus-day="focusDay" @pick="pick" @hover="hover = $event" @move="move" />
        </div>
        <div class="foot">
          <span class="sum" aria-live="polite">{{ summary }}</span>
          <span class="acts">
            <button type="button" class="btn sm ghost" @click="open = false">{{ t('Скасувати') }}</button>
            <button type="button" class="btn sm primary" :disabled="!a || !b" @click="apply">{{ t('Показати') }}</button>
          </span>
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
.txt { overflow: hidden; text-overflow: ellipsis; }
</style>

