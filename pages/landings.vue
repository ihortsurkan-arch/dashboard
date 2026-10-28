<script setup lang="ts">
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, ChevronsUpDown, Download, FileDown, LayoutList, Search } from 'lucide-vue-next'
import type { Overview, OverviewRow } from '~~/shared/stats'

const router = useRouter()
const period = usePeriod()
const { from, to } = period

const data = ref<Overview | null>(null)
const loading = ref(false)
const error = ref('')
let seq = 0
async function load() {
  const my = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<Overview>('/api/overview', { query: { from: from.value, to: to.value } })
    if (my === seq) data.value = res
  } catch (e: any) {
    if (my === seq) error.value = e?.data?.statusMessage || t('Не вдалося завантажити дані')
  } finally { if (my === seq) loading.value = false }
}
watch([from, to], () => {
  router.replace({ query: { from: from.value, to: to.value } })
  load()
}, { immediate: true })

const conv = (r: OverviewRow, prev = false) => {
  const s = prev ? r.sessions.prev : r.sessions.value
  const l = prev ? r.leadSessions.prev : r.leadSessions.value
  return s ? (l ?? 0) / s : null
}
type Key = 'name' | 'sessions' | 'leads' | 'conv' | 'dLeads'
const sortKey = ref<Key>('leads')
const sortDir = ref<1 | -1>(-1)
const q = ref('')
const val = (r: OverviewRow, k: Key): number | string => {
  if (k === 'name') return r.name.toLowerCase()
  if (k === 'sessions') return r.sessions.value ?? 0
  if (k === 'leads') return r.leads.value ?? 0
  if (k === 'conv') return conv(r) ?? -1
  return change(r.leads.value, r.leads.prev) ?? -Infinity
}
const rows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return (data.value?.rows ?? [])
    .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.hostname.includes(needle))
    .sort((a, b) => {
      const x = val(a, sortKey.value), y = val(b, sortKey.value)
      return (typeof x === 'string' ? String(x).localeCompare(String(y)) : (x as number) - (y as number)) * sortDir.value
    })
})
function sortBy(k: Key) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 1 ? -1 : 1
  else { sortKey.value = k; sortDir.value = k === 'name' ? 1 : -1 }
}
const aria = (k: Key) => (sortKey.value !== k ? 'none' : sortDir.value === 1 ? 'ascending' : 'descending')

const totals = computed(() => {
  const rs = data.value?.rows ?? []
  const sum = (f: (r: OverviewRow) => number | null) => rs.reduce((a, r) => a + (f(r) ?? 0), 0)
  const s = sum((r) => r.sessions.value), ps = sum((r) => r.sessions.prev)
  const l = sum((r) => r.leads.value), pl = sum((r) => r.leads.prev)
  const ls = sum((r) => r.leadSessions.value), pls = sum((r) => r.leadSessions.prev)
  return { s, ps, l, pl, c: s ? ls / s : null, pc: ps ? pls / ps : null }
})
const pp = (a: number | null, b: number | null) => (a != null && b != null ? (a - b) * 100 : null)

function open(r: OverviewRow) {
  writeSaved({ landing: r.id })
  router.push({ path: '/', query: { landing: r.id, from: from.value, to: to.value } })
}
function printPdf() { window.print() }
function exportCsv() {
  const qq = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [[t('Лендинг'), t('Домен'), t('Сесії'), t('Сесії, попередній'), t('Ліди'), t('Ліди, попередній'), t('Конверсія')].map(qq).join(',')]
  for (const r of rows.value) lines.push([r.name, r.hostname, r.sessions.value, r.sessions.prev, r.leads.value, r.leads.prev, conv(r)?.toFixed(4) ?? ''].map(qq).join(','))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
  a.download = `landings-${from.value}_${to.value}.csv`
  a.click()
}
</script>

