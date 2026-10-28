<script setup lang="ts" generic="T extends Record<string, any>">
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Download } from 'lucide-vue-next'

interface Column { key: string; label: string; numeric?: boolean; emptyLabel?: string }

const props = defineProps<{
  columns: Column[]
  rows: T[]
  total?: Record<string, number>
  pageSize?: number
  /** File name (without .csv) for the export button. */
  csv?: string
  /** Column whose value a row click emits (cross-filter). */
  pickKey?: string
  active?: string | null
}>()
const emit = defineEmits<{ pick: [value: string] }>()

const size = computed(() => props.pageSize ?? 10)
const sortKey = ref<string>(props.columns.find((c) => c.numeric)?.key ?? props.columns[0].key)
const sortDir = ref<1 | -1>(-1)
const page = ref(1)

const sorted = computed(() => {
  const k = sortKey.value
  const col = props.columns.find((c) => c.key === k)
  return [...props.rows].sort((a, b) => {
    const x = a[k], y = b[k]
    const r = col?.numeric ? Number(x) - Number(y) : String(x).localeCompare(String(y))
    return r * sortDir.value
  })
})
const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / size.value)))
const visible = computed(() => sorted.value.slice((page.value - 1) * size.value, page.value * size.value))
const firstIdx = computed(() => (page.value - 1) * size.value)
watch(() => props.rows, () => { page.value = 1 })
watch(pages, (p) => { if (page.value > p) page.value = p })

function sortBy(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else { sortKey.value = key; sortDir.value = props.columns.find((c) => c.key === key)?.numeric ? -1 : 1 }
}
const ariaSort = (key: string) => (sortKey.value !== key ? 'none' : sortDir.value === 1 ? 'ascending' : 'descending')

function exportCsv() {
  const q = (v: unknown) => {
    const s = String(v ?? '')
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [props.columns.map((c) => q(c.label)).join(',')]
  for (const r of sorted.value) lines.push(props.columns.map((c) => q(r[c.key])).join(','))
  if (props.total) lines.push(props.columns.map((c, i) => (c.numeric ? q(props.total![c.key]) : i === 0 ? q(t('Загальний підсумок')) : '')).join(','))
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${props.csv ?? 'table'}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
</script>

<template>
  <div>
    <div v-if="!rows.length" class="empty">{{ t('Немає даних за обраний період') }}</div>
    <template v-else>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="idx">#</th>
              <th v-for="c in columns" :key="c.key" :class="{ numeric: c.numeric }" :aria-sort="ariaSort(c.key)">
                <button class="sort" @click="sortBy(c.key)">
                  {{ c.label }}<ChevronUp v-if="sortKey === c.key && sortDir === 1" :size="14" class="arrow on" /><ChevronDown v-else-if="sortKey === c.key" :size="14" class="arrow on" /><ChevronsUpDown v-else :size="13" class="arrow" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in visible" :key="i" :class="{ pick: !!pickKey, dim: !!(active && pickKey && active !== String(r[pickKey])) }"
                :tabindex="pickKey ? 0 : undefined"
                @click="pickKey && emit('pick', String(r[pickKey]))" @keydown.enter="pickKey && emit('pick', String(r[pickKey]))">
              <td class="idx muted">{{ firstIdx + i + 1 }}.</td>
              <td v-for="c in columns" :key="c.key" :class="{ numeric: c.numeric }" :title="c.numeric ? undefined : String(r[c.key] ?? '')">
                <template v-if="c.numeric">{{ fmtInt(r[c.key]) }}</template>
                <template v-else-if="r[c.key] === '' || r[c.key] == null"><span class="muted">{{ c.emptyLabel ?? t('(порожньо)') }}</span></template>
                <template v-else>{{ r[c.key] }}</template>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="total">
            <tr>
              <td />
              <td v-for="(c, i) in columns" :key="c.key" :class="{ numeric: c.numeric }">
                <template v-if="c.numeric">{{ fmtInt(total[c.key]) }}</template>
                <template v-else-if="i === 0">{{ t('Загальний підсумок') }}</template>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="pager">
        <span class="muted">{{ t('{a}–{b} з {n}', { a: firstIdx + 1, b: Math.min(firstIdx + size, rows.length), n: rows.length }) }}</span>
        <div class="btns">
          <button v-if="csv" class="btn sm ghost no-print" @click="exportCsv"><Download :size="14" :stroke-width="1.9" />CSV</button>
          <button class="btn sm no-print" :disabled="page <= 1" :aria-label="t('Попередня сторінка')" @click="page--"><ChevronLeft :size="16" /></button>
          <button class="btn sm no-print" :disabled="page >= pages" :aria-label="t('Наступна сторінка')" @click="page++"><ChevronRight :size="16" /></button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--hair); text-align: left; }
td { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
th { font-weight: 600; font-size: 12.5px; color: var(--ink-2); white-space: nowrap; background: var(--grid); }
.numeric { text-align: right; }
.idx { width: 1%; white-space: nowrap; }
tfoot td { font-weight: 650; border-bottom: none; }
tr.pick { cursor: pointer; }
tr.pick:hover td { background: var(--accent-wash); }
tr.pick:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
tr.dim td { opacity: .45; }
.sort { all: unset; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; }
.sort:focus-visible { outline: 2px solid var(--accent); }
.arrow { color: var(--ink-3); opacity: .6; flex: none; }
.arrow.on { color: var(--accent); opacity: 1; }
.sort:hover .arrow { opacity: 1; }
.pager { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 10px; font-size: 13px; }
.btns { display: flex; gap: 6px; }
.ghost { border-color: transparent; color: var(--ink-2); }
.ghost:hover { border-color: var(--hair-strong); }
</style>
