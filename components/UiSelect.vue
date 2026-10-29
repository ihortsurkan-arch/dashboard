<script setup lang="ts">
import { Check, ChevronDown, Search } from 'lucide-vue-next'

type Value = string | number
export interface SelectOption { value: Value; label: string; hint?: string }

const props = withDefaults(defineProps<{
  modelValue: Value | null | undefined
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  /** Show a search box; by default when there are more than 8 options. */
  searchable?: boolean
}>(), { placeholder: '', disabled: false, searchable: undefined })
const emit = defineEmits<{ 'update:modelValue': [Value] }>()

const uid = `sel-${Math.random().toString(36).slice(2, 9)}`
const open = ref(false)
const query = ref('')
const active = ref(0)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLDivElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const pos = ref({ top: 0, left: 0, width: 0, maxH: 320, up: false })

const selected = computed(() => props.options.find((o) => o.value === props.modelValue))
const canSearch = computed(() => props.searchable ?? props.options.length > 8)
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q))
})

function place() {
  const el = trigger.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(Math.max(r.width, 220), vw - 16)
  const left = Math.min(Math.max(8, r.left), vw - width - 8)
  const below = vh - r.bottom - 12
  const above = r.top - 12
  const up = below < 220 && above > below
  pos.value = { top: up ? r.top - 6 : r.bottom + 6, left, width, maxH: Math.min(340, Math.max(160, up ? above : below)), up }
}

async function show() {
  if (props.disabled) return
  query.value = ''
  const i = shown.value.findIndex((o) => o.value === props.modelValue)
  active.value = i >= 0 ? i : 0
  place()
  open.value = true
  await nextTick()
  if (canSearch.value) search.value?.focus()
  else panel.value?.focus()
  scrollActive()
}
function hide(focusTrigger = true) {
  open.value = false
  if (focusTrigger) trigger.value?.focus()
}
function choose(o: SelectOption) {
  emit('update:modelValue', o.value)
  hide()
}

