<script setup lang="ts">
import {
  CalendarClock, CornerUpLeft, FileDown, Filter, Globe2, Hourglass, Inbox, Lightbulb, Link2, MousePointerClick,
  RefreshCw, Target, Timer,
} from 'lucide-vue-next'
import type { FilterKey, FilterOptions, Filters, Stats } from '~~/shared/stats'
import { FILTER_KEYS } from '~~/shared/stats'

interface Landing { id: number; name: string; hostname: string }

const route = useRoute()
const router = useRouter()
const { user } = useUserSession()
const period = usePeriod()
const { from, to } = period

const { data: landings, error: landingsError } = await useFetch<Landing[]>('/api/landings', { default: () => [] })

const landingId = ref<number | null>(null)
watch(landings, (ls) => {
  if (!ls?.length) { landingId.value = null; return }
  const q = Number(route.query.landing)
  const saved = readSaved().landing
  landingId.value = ls.some((l) => l.id === q) ? q
    : ls.some((l) => l.id === landingId.value) ? landingId.value
    : ls.some((l) => l.id === saved) ? saved!
    : ls[0].id
}, { immediate: true })

// Filters live in the URL so a filtered view can be shared as a link
const filters = ref<Filters>(Object.fromEntries(FILTER_KEYS.filter((k) => typeof route.query[k] === 'string').map((k) => [k, String(route.query[k])])))
function pick(key: FilterKey, value: string) {
  const next = { ...filters.value }
  if (next[key] === value) delete next[key]
  else next[key] = value
  filters.value = next
}

const stats = ref<Stats | null>(null)
const options = ref<FilterOptions | null>(null)
const loading = ref(false)
const error = ref('')
let seq = 0

async function load(fresh = false) {
  if (!landingId.value) { stats.value = null; return }
  const my = ++seq
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<Stats>('/api/stats', {
      query: { landing: landingId.value, from: from.value, to: to.value, ...filters.value, ...(fresh ? { fresh: '1' } : {}) },
    })
    if (my === seq) stats.value = res
  } catch (e: any) {
    if (my === seq) { error.value = e?.data?.statusMessage || t('Не вдалося завантажити дані'); stats.value = null }
  } finally {
    if (my === seq) loading.value = false
  }
}
async function loadOptions() {
  if (!landingId.value) return
  options.value = null
  try {
    options.value = await $fetch<FilterOptions>('/api/filter-options', { query: { landing: landingId.value, from: from.value, to: to.value } })
  } catch { options.value = {} }
}

// Switching landing clears filters (their values belong to the previous landing)
watch(landingId, (id, old) => { if (old && id !== old) filters.value = {} })
watch([landingId, from, to, filters], ([id]) => {
  router.replace({ query: { landing: id ?? undefined, from: from.value, to: to.value, ...filters.value } })
  if (id) writeSaved({ landing: id })
  load()
}, { immediate: true, deep: true })
watch([landingId, from, to], () => loadOptions(), { immediate: true })

// ---- derived ----
const s = computed(() => stats.value)
const monthLabels = computed(() => s.value?.monthly.map((m) => fmtMonth(m.month)) ?? [])
const lv = (rows?: { label: string; value: number }[]) => ({ labels: rows?.map((r) => r.label) ?? [], values: rows?.map((r) => r.value) ?? [] })
const days = computed(() => s.value?.daily.map((d) => d.date) ?? [])
const prevDays = computed(() => s.value?.dailyPrev.map((d) => d.date) ?? [])
const isAdmin = computed(() => user.value?.role === 'admin')

