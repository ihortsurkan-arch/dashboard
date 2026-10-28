<script setup lang="ts">
import type { Stats } from '~~/shared/stats'

interface Landing { id: number; name: string; hostname: string }

const route = useRoute()
const router = useRouter()

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
// Local "today" in the viewer's timezone, as YYYY-MM-DD
const today = () => {
  const d = new Date()
  return iso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}
const shift = (d: string, n: number) => iso(Date.parse(`${d}T00:00:00Z`) + n * DAY)

const presets = [
  { id: '7', label: '7 днів', range: () => [shift(today(), -7), shift(today(), -1)] },
  { id: '28', label: '28 днів', range: () => [shift(today(), -28), shift(today(), -1)] },
  { id: '90', label: '90 днів', range: () => [shift(today(), -90), shift(today(), -1)] },
  { id: 'month', label: 'Цей місяць', range: () => [today().slice(0, 8) + '01', today()] },
  {
    id: 'lastmonth', label: 'Минулий місяць', range: () => {
      const first = today().slice(0, 8) + '01'
      const end = shift(first, -1)
      return [end.slice(0, 8) + '01', end]
    },
  },
]

const { data: landings, error: landingsError } = await useFetch<Landing[]>('/api/landings', { default: () => [] })

const landingId = ref<number | null>(null)
const [defFrom, defTo] = presets[1].range()
const from = ref(String(route.query.from ?? defFrom))
const to = ref(String(route.query.to ?? defTo))
const draftFrom = ref(from.value)
const draftTo = ref(to.value)

watch(landings, (ls) => {
  if (!ls?.length) { landingId.value = null; return }
  const q = Number(route.query.landing)
  landingId.value = ls.some((l) => l.id === q) ? q : (ls.some((l) => l.id === landingId.value) ? landingId.value : ls[0].id)
}, { immediate: true })

const stats = ref<Stats | null>(null)
const loading = ref(false)
const error = ref('')
let seq = 0

async function load() {
  if (!landingId.value) { stats.value = null; return }
  const my = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<Stats>('/api/stats', { query: { landing: landingId.value, from: from.value, to: to.value } })
    if (my === seq) stats.value = res
  } catch (e: any) {
    if (my === seq) { error.value = e?.data?.statusMessage || 'Не вдалося завантажити дані'; stats.value = null }
  } finally {
    if (my === seq) loading.value = false
  }
}

watch([landingId, from, to], () => {
  router.replace({ query: { landing: landingId.value ?? undefined, from: from.value, to: to.value } })
  load()
}, { immediate: true })

function applyPreset(p: typeof presets[number]) {
  const [f, t] = p.range()
  draftFrom.value = f
  draftTo.value = t
  from.value = f
  to.value = t
}
const activePreset = computed(() => presets.find((p) => { const [f, t] = p.range(); return f === from.value && t === to.value })?.id)
const draftValid = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(draftFrom.value) && /^\d{4}-\d{2}-\d{2}$/.test(draftTo.value) && draftFrom.value <= draftTo.value)
const draftChanged = computed(() => draftFrom.value !== from.value || draftTo.value !== to.value)
function applyDates() {
  if (!draftValid.value) return
  from.value = draftFrom.value
  to.value = draftTo.value
}

// ---- derived chart data ----
const s = computed(() => stats.value)
const dayLabels = computed(() => s.value?.daily.map((d) => fmtDay(d.date)) ?? [])
const monthLabels = computed(() => s.value?.monthly.map((m) => fmtMonth(m.month)) ?? [])
const lv = (rows?: { label: string; value: number }[]) => ({ labels: rows?.map((r) => r.label) ?? [], values: rows?.map((r) => r.value) ?? [] })
</script>

