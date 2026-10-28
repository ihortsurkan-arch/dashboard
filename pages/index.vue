<script setup lang="ts">
import { CalendarClock, CornerUpLeft, Filter, Hourglass, Inbox, Link2, MousePointerClick, Target, Timer } from 'lucide-vue-next'
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
      <span class="empty-ico" aria-hidden="true"><Inbox :size="22" :stroke-width="1.75" /></span>
      <h2>Немає доступних лендингів</h2>
      <p class="muted">Попросіть адміністратора видати вам доступ до потрібних лендингів.</p>
    </div>

    <template v-else>
      <section class="filters" aria-label="Фільтри">
        <label class="field landing">Лендинг
          <select v-model.number="landingId" class="input">
            <option v-for="l in landings" :key="l.id" :value="l.id">{{ l.name }} ({{ l.hostname }})</option>
          </select>
        </label>
        <div class="period">
          <div class="presets" role="group" aria-label="Швидкий вибір періоду">
            <button v-for="p in presets" :key="p.id" class="preset" :aria-pressed="activePreset === p.id" @click="applyPreset(p)">{{ p.label }}</button>
          </div>
          <div class="dates">
            <label class="field">З
              <input v-model="draftFrom" class="input" type="date" min="2015-08-14" :max="today()" @keydown.enter="applyDates">
            </label>
            <label class="field">По
              <input v-model="draftTo" class="input" type="date" min="2015-08-14" :max="today()" @keydown.enter="applyDates">
            </label>
            <button class="btn primary apply" :disabled="!draftValid || !draftChanged" @click="applyDates">Показати</button>
          </div>
        </div>
      </section>

      <header class="head">
        <h1>{{ s?.landing.name ?? landings.find((l) => l.id === landingId)?.name }}</h1>
        <p v-if="s" class="range">
          {{ fmtRange(s.range.from, s.range.to) }}, порівняння з {{ fmtRange(s.prev.from, s.prev.to) }}
          <span v-if="s.mock" class="badge">демо-дані</span>
          <span v-if="loading" class="updating">оновлюємо…</span>
        </p>
      </header>

      <div v-if="error" class="card error" role="alert">{{ error }}</div>

      <div v-else-if="!s" class="card strip">
        <div v-for="i in 5" :key="i" class="cell-skel"><div class="skeleton" style="height: 96px" /></div>
      </div>

      <div v-else class="body" :class="{ refreshing: loading }">
        <section class="card strip" aria-label="Ключові показники">
          <KpiCard :icon="MousePointerClick" :order="0" title="Sessions" :value="s.kpis.sessions.value" :prev="s.kpis.sessions.prev" format="int"
                   :spark="s.daily.map((d) => d.sessions)" :spark-labels="dayLabels" color-var="--sessions" />
          <KpiCard :icon="Target" :order="1" title="Leads" :value="s.kpis.leads.value" :prev="s.kpis.leads.prev" format="int"
                   :spark="s.daily.map((d) => d.leads)" :spark-labels="dayLabels" color-var="--leads" />
          <KpiCard :icon="Timer" :order="2" title="Avg. Session Duration" :value="s.kpis.avgSessionDuration.value" :prev="s.kpis.avgSessionDuration.prev" format="duration"
                   :spark="s.daily.map((d) => d.avgSessionDuration)" :spark-labels="dayLabels" color-var="--sessions" />
          <KpiCard :icon="Hourglass" :order="3" title="Avg. Session Duration for Leads" :value="s.kpis.leads.value ? s.kpis.avgSessionDurationLeads.value : null"
                   :prev="s.kpis.leads.prev ? s.kpis.avgSessionDurationLeads.prev : null" format="duration"
                   :spark="s.daily.map((d) => d.avgSessionDurationLeads)" :spark-labels="dayLabels" color-var="--leads" hint="Немає лідів за період" />
          <KpiCard :icon="CornerUpLeft" :order="4" title="Bounce rate" :value="s.kpis.sessions.value ? s.kpis.bounceRate.value : null" :prev="s.kpis.sessions.prev ? s.kpis.bounceRate.prev : null"
                   format="pct" good-when="down" :spark="s.daily.map((d) => d.bounceRate)" :spark-labels="dayLabels" color-var="--sessions" />
        </section>

        <section id="conversion" class="section">
          <div class="section-head">
            <h2><span class="key leads" aria-hidden="true"><Filter :size="16" :stroke-width="2" /></span>Конверсія</h2>
            <p class="muted">Скільки сесій закінчуються лідом і які джерела конвертують краще</p>
          </div>
          <div class="grid-2">
            <div class="card">
              <h3>Сесії → ліди</h3>
              <p class="note">Частка сесій, у яких була подія ліда</p>
              <ConversionFunnel :sessions="s.kpis.sessions" :lead-sessions="s.leadSessions" :leads="s.kpis.leads" />
            </div>
            <div class="card">
              <h3>Джерела лідів</h3>
              <p class="note">Ліди за джерелом сесії і скільки лідів припадає на сесію</p>
              <SourceRank :leads-by-source="s.leadsBySource" :sources="s.sources.rows" />
            </div>
          </div>
        </section>

        <section id="leads" class="section">
          <div class="section-head">
            <h2><span class="key leads" aria-hidden="true"><Target :size="16" :stroke-width="2" /></span>Ліди</h2>
            <p class="muted">Подія <code>{{ s.leadEvent }}</code> у GA4</p>
          </div>
          <div class="grid-3">
            <div class="card">
              <h3>Leads by Source</h3>
              <p class="note">Частка лідів за джерелом сесії</p>
              <PieChart v-bind="lv(s.leadsBySource)" series-name="Leads by Source" />
            </div>
            <div class="card">
              <h3>Leads by Device</h3>
              <p class="note">Ліди за типом пристрою</p>
              <BarsChart v-bind="lv(s.leadsByDevice)" horizontal series-name="Leads" color-var="--leads" />
            </div>
            <div class="card">
              <h3>Leads by Channel</h3>
              <p class="note">Ліди за каналом GA4</p>
              <BarsChart v-bind="lv(s.leadsByChannel)" horizontal series-name="Leads" color-var="--leads" />
            </div>
          </div>
          <div class="grid-2">
            <div class="card">
              <h3>Leads Daily</h3>
              <p class="note">Ліди по днях проти попереднього періоду</p>
              <TrendChart :dates="s.daily.map((d) => d.date)" :values="s.daily.map((d) => d.leads)"
                          :prev-dates="s.dailyPrev.map((d) => d.date)" :prev-values="s.dailyPrev.map((d) => d.leads)"
                          series-name="Leads" color-var="--leads" />
            </div>
            <div class="card">
              <h3>Leads Monthly</h3>
              <p class="note">Ліди по місяцях у межах періоду</p>
              <BarsChart :labels="monthLabels" :values="s.monthly.map((m) => m.leads)" series-name="Leads" color-var="--leads" />
            </div>
          </div>
        </section>

        <section id="sessions" class="section">
          <div class="section-head">
            <h2><span class="key sessions" aria-hidden="true"><MousePointerClick :size="16" :stroke-width="2" /></span>Сесії</h2>
          </div>
          <div class="grid-2">
            <div class="card">
              <h3>Sessions by Device</h3>
              <p class="note">Сесії за типом пристрою</p>
              <BarsChart v-bind="lv(s.sessionsByDevice)" horizontal series-name="Sessions" color-var="--sessions" />
            </div>
            <div class="card">
              <h3>Sessions by Channel</h3>
              <p class="note">Сесії за каналом GA4</p>
              <BarsChart v-bind="lv(s.sessionsByChannel)" horizontal series-name="Sessions" color-var="--sessions" />
            </div>
            <div class="card">
              <h3>Sessions Daily</h3>
              <p class="note">Сесії по днях проти попереднього періоду</p>
              <TrendChart :dates="s.daily.map((d) => d.date)" :values="s.daily.map((d) => d.sessions)"
                          :prev-dates="s.dailyPrev.map((d) => d.date)" :prev-values="s.dailyPrev.map((d) => d.sessions)"
                          series-name="Sessions" color-var="--sessions" />
            </div>
            <div class="card">
              <h3>Sessions Monthly</h3>
              <p class="note">Сесії по місяцях у межах періоду</p>
              <BarsChart :labels="monthLabels" :values="s.monthly.map((m) => m.sessions)" series-name="Sessions" color-var="--sessions" />
            </div>
          </div>
        </section>

        <section id="when" class="section">
          <div class="section-head">
            <h2><span class="key neutral" aria-hidden="true"><CalendarClock :size="16" :stroke-width="2" /></span>Коли приходять</h2>
            <p class="muted">День тижня і година за обраний період</p>
          </div>
          <div class="card">
            <WeekHeatmap :cells="s.heatmap" />
          </div>
        </section>

        <section id="sources" class="section">
          <div class="section-head">
            <h2><span class="key neutral" aria-hidden="true"><Link2 :size="16" :stroke-width="2" /></span>Джерела трафіку</h2>
          </div>
          <div class="card">
            <h3>Referrers Stats</h3>
            <p class="note">Сторінка, з якої прийшов відвідувач</p>
            <DataTable
              :columns="[{ key: 'referrer', label: 'Page referrer', emptyLabel: '(без реферера)' }, { key: 'sessions', label: 'Sessions', numeric: true }, { key: 'events', label: 'Event count', numeric: true }]"
              :rows="s.referrers.rows" :total="s.referrers.total" />
          </div>
          <div class="grid-2 tables">
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
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding-top: 20px; padding-bottom: 56px; display: grid; gap: 18px; }
.filters { display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: flex-end; padding-bottom: 18px; border-bottom: 1px solid var(--hair); }
.landing { flex: 1 1 280px; max-width: 420px; }
.landing select { width: 100%; }
.period { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: flex-end; }
.presets { display: flex; gap: 2px; padding: 3px; background: var(--hair); border-radius: 10px; flex-wrap: wrap; }
.preset { all: unset; cursor: pointer; padding: 6px 11px; border-radius: 7px; font-size: 13.5px; color: var(--ink-2); white-space: nowrap; }
.preset:hover { color: var(--ink); }
.preset[aria-pressed='true'] { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
.preset:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.dates { display: flex; gap: 8px; align-items: flex-end; }
.head { display: grid; gap: 6px; padding-top: 6px; }
.head h1 { font-size: clamp(26px, 3.2vw, 36px); }
.range { margin: 0; color: var(--ink-2); font-size: 14px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.badge { padding: 1px 9px; border-radius: 99px; background: var(--accent-wash); color: var(--accent); font-size: 12px; font-weight: 600; }
.updating { color: var(--ink-3); font-size: 13px; }
.strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 0; overflow: hidden; }
.strip > :deep(.metric) + :deep(.metric), .cell-skel + .cell-skel { border-left: 1px solid var(--hair); }
.cell-skel { padding: 18px 20px; }
.body { display: grid; gap: 18px; }
.section { display: grid; gap: 14px; margin-top: 18px; }
.section-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.section-head h2 { display: flex; align-items: center; gap: 10px; }
.section-head p { margin: 0; font-size: 13.5px; }
.section-head code { font-family: inherit; font-weight: 600; color: var(--ink-2); }
.key { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: #fff; }
.key.leads { background: var(--leads); }
.key.sessions { background: var(--sessions); }
.key.neutral { background: var(--grid); color: var(--ink-2); }
.empty-ico { display: grid; place-items: center; width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 14px; background: var(--accent-wash); color: var(--accent); }
.refreshing { opacity: .55; transition: opacity .2s; }
.empty-state { text-align: center; padding: 48px 16px; }
.empty-state p { margin: 6px 0 0; }
@media (max-width: 1100px) {
  .strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .strip > :deep(.metric) { border-top: 1px solid var(--hair); border-left: 1px solid var(--hair); }
  .strip > :deep(.metric:nth-child(-n+3)) { border-top: none; }
  .strip > :deep(.metric:nth-child(3n+1)) { border-left: none; }
}
@media (max-width: 640px) {
  .strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .strip > :deep(.metric) { border-top: 1px solid var(--hair) !important; border-left: 1px solid var(--hair) !important; }
  .strip > :deep(.metric:nth-child(-n+2)) { border-top: none !important; }
  .strip > :deep(.metric:nth-child(2n+1)) { border-left: none !important; }
  .strip > :deep(.metric:last-child:nth-child(odd)) { grid-column: 1 / -1; }
  .filters { gap: 12px; }
  .landing { max-width: none; }
  .period, .dates { width: 100%; }
  .dates .field { flex: 1 1 0; }
  .dates .input { width: 100%; }
  .apply { align-self: flex-end; }
}
</style>