function scrollActive() {
  nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-i="${active.value}"]`)?.scrollIntoView({ block: 'nearest' }))
}
watch(query, () => { active.value = 0 })

let typed = ''
let typedAt = 0
function onKey(e: KeyboardEvent) {
  const n = shown.value.length
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = n ? (active.value + 1) % n : 0; scrollActive() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = n ? (active.value - 1 + n) % n : 0; scrollActive() }
  else if (e.key === 'Home') { e.preventDefault(); active.value = 0; scrollActive() }
  else if (e.key === 'End') { e.preventDefault(); active.value = Math.max(0, n - 1); scrollActive() }
  else if (e.key === 'Enter') { e.preventDefault(); const o = shown.value[active.value]; if (o) choose(o) }
  else if (e.key === 'Escape') { e.preventDefault(); hide() }
  else if (e.key === 'Tab') { hide(false) }
  else if (!canSearch.value && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    // type-ahead without a search box
    const now = Date.now()
    typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase()
    typedAt = now
    const i = shown.value.findIndex((o) => o.label.toLowerCase().startsWith(typed))
    if (i >= 0) { active.value = i; scrollActive() }
  }
}
function onTriggerKey(e: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
}

function onDocDown(e: PointerEvent) {
  const t = e.target as Node
  if (!panel.value?.contains(t) && !trigger.value?.contains(t)) hide(false)
}
function onViewport() { if (open.value) place() }
watch(open, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onDocDown, true)
    window.addEventListener('resize', onViewport)
    window.addEventListener('scroll', onViewport, true)
  } else {
    document.removeEventListener('pointerdown', onDocDown, true)
    window.removeEventListener('resize', onViewport)
    window.removeEventListener('scroll', onViewport, true)
  }
})
onBeforeUnmount(() => { open.value = false })
</script>

<template>
  <button ref="trigger" type="button" class="ui-select" :class="{ open, empty: !selected }" :disabled="disabled"
          role="combobox" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="`${uid}-list`"
          @click="open ? hide() : show()" @keydown="onTriggerKey">
    <span class="val">
      <span class="lbl">{{ selected?.label ?? placeholder }}</span>
      <span v-if="selected?.hint" class="hint">{{ selected.hint }}</span>
    </span>
    <ChevronDown class="chev" :size="16" :stroke-width="2" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" ref="panel" class="ui-select-panel" :class="{ up: pos.up }" tabindex="-1"
           :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }" @keydown="onKey">
        <div v-if="canSearch" class="search">
          <Search :size="15" :stroke-width="2" aria-hidden="true" />
          <input ref="search" v-model="query" type="text" :placeholder="t('Пошук…')" :aria-controls="`${uid}-list`"
                 :aria-activedescendant="shown[active] ? `${uid}-o${active}` : undefined" autocomplete="off" spellcheck="false">
        </div>
        <ul :id="`${uid}-list`" class="list" role="listbox" :style="{ maxHeight: `${pos.maxH - (canSearch ? 48 : 0)}px` }"
            :aria-activedescendant="!canSearch && shown[active] ? `${uid}-o${active}` : undefined">
          <li v-for="(o, i) in shown" :id="`${uid}-o${i}`" :key="String(o.value)" :data-i="i" role="option"
              :aria-selected="o.value === modelValue" :class="{ active: i === active, sel: o.value === modelValue }"
              @pointermove="active = i" @click="choose(o)">
            <span class="lbl">{{ o.label }}</span>
            <span v-if="o.hint" class="hint">{{ o.hint }}</span>
            <Check v-if="o.value === modelValue" class="tick" :size="15" :stroke-width="2.4" aria-hidden="true" />
          </li>
          <li v-if="!shown.length" class="none" role="presentation">{{ t('Нічого не знайдено') }}</li>
        </ul>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-select {
  all: unset; box-sizing: border-box; cursor: pointer; width: 100%; min-width: 0;
  display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 7px 10px 7px 12px;
  border: 1px solid var(--hair-strong); border-radius: var(--radius); background: var(--surface);
  color: var(--ink); font-size: 14px; transition: border-color .15s, box-shadow .15s;
}
.ui-select:hover:not(:disabled) { border-color: var(--ink-3); }
.ui-select:focus-visible, .ui-select.open { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-wash); }
.ui-select:disabled { opacity: .5; cursor: default; }
.ui-select.empty .lbl { color: var(--ink-3); }
.val { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.val .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.val .hint { color: var(--ink-3); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 0; }
.chev { flex: none; color: var(--ink-3); transition: transform .18s ease; }
.open .chev { transform: rotate(180deg); color: var(--accent); }
</style>

<style>
.ui-select-panel {
  position: fixed; z-index: 60; box-sizing: border-box; outline: none;
  background: var(--surface); color: var(--ink); border: 1px solid var(--hair); border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 18, 30, .14), 0 2px 6px rgba(15, 18, 30, .06);
  overflow: hidden; font-size: 14px;
}
.ui-select-panel.up { transform: translateY(-100%); }
.ui-select-panel .search { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--hair); color: var(--ink-3); }
.ui-select-panel .search input { all: unset; flex: 1; min-width: 0; color: var(--ink); font-size: 14px; }
.ui-select-panel .search input::placeholder { color: var(--ink-3); }
.ui-select-panel .list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; scrollbar-width: thin; }
.ui-select-panel li[role=option] {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; min-height: 36px; box-sizing: border-box;
}
.ui-select-panel li .lbl { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-select-panel li .hint { color: var(--ink-3); font-size: 12.5px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ui-select-panel li.active { background: var(--grid); }
.ui-select-panel li.sel { color: var(--accent); font-weight: 600; }
.ui-select-panel li.sel .hint { font-weight: 400; }
.ui-select-panel .tick { flex: none; color: var(--accent); }
.ui-select-panel .none { padding: 14px 10px; color: var(--ink-3); text-align: center; font-size: 13px; }
</style>