// One or two sentences that say what changed, computed from the numbers on the page
const insight = computed(() => {
  const x = s.value
  if (!x) return []
  const out: string[] = []
  const leads = x.kpis.leads
  const dl = change(leads.value, leads.prev)
  if (leads.value != null) {
    out.push(dl == null
      ? t('{n} лідів за період.', { n: fmtInt(leads.value) })
      : t('{n} лідів, {d} до попереднього періоду.', { n: fmtInt(leads.value), d: `${dl > 0 ? '+' : dl < 0 ? '−' : ''}${fmtPct(Math.abs(dl), 0)}` }))
  }
  const ses = x.kpis.sessions.value ?? 0
  const conv = ses ? (x.leadSessions.value ?? 0) / ses : null
  const pses = x.kpis.sessions.prev ?? 0
  const pconv = pses ? (x.leadSessions.prev ?? 0) / pses : null
  if (conv != null) {
    const pp = pconv != null ? (conv - pconv) * 100 : null
    out.push(pp != null && Math.abs(pp) >= 0.1
      ? t('Конверсія {c} ({p} п.п.).', { c: fmtPct(conv, 1), p: `${pp > 0 ? '+' : '−'}${fmtDec(Math.abs(pp))}` })
      : t('Конверсія {c}.', { c: fmtPct(conv, 1) }))
  }
  const totalLeads = x.leadsBySource.reduce((a, r) => a + r.value, 0)
  const top = x.leadsBySource[0]
  if (top && totalLeads) out.push(t('Найбільше лідів дає {s} ({p}).', { s: top.label, p: fmtPct(top.value / totalLeads, 0) }))
  const sess = new Map(x.sources.rows.map((r) => [r.source, r.sessions]))
  const best = x.leadsBySource.filter((r) => (sess.get(r.label) ?? 0) >= 20)
    .map((r) => ({ s: r.label, c: r.value / (sess.get(r.label) ?? 1) })).sort((a, b) => b.c - a.c)[0]
  if (best && top && best.s !== top.label) out.push(t('Найкраща конверсія у {s} ({c}).', { s: best.s, c: fmtPct(best.c, 1) }))
  return out
})

const fetchedAt = computed(() => (s.value ? fmtTime(s.value.fetchedAt) : ''))
function printPdf() { window.print() }
</script>