<template>
  <div class="container page">
    <section class="filters"><PeriodPicker :period="period" /></section>

    <header class="head">
      <div class="title-row">
        <h1><LayoutList :size="26" :stroke-width="1.9" class="h-ico" />{{ t('Усі лендинги') }}</h1>
        <div class="actions no-print">
          <label class="search"><Search :size="15" /><input v-model="q" class="input" :placeholder="t('Пошук лендингу')" :aria-label="t('Пошук лендингу')"></label>
          <button class="btn sm ghost" :disabled="!rows.length" @click="exportCsv"><Download :size="14" />CSV</button>
          <button class="btn sm ghost" :disabled="!data" @click="printPdf"><FileDown :size="14" />PDF</button>
        </div>
      </div>
      <p v-if="data" class="range">
        {{ t('{a}, порівняння з {b}', { a: fmtRange(data.range.from, data.range.to), b: fmtRange(data.prev.from, data.prev.to) }) }}
        <span v-if="data.mock" class="badge">{{ t('демо-дані') }}</span>
      </p>
    </header>

    <div v-if="error" class="card error" role="alert">{{ error }}</div>
    <div v-else-if="!data" class="card"><div class="skeleton" style="height: 220px" /></div>
    <div v-else-if="!data.rows.length" class="card empty">{{ t('Немає доступних лендингів') }}</div>

    <div v-else class="card table-card" :class="{ refreshing: loading }">
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th :aria-sort="aria('name')"><button class="sort" @click="sortBy('name')">{{ t('Лендинг') }}<component :is="sortKey === 'name' ? (sortDir === 1 ? ChevronUp : ChevronDown) : ChevronsUpDown" :size="13" class="arrow" :class="{ on: sortKey === 'name' }" /></button></th>
              <th class="r" :aria-sort="aria('sessions')"><button class="sort" @click="sortBy('sessions')">{{ t('Сесії') }}<component :is="sortKey === 'sessions' ? (sortDir === 1 ? ChevronUp : ChevronDown) : ChevronsUpDown" :size="13" class="arrow" :class="{ on: sortKey === 'sessions' }" /></button></th>
              <th class="r" :aria-sort="aria('leads')"><button class="sort" @click="sortBy('leads')">{{ t('Ліди') }}<component :is="sortKey === 'leads' ? (sortDir === 1 ? ChevronUp : ChevronDown) : ChevronsUpDown" :size="13" class="arrow" :class="{ on: sortKey === 'leads' }" /></button></th>
              <th class="r" :aria-sort="aria('dLeads')"><button class="sort" @click="sortBy('dLeads')">{{ t('Зміна лідів') }}<component :is="sortKey === 'dLeads' ? (sortDir === 1 ? ChevronUp : ChevronDown) : ChevronsUpDown" :size="13" class="arrow" :class="{ on: sortKey === 'dLeads' }" /></button></th>
              <th class="r" :aria-sort="aria('conv')"><button class="sort" @click="sortBy('conv')">{{ t('Конверсія') }}<component :is="sortKey === 'conv' ? (sortDir === 1 ? ChevronUp : ChevronDown) : ChevronsUpDown" :size="13" class="arrow" :class="{ on: sortKey === 'conv' }" /></button></th>
              <th class="hide-sm">{{ t('Сесії по днях') }}</th>
              <th class="hide-sm">{{ t('Ліди по днях') }}</th>
            </tr>
          </thead>
          <TransitionGroup tag="tbody" name="list">
            <tr v-for="r in rows" :key="r.id" tabindex="0" @click="open(r)" @keydown.enter="open(r)">
              <td><b>{{ r.name }}</b><div class="host">{{ r.hostname }}</div></td>
              <td class="r num">{{ fmtInt(r.sessions.value) }}<div class="sub" :class="(change(r.sessions.value, r.sessions.prev) ?? 0) >= 0 ? 'up' : 'down'">{{ change(r.sessions.value, r.sessions.prev) == null ? '' : `${(change(r.sessions.value, r.sessions.prev) ?? 0) > 0 ? '+' : ''}${fmtPct(change(r.sessions.value, r.sessions.prev), 0)}` }}</div></td>
              <td class="r num"><b>{{ fmtInt(r.leads.value) }}</b></td>
              <td class="r num">
                <span v-if="change(r.leads.value, r.leads.prev) != null" class="chg" :class="(change(r.leads.value, r.leads.prev) ?? 0) >= 0 ? 'up' : 'down'">
                  <ArrowUpRight v-if="(change(r.leads.value, r.leads.prev) ?? 0) > 0" :size="14" /><ArrowDownRight v-else-if="(change(r.leads.value, r.leads.prev) ?? 0) < 0" :size="14" />{{ fmtPct(Math.abs(change(r.leads.value, r.leads.prev) ?? 0), 0) }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="r num">{{ conv(r) == null ? '—' : fmtPct(conv(r), 1) }}<div v-if="pp(conv(r), conv(r, true)) != null" class="sub" :class="(pp(conv(r), conv(r, true)) ?? 0) >= 0 ? 'up' : 'down'">{{ (pp(conv(r), conv(r, true)) ?? 0) > 0 ? '+' : '' }}{{ fmtDec(pp(conv(r), conv(r, true)) ?? 0) }} {{ t('п.п.') }}</div></td>
              <td class="hide-sm"><MiniSpark :values="r.spark" color-var="--sessions" /></td>
              <td class="hide-sm"><MiniSpark :values="r.sparkLeads" color-var="--leads" /></td>
            </tr>
          </TransitionGroup>
          <tfoot>
            <tr>
              <td>{{ t('Разом') }}</td>
              <td class="r num">{{ fmtInt(totals.s) }}</td>
              <td class="r num">{{ fmtInt(totals.l) }}</td>
              <td class="r num"><span v-if="change(totals.l, totals.pl) != null" :class="(change(totals.l, totals.pl) ?? 0) >= 0 ? 'up' : 'down'">{{ (change(totals.l, totals.pl) ?? 0) > 0 ? '+' : '' }}{{ fmtPct(change(totals.l, totals.pl), 0) }}</span></td>
              <td class="r num">{{ totals.c == null ? '—' : fmtPct(totals.c, 1) }}</td>
              <td class="hide-sm" /><td class="hide-sm" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="hint no-print">{{ t('Клік по рядку відкриває дашборд лендингу за цей самий період.') }}</p>
    </div>
  </div>
</template>

<style scoped>
.page { padding-top: 20px; padding-bottom: 56px; display: grid; gap: 18px; }
.head { display: grid; gap: 6px; border-top: 1px solid var(--hair); }
.title-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding-top: 16px; }
h1 { display: flex; align-items: center; gap: 12px; font-size: clamp(26px, 3.2vw, 36px); }
.h-ico { color: var(--accent); }
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.search { position: relative; display: flex; align-items: center; color: var(--ink-3); }
.search svg { position: absolute; left: 10px; pointer-events: none; }
.search .input { padding-left: 32px; width: 220px; }
.range { margin: 0; color: var(--ink-2); font-size: 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.badge { padding: 1px 9px; border-radius: 99px; background: var(--accent-wash); color: var(--accent); font-size: 12px; font-weight: 600; }
.ghost { border-color: transparent; color: var(--ink-2); }
.table-card { padding: 8px 8px 12px; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--hair); text-align: left; vertical-align: middle; }
th { font-size: 12.5px; font-weight: 600; color: var(--ink-2); white-space: nowrap; }
.r { text-align: right; }
tbody tr { cursor: pointer; }
tbody tr:hover td { background: var(--accent-wash); }
tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.host { font-size: 12.5px; color: var(--ink-3); }
.sub { font-size: 12px; }
.up { color: var(--good); }
.down { color: var(--bad); }
.chg { display: inline-flex; align-items: center; gap: 2px; font-weight: 600; }
tfoot td { font-weight: 650; border-bottom: none; }
.num { font-variant-numeric: tabular-nums; }
.sort { all: unset; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; }
.sort:focus-visible { outline: 2px solid var(--accent); }
.arrow { color: var(--ink-3); opacity: .6; }
.arrow.on { color: var(--accent); opacity: 1; }
.hint { margin: 10px 12px 0; font-size: 12.5px; color: var(--ink-3); }
.refreshing { opacity: .55; transition: opacity .2s; }
@media (max-width: 760px) {
  .hide-sm { display: none; }
  .search .input { width: 100%; }
  .search { flex: 1 1 200px; }
}
</style>
