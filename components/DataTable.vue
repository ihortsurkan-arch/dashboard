<script setup lang="ts" generic="T extends Record<string, any>">
interface Column { key: string; label: string; numeric?: boolean; emptyLabel?: string }

const props = defineProps<{
  columns: Column[]
  rows: T[]
  total?: Record<string, number>
  pageSize?: number
}>()

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
const ariaSort = (key: string) => sortKey.value !== key ? 'none' : sortDir.value === 1 ? 'ascending' : 'descending'
</script>

<template>
  <div>
    <div v-if="!rows.length" class="empty">Немає даних за обраний період</div>
    <template v-else>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th class="idx">#</th>
              <th v-for="c in columns" :key="c.key" :class="{ numeric: c.numeric }" :aria-sort="ariaSort(c.key)">
                <button class="sort" @click="sortBy(c.key)">
                  {{ c.label }}<span class="arrow">{{ sortKey === c.key ? (sortDir === 1 ? '▲' : '▼') : '' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in visible" :key="i">
              <td class="idx muted">{{ firstIdx + i + 1 }}.</td>
              <td v-for="c in columns" :key="c.key" :class="{ numeric: c.numeric }" :title="c.numeric ? undefined : String(r[c.key] ?? '')">
                <template v-if="c.numeric">{{ fmtInt(r[c.key]) }}</template>
                <template v-else-if="r[c.key] === '' || r[c.key] == null"><span class="muted">{{ c.emptyLabel ?? '(порожньо)' }}</span></template>
                <template v-else>{{ r[c.key] }}</template>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="total">
            <tr>
              <td />
              <td v-for="(c, i) in columns" :key="c.key" :class="{ numeric: c.numeric }">
                <template v-if="c.numeric">{{ fmtInt(total[c.key]) }}</template>
                <template v-else-if="i === 0">Загальний підсумок</template>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="pager">
        <span class="muted">{{ firstIdx + 1 }}–{{ Math.min(firstIdx + size, rows.length) }} з {{ rows.length }}</span>
        <div class="btns">
          <button class="btn sm" :disabled="page <= 1" aria-label="Попередня сторінка" @click="page--">‹</button>
          <button class="btn sm" :disabled="page >= pages" aria-label="Наступна сторінка" @click="page++">›</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; }
td { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
th { font-weight: 600; font-size: 12.5px; color: var(--muted); white-space: nowrap; background: var(--grid); }
.numeric { text-align: right; }
.idx { width: 1%; white-space: nowrap; }
tfoot td { font-weight: 650; border-bottom: none; }
.sort { all: unset; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; }
.sort:focus-visible { outline: 2px solid var(--accent); }
.arrow { font-size: 9px; width: 8px; }
.pager { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 10px; font-size: 13px; }
.btns { display: flex; gap: 6px; }
</style>