<template>
  <div id="overview" class="container page">
    <div v-if="landingsError" class="card error">{{ t('Не вдалося завантажити список лендингів.') }}</div>

    <div v-else-if="!landings?.length" class="card empty-state">
      <span class="empty-ico" aria-hidden="true"><Inbox :size="22" :stroke-width="1.75" /></span>
      <h2>{{ t('Немає доступних лендингів') }}</h2>
      <p class="muted">{{ t('Попросіть адміністратора видати вам доступ до потрібних лендингів.') }}</p>
    </div>

    <template v-else>
      <section class="filters" :aria-label="t('Фільтри')">
        <label class="field landing">{{ t('Лендинг') }}
          <select v-model.number="landingId" class="input">
            <option v-for="l in landings" :key="l.id" :value="l.id">{{ l.name }} ({{ l.hostname }})</option>
          </select>
        </label>
        <PeriodPicker :period="period" />
      </section>

      <FilterBar v-model="filters" :options="options" :loading="!options" />

      <header class="head">
        <div class="title-row">
          <h1>{{ s?.landing.name ?? landings.find((l) => l.id === landingId)?.name }}</h1>
          <div class="head-actions no-print">
            <span v-if="s" class="fresh" :title="t('Дані GA4 кешуються до 10 хвилин')">{{ t('Дані на {t}', { t: fetchedAt }) }}</span>
            <button class="btn sm ghost" :disabled="loading" :aria-label="t('Оновити зараз')" @click="load(true)">
              <RefreshCw :size="14" :stroke-width="2" :class="{ spin: loading }" />{{ t('Оновити') }}
            </button>
            <button class="btn sm ghost" :disabled="!s" @click="printPdf"><FileDown :size="14" :stroke-width="2" />PDF</button>
          </div>
        </div>
        <p v-if="s" class="range">
          {{ t('{a}, порівняння з {b}', { a: fmtRange(s.range.from, s.range.to), b: fmtRange(s.prev.from, s.prev.to) }) }}
          <span v-if="s.mock" class="badge">{{ t('демо-дані') }}</span>
        </p>
        <p v-if="insight.length" class="insight"><Lightbulb :size="16" :stroke-width="2" class="bulb" aria-hidden="true" /><span>{{ insight.join(' ') }}</span></p>
      </header>

      <div v-if="error" class="card error" role="alert">{{ error }}</div>

      <div v-else-if="!s" class="card strip">
        <div v-for="i in 5" :key="i" class="cell-skel"><div class="skeleton" style="height: 96px" /></div>
      </div>

      <div v-else class="body" :class="{ refreshing: loading }">
        <section class="card strip" :aria-label="t('Ключові показники')">
          <KpiCard :icon="MousePointerClick" :order="0" title="Sessions" :value="s.kpis.sessions.value" :prev="s.kpis.sessions.prev" format="int"
                   :spark="s.daily.map((d) => d.sessions)" :spark-labels="days.map(fmtDay)" color-var="--sessions" />
          <KpiCard :icon="Target" :order="1" title="Leads" :value="s.kpis.leads.value" :prev="s.kpis.leads.prev" format="int"
                   :spark="s.daily.map((d) => d.leads)" :spark-labels="days.map(fmtDay)" color-var="--leads" />
          <KpiCard :icon="Timer" :order="2" title="Avg. Session Duration" :value="s.kpis.avgSessionDuration.value" :prev="s.kpis.avgSessionDuration.prev" format="duration"
                   :spark="s.daily.map((d) => d.avgSessionDuration)" :spark-labels="days.map(fmtDay)" color-var="--sessions" />
          <KpiCard :icon="Hourglass" :order="3" title="Avg. Session Duration for Leads" :value="s.kpis.leads.value ? s.kpis.avgSessionDurationLeads.value : null"
                   :prev="s.kpis.leads.prev ? s.kpis.avgSessionDurationLeads.prev : null" format="duration"
                   :spark="s.daily.map((d) => d.avgSessionDurationLeads)" :spark-labels="days.map(fmtDay)" color-var="--leads" :hint="t('Немає лідів за період')" />
          <KpiCard :icon="CornerUpLeft" :order="4" title="Bounce rate" :value="s.kpis.sessions.value ? s.kpis.bounceRate.value : null" :prev="s.kpis.sessions.prev ? s.kpis.bounceRate.prev : null"
                   format="pct" good-when="down" :spark="s.daily.map((d) => d.bounceRate)" :spark-labels="days.map(fmtDay)" color-var="--sessions" />
        </section>

        <div class="grid-2">
          <div class="card"><TodayCard :sessions="s.today.sessions" :leads="s.today.leads" /></div>
          <div class="card"><GoalCard :goal="s.goal" :mtd="s.monthToDate" :is-admin="isAdmin" :landing-id="s.landing.id" /></div>
        </div>

        <section id="conversion" class="section">
          <div class="section-head">
            <h2><span class="key leads" aria-hidden="true"><Filter :size="16" :stroke-width="2" /></span>{{ t('Конверсія') }}</h2>
            <p class="muted">{{ t('Скільки сесій закінчуються лідом і які джерела конвертують краще') }}</p>
          </div>
          <div class="grid-2">
            <div class="card">
              <h3>{{ t('Сесії → ліди') }}</h3>
              <p class="note">{{ t('Частка сесій, у яких була подія ліда') }}</p>
              <ConversionFunnel :sessions="s.kpis.sessions" :lead-sessions="s.leadSessions" :leads="s.kpis.leads" />
            </div>
            <div class="card">
              <h3>{{ t('Джерела лідів') }}</h3>
              <p class="note">{{ t('Клік по джерелу фільтрує весь дашборд') }}</p>
              <SourceRank :leads-by-source="s.leadsBySource" :sources="s.sources.rows" :active="filters.source" @pick="pick('source', $event)" />
            </div>
          </div>
        </section>

        <section id="leads" class="section">
          <div class="section-head">
            <h2><span class="key leads" aria-hidden="true"><Target :size="16" :stroke-width="2" /></span>{{ t('Ліди') }}</h2>
            <p class="muted">{{ t('Подія') }} <code>{{ s.leadEvent }}</code> {{ t('у GA4') }}</p>
          </div>
          <div class="grid-3">
            <div class="card">
              <h3>Leads by Source</h3>
              <p class="note">{{ t('Частка лідів за джерелом сесії') }}</p>
              <PieChart v-bind="lv(s.leadsBySource)" series-name="Leads by Source" pickable :active="filters.source" @pick="pick('source', $event)" />
            </div>
            <div class="card">
              <h3>Leads by Device</h3>
              <p class="note">{{ t('Ліди за типом пристрою') }}</p>
              <BarsChart v-bind="lv(s.leadsByDevice)" horizontal series-name="Leads" color-var="--leads" pickable :active="filters.device" @pick="pick('device', $event)" />
            </div>
            <div class="card">
              <h3>Leads by Channel</h3>
              <p class="note">{{ t('Ліди за каналом GA4') }}</p>
              <BarsChart v-bind="lv(s.leadsByChannel)" horizontal series-name="Leads" color-var="--leads" pickable :active="filters.channel" @pick="pick('channel', $event)" />
            </div>
          </div>
          <div class="card">
            <h3>Leads Daily</h3>
            <p class="note">{{ t('Ліди по днях проти попереднього періоду') }}</p>
            <TrendChart :dates="days" :values="s.daily.map((d) => d.leads)" :prev-dates="prevDays" :prev-values="s.dailyPrev.map((d) => d.leads)"
                        series-name="Leads" color-var="--leads" :annotations="s.annotations" />
            <AnnotationsPanel :notes="s.annotations" :landing-id="s.landing.id" :from="s.range.from" :to="s.range.to" @changed="load(true)" />
          </div>
          <div class="grid-2">
            <div class="card">
              <h3>Leads Monthly</h3>
              <p class="note">{{ t('Ліди по місяцях у межах періоду') }}</p>
              <BarsChart :labels="monthLabels" :values="s.monthly.map((m) => m.leads)" series-name="Leads" color-var="--leads" />
            </div>
            <div class="card">
              <h3>{{ t('Сторінки входу') }}</h3>
              <p class="note">{{ t('Перша сторінка сесії, ліди і конверсія') }}</p>
              <BreakdownList :rows="s.landingPages" :label="t('Сторінка')" :limit="8" csv="landing-pages" />
            </div>
          </div>
        </section>

        <section id="sessions" class="section">
          <div class="section-head">
            <h2><span class="key sessions" aria-hidden="true"><MousePointerClick :size="16" :stroke-width="2" /></span>{{ t('Сесії') }}</h2>
          </div>
          <div class="grid-2">
            <div class="card">
              <h3>Sessions by Device</h3>
              <p class="note">{{ t('Сесії за типом пристрою') }}</p>
              <BarsChart v-bind="lv(s.sessionsByDevice)" horizontal series-name="Sessions" color-var="--sessions" pickable :active="filters.device" @pick="pick('device', $event)" />
            </div>
            <div class="card">
              <h3>Sessions by Channel</h3>
              <p class="note">{{ t('Сесії за каналом GA4') }}</p>
              <BarsChart v-bind="lv(s.sessionsByChannel)" horizontal series-name="Sessions" color-var="--sessions" pickable :active="filters.channel" @pick="pick('channel', $event)" />
            </div>
            <div class="card">
              <h3>Sessions Daily</h3>
              <p class="note">{{ t('Сесії по днях проти попереднього періоду') }}</p>
              <TrendChart :dates="days" :values="s.daily.map((d) => d.sessions)" :prev-dates="prevDays" :prev-values="s.dailyPrev.map((d) => d.sessions)"
                          series-name="Sessions" color-var="--sessions" :annotations="s.annotations" />
            </div>
            <div class="card">
              <h3>Sessions Monthly</h3>
              <p class="note">{{ t('Сесії по місяцях у межах періоду') }}</p>
              <BarsChart :labels="monthLabels" :values="s.monthly.map((m) => m.sessions)" series-name="Sessions" color-var="--sessions" />
            </div>
          </div>
        </section>

        <section id="geo" class="section">
          <div class="section-head">
            <h2><span class="key neutral" aria-hidden="true"><Globe2 :size="16" :stroke-width="2" /></span>{{ t('Географія') }}</h2>
            <p class="muted">{{ t('Клік по країні фільтрує весь дашборд') }}</p>
          </div>
          <div class="grid-2">
            <div class="card">
              <h3>{{ t('Країни') }}</h3>
              <p class="note">{{ t('Сесії, ліди і конверсія за країною') }}</p>
              <BreakdownList :rows="s.countries" :label="t('Країна')" :limit="10" pickable :active="filters.country" csv="countries" @pick="pick('country', $event)" />
            </div>
            <div class="card">
              <h3>{{ t('Міста') }}</h3>
              <p class="note">{{ t('Найбільші міста за сесіями') }}</p>
              <BreakdownList :rows="s.cities" :label="t('Місто')" :limit="10" csv="cities" />
            </div>
          </div>
        </section>

        <section id="when" class="section">
          <div class="section-head">
            <h2><span class="key neutral" aria-hidden="true"><CalendarClock :size="16" :stroke-width="2" /></span>{{ t('Коли приходять') }}</h2>
            <p class="muted">{{ t('День тижня і година за обраний період') }}</p>
          </div>
          <div class="card">
            <WeekHeatmap :cells="s.heatmap" />
          </div>
        </section>

        <section id="sources" class="section">
          <div class="section-head">
            <h2><span class="key neutral" aria-hidden="true"><Link2 :size="16" :stroke-width="2" /></span>{{ t('Джерела трафіку') }}</h2>
            <p class="muted">{{ t('Клік по рядку фільтрує весь дашборд') }}</p>
          </div>
          <div class="card">
            <h3>Referrers Stats</h3>
            <p class="note">{{ t('Сторінка, з якої прийшов відвідувач') }}</p>
            <DataTable
              :columns="[{ key: 'referrer', label: 'Page referrer', emptyLabel: t('(без реферера)') }, { key: 'sessions', label: 'Sessions', numeric: true }, { key: 'events', label: 'Event count', numeric: true }]"
              :rows="s.referrers.rows" :total="s.referrers.total" csv="referrers" />
          </div>
          <div class="grid-2 tables">
            <div class="card">
              <h3>Source</h3>
              <p class="note">{{ t('UTM source сесії') }}</p>
              <DataTable
                :columns="[{ key: 'source', label: 'UTM_Source' }, { key: 'sessions', label: 'Sessions', numeric: true }, { key: 'events', label: 'Event count', numeric: true }]"
                :rows="s.sources.rows" :total="s.sources.total" csv="sources" pick-key="source" :active="filters.source" @pick="pick('source', $event)" />
            </div>
            <div class="card">
              <h3>Source + Campaign</h3>
              <p class="note">{{ t('UTM source і campaign сесії') }}</p>
              <DataTable
                :columns="[{ key: 'source', label: 'UTM_Source' }, { key: 'campaign', label: 'UTM_Campaign' }, { key: 'sessions', label: 'Sessions', numeric: true }, { key: 'events', label: 'Event count', numeric: true }]"
                :rows="s.sourceCampaign.rows" :total="s.sourceCampaign.total" csv="source-campaign" pick-key="campaign" :active="filters.campaign" @pick="pick('campaign', $event)" />
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding-top: 20px; padding-bottom: 56px; display: grid; gap: 18px; }
.filters { display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: flex-end; }
.landing { flex: 1 1 280px; max-width: 420px; }
.landing select { width: 100%; }
.head { display: grid; gap: 6px; border-top: 1px solid var(--hair); }
.title-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 16px; }
.head h1 { font-size: clamp(26px, 3.2vw, 36px); }
.head-actions { display: flex; align-items: center; gap: 4px; }
.fresh { font-size: 12.5px; color: var(--ink-3); margin-right: 6px; }
.ghost { border-color: transparent; color: var(--ink-2); }
.ghost:hover:not(:disabled) { border-color: var(--hair-strong); color: var(--ink); }
.range { margin: 0; color: var(--ink-2); font-size: 14px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.badge { padding: 1px 9px; border-radius: 99px; background: var(--accent-wash); color: var(--accent); font-size: 12px; font-weight: 600; }
.insight { margin: 8px 0 0; display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.5; max-width: 80ch; }
.bulb { color: var(--c4); flex: none; margin-top: 3px; }
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
@media (prefers-reduced-motion: no-preference) {
  .spin { animation: spin .8s linear infinite; }
  .insight { animation: fadein .5s ease-out .8s both; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadein { from { opacity: 0; } }
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
  .fresh { display: none; }
}
</style>