<template>
  <div class="container page">
    <div v-if="landingsError" class="card error">Не вдалося завантажити список лендингів.</div>

    <div v-else-if="!landings?.length" class="card empty-state">
      <h2>Немає доступних лендингів</h2>
      <p class="muted">Попросіть адміністратора видати вам доступ до потрібних лендингів.</p>
    </div>

    <template v-else>
      <section class="toolbar card">
        <label class="field landing">Лендинг
          <select v-model.number="landingId" class="input">
            <option v-for="l in landings" :key="l.id" :value="l.id">{{ l.name }} — {{ l.hostname }}</option>
          </select>
        </label>
        <div class="dates">
          <label class="field">З
            <input v-model="draftFrom" class="input" type="date" min="2015-08-14" :max="today()" @keydown.enter="applyDates">
          </label>
          <label class="field">По
            <input v-model="draftTo" class="input" type="date" min="2015-08-14" :max="today()" @keydown.enter="applyDates">
          </label>
          <button class="btn primary apply" :disabled="!draftValid || !draftChanged" @click="applyDates">Застосувати</button>
        </div>
        <div class="presets" role="group" aria-label="Швидкий вибір періоду">
          <button v-for="p in presets" :key="p.id" class="btn sm" :class="{ on: activePreset === p.id }" @click="applyPreset(p)">{{ p.label }}</button>
        </div>
      </section>

      <div class="head">
        <div>
          <h1>{{ s?.landing.name ?? landings.find((l) => l.id === landingId)?.name }}</h1>
          <p v-if="s" class="muted">
            {{ fmtRange(s.range.from, s.range.to) }} · порівняння з {{ fmtRange(s.prev.from, s.prev.to) }}
            <span v-if="s.mock" class="badge">демо-дані</span>
          </p>
        </div>
        <span v-if="loading && s" class="muted small">Оновлення…</span>
      </div>

      <div v-if="error" class="card error" role="alert">{{ error }}</div>

      <div v-else-if="!s" class="kpis">
        <div v-for="i in 5" :key="i" class="card skeleton-card"><div class="skeleton" style="height: 100px" /></div>
      </div>

      <div v-else :class="{ refreshing: loading }">
        <section class="kpis" aria-label="Ключові показники">
          <KpiCard title="Sessions" :value="s.kpis.sessions.value" :prev="s.kpis.sessions.prev" format="int"
                   :spark="s.daily.map((d) => d.sessions)" :spark-labels="dayLabels" />
          <KpiCard title="Leads" :value="s.kpis.leads.value" :prev="s.kpis.leads.prev" format="int"
                   :spark="s.daily.map((d) => d.leads)" :spark-labels="dayLabels" />
          <KpiCard title="Avg. Session Duration" :value="s.kpis.avgSessionDuration.value" :prev="s.kpis.avgSessionDuration.prev" format="duration"
                   :spark="s.daily.map((d) => d.avgSessionDuration)" :spark-labels="dayLabels" />
          <KpiCard title="Avg. Session Duration for Leads" :value="s.kpis.leads.value ? s.kpis.avgSessionDurationLeads.value : null"
                   :prev="s.kpis.leads.prev ? s.kpis.avgSessionDurationLeads.prev : null" format="duration"
                   :spark="s.daily.map((d) => d.avgSessionDurationLeads)" :spark-labels="dayLabels" hint="Немає лідів за період" />
          <KpiCard title="Bounce rate" :value="s.kpis.sessions.value ? s.kpis.bounceRate.value : null" :prev="s.kpis.sessions.prev ? s.kpis.bounceRate.prev : null"
                   format="pct" good-when="down" :spark="s.daily.map((d) => d.bounceRate)" :spark-labels="dayLabels" />
        </section>

        <h2 class="section">Ліди <span class="muted small">подія {{ s.leadEvent }}</span></h2>
        <div class="grid-3">
          <div class="card">
            <h3>Leads by Source</h3>
            <p class="note">Частка лідів за джерелом сесії</p>
            <PieChart v-bind="lv(s.leadsBySource)" series-name="Leads" />
          </div>
          <div class="card">
            <h3>Leads by Device</h3>
            <p class="note">Ліди за типом пристрою</p>
            <BarsChart v-bind="lv(s.leadsByDevice)" horizontal series-name="Leads" color-var="--c2" />
          </div>
          <div class="card">
            <h3>Leads by Channel</h3>
            <p class="note">Ліди за каналом GA4</p>
            <BarsChart v-bind="lv(s.leadsByChannel)" horizontal series-name="Leads" color-var="--c2" />
          </div>
        </div>
        <div class="grid-2 mt">
          <div class="card">
            <h3>Leads Daily</h3>
            <p class="note">Ліди по днях</p>
            <BarsChart :labels="dayLabels" :values="s.daily.map((d) => d.leads)" series-name="Leads" color-var="--c2" />
          </div>
          <div class="card">
            <h3>Leads Monthly</h3>
            <p class="note">Ліди по місяцях у межах періоду</p>
            <BarsChart :labels="monthLabels" :values="s.monthly.map((m) => m.leads)" series-name="Leads" color-var="--c2" />
          </div>
        </div>

        <h2 class="section">Сесії</h2>
        <div class="grid-2">
          <div class="card">
            <h3>Sessions by Device</h3>
            <p class="note">Сесії за типом пристрою</p>
            <BarsChart v-bind="lv(s.sessionsByDevice)" horizontal series-name="Sessions" />
          </div>
          <div class="card">
            <h3>Sessions by Channel</h3>
            <p class="note">Сесії за каналом GA4</p>
            <BarsChart v-bind="lv(s.sessionsByChannel)" horizontal series-name="Sessions" />
          </div>
          <div class="card">
            <h3>Sessions Daily</h3>
            <p class="note">Сесії по днях</p>
            <BarsChart :labels="dayLabels" :values="s.daily.map((d) => d.sessions)" series-name="Sessions" />
          </div>
          <div class="card">
            <h3>Sessions Monthly</h3>
            <p class="note">Сесії по місяцях у межах періоду</p>
            <BarsChart :labels="monthLabels" :values="s.monthly.map((m) => m.sessions)" series-name="Sessions" />
          </div>
        </div>

        <h2 class="section">Джерела трафіку</h2>
        <div class="tables">
          <div class="card">
            <h3>Referrers Stats</h3>
            <p class="note">Сторінка, з якої прийшов відвідувач</p>
            <DataTable
              :columns="[{ key: 'referrer', label: 'Page referrer', emptyLabel: '(без реферера)' }, { key: 'sessions', label: 'Sessions', numeric: true }, { key: 'events', label: 'Event count', numeric: true }]"
              :rows="s.referrers.rows" :total="s.referrers.total" />
          </div>
          <div class="card">
            <h3>Source</h3>
            <p class="note">UTM source сесії</p>
            <DataTable
              :columns="[{ key: 'source', label: 'UTM_Source' }, { key: 'sessions', label: 'Sessions', numeric: true }, { key: 'events', label: 'Event count', numeric: true }]"
              :rows="s.sources.rows" :total="s.sources.total" />
          </div>
          <div class="card">
            <h3>Source + Campaign</h3>
            <p class="note">UTM source і campaign сесії</p>
            <DataTable
              :columns="[{ key: 'source', label: 'UTM_Source' }, { key: 'campaign', label: 'UTM_Campaign' }, { key: 'sessions', label: 'Sessions', numeric: true }, { key: 'events', label: 'Event count', numeric: true }]"
              :rows="s.sourceCampaign.rows" :total="s.sourceCampaign.total" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding-top: 16px; padding-bottom: 48px; display: grid; gap: 16px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: flex-end; padding: 14px 16px; }
.landing { flex: 1 1 260px; }
.landing select { width: 100%; }
.dates { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.presets { display: flex; gap: 6px; flex-wrap: wrap; flex-basis: 100%; }
.presets .on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
.head h1 { font-size: 22px; }
.head p { margin: 4px 0 0; font-size: 13.5px; }
.badge { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 99px; background: var(--accent-soft); color: var(--accent); font-size: 12px; }
.small { font-size: 13px; font-weight: 400; }
.kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); }
.section { font-size: 17px; margin: 28px 0 12px; display: flex; gap: 10px; align-items: baseline; }
.mt { margin-top: 16px; }
.tables { display: grid; gap: 16px; }
.refreshing { opacity: .55; transition: opacity .2s; }
.empty-state { text-align: center; padding: 48px 16px; }
.empty-state p { margin: 6px 0 0; }
.skeleton-card { padding: 16px; }
@media (max-width: 600px) {
  .dates { width: 100%; }
  .dates .field { flex: 1 1 130px; }
  .dates .input { width: 100%; }
  .apply { flex: 1 1 100%; justify-content: center; }
}
</style>
