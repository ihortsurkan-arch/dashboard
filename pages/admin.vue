<script setup lang="ts">
import {
  BarChart3, Bell, Check, CircleAlert, CircleCheck, Flag, Globe, History, KeyRound, LoaderCircle, Pencil, Play, Plus,
  RefreshCw, Send, ShieldCheck, ShieldOff, Trash2, User as UserIcon, UserPlus, Users, X,
} from 'lucide-vue-next'

interface Landing { id: number; name: string; hostname: string }
interface User { id: number; login: string; role: 'admin' | 'user'; created_at: string; landing_ids: number[]; totp_enabled: boolean }
type Tab = 'users' | 'landings' | 'alerts' | 'log'

const route = useRoute()
const router = useRouter()
const { user: me } = useUserSession()
const tab = ref<Tab>((['users', 'landings', 'alerts', 'log'] as Tab[]).includes(route.query.tab as Tab) ? (route.query.tab as Tab) : 'users')
watch(tab, (v) => router.replace({ query: { tab: v } }))

const { data: landings, refresh: refreshLandings } = await useFetch<Landing[]>('/api/landings', { default: () => [] })
const { data: users, refresh: refreshUsers } = await useFetch<User[]>('/api/admin/users', { default: () => [] })
const landingName = (id: number) => landings.value?.find((l) => l.id === id)?.name ?? `#${id}`

const msg = ref('')
const err = ref('')
function flash(m: string) { msg.value = m; err.value = ''; setTimeout(() => { if (msg.value === m) msg.value = '' }, 3500) }
function fail(e: any) { err.value = e?.data?.statusMessage || t('Помилка'); msg.value = '' }

// ---- users ----
const nu = reactive({ login: '', password: '', role: 'user' as 'admin' | 'user', landingIds: [] as number[] })
function genPassword(target: { password: string }) {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const a = new Uint32Array(12)
  crypto.getRandomValues(a)
  target.password = [...a].map((x) => abc[x % abc.length]).join('')
}
async function createUser() {
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: nu })
    flash(t('Користувача {u} створено', { u: nu.login }))
    Object.assign(nu, { login: '', password: '', role: 'user', landingIds: [] })
    await refreshUsers()
  } catch (e) { fail(e) }
}
const editing = ref<number | null>(null)
const edit = reactive({ landingIds: [] as number[], role: 'user' as 'admin' | 'user', password: '' })
function startEdit(u: User) {
  editing.value = u.id
  Object.assign(edit, { landingIds: [...u.landing_ids], role: u.role, password: '' })
}
async function saveEdit(u: User) {
  try {
    await $fetch(`/api/admin/users/${u.id}`, {
      method: 'PUT',
      body: { landingIds: edit.landingIds, role: edit.role, ...(edit.password ? { password: edit.password } : {}) },
    })
    editing.value = null
    flash(t('Збережено: {u}', { u: u.login }))
    await refreshUsers()
  } catch (e) { fail(e) }
}
async function reset2fa(u: User) {
  if (!confirm(t('Скинути двофакторний вхід для {u}? Користувач зможе увійти лише з паролем.', { u: u.login }))) return
  try {
    await $fetch(`/api/admin/users/${u.id}`, { method: 'PUT', body: { reset2fa: true } })
    flash(t('Двофакторний вхід скинуто: {u}', { u: u.login }))
    await refreshUsers()
  } catch (e) { fail(e) }
}
async function deleteUser(u: User) {
  if (!confirm(t('Видалити користувача {u}?', { u: u.login }))) return
  try {
    await $fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    flash(t('Видалено: {u}', { u: u.login }))
    await refreshUsers()
  } catch (e) { fail(e) }
}

// ---- landings ----
const nl = reactive({ name: '', hostname: '' })
const { data: hostnames, status: hostsStatus, execute: loadHosts } = useLazyFetch<{ hostname: string; sessions: number }[]>('/api/admin/hostnames', { immediate: false, default: () => [] })
const hostsPending = computed(() => hostsStatus.value === 'pending')
const unusedHosts = computed(() => (hostnames.value ?? []).filter((h) => h.hostname && !landings.value?.some((l) => l.hostname === h.hostname)))
async function createLanding() {
  try {
    await $fetch('/api/admin/landings', { method: 'POST', body: nl })
    flash(t('Лендинг {h} додано', { h: nl.hostname }))
    Object.assign(nl, { name: '', hostname: '' })
    await refreshLandings()
  } catch (e) { fail(e) }
}
const editingL = ref<number | null>(null)
const el = reactive({ name: '', hostname: '', goal: '' as string | number })
const goalMonth = new Date().toISOString().slice(0, 7)
async function startEditL(l: Landing) {
  editingL.value = l.id
  Object.assign(el, { name: l.name, hostname: l.hostname, goal: '' })
  try {
    const g = await $fetch<{ leads: number | null }>(`/api/admin/landings/${l.id}/goal`)
    el.goal = g.leads ?? ''
  } catch {}
}
async function saveL(l: Landing) {
  try {
    await $fetch(`/api/admin/landings/${l.id}`, { method: 'PUT', body: { name: el.name, hostname: el.hostname } })
    await $fetch(`/api/admin/landings/${l.id}/goal`, { method: 'PUT', body: { month: goalMonth, leads: Number(el.goal) || 0 } })
    editingL.value = null
    flash(t('Лендинг збережено'))
    await refreshLandings()
  } catch (e) { fail(e) }
}
async function deleteLanding(l: Landing) {
  if (!confirm(t('Видалити лендинг {n}? Доступи до нього також зникнуть.', { n: l.name }))) return
  try {
    await $fetch(`/api/admin/landings/${l.id}`, { method: 'DELETE' })
    flash(t('Лендинг видалено'))
    await Promise.all([refreshLandings(), refreshUsers()])
  } catch (e) { fail(e) }
}
// A link from the dashboard's plan card opens the landing straight in edit mode
onMounted(() => {
  const id = Number(route.query.goal)
  const l = landings.value?.find((x) => x.id === id)
  if (l) { tab.value = 'landings'; startEditL(l) }
})

// ---- alerts ----
const { data: tg, refresh: refreshTg } = useLazyFetch<{ configured: boolean; cron: boolean }>('/api/admin/telegram', { immediate: false })
const tgBusy = ref('')
const preview = ref('')
async function tgAction(action: 'test' | 'run') {
  tgBusy.value = action
  try {
    const res: any = await $fetch('/api/admin/telegram', { method: 'POST', body: { action } })
    if (action === 'test') flash(t('Тестове повідомлення надіслано'))
    else {
      preview.value = res.preview || t('Немає сповіщень: усі лендинги в межах норми.')
      flash(res.sent ? t('Перевірку виконано, звіт надіслано в Telegram') : t('Перевірку виконано'))
    }
  } catch (e) { fail(e) } finally { tgBusy.value = '' }
}

// ---- log ----
const { data: log, refresh: refreshLog, status: logStatus } = useLazyFetch<{ id: number; at: string; actor: string; action: string; details: string }[]>('/api/admin/audit', { immediate: false, default: () => [] })
const ACTIONS: Record<string, string> = {
  login: 'Вхід', 'login.fail': 'Невдалий вхід', 'user.create': 'Створено користувача', 'user.update': 'Змінено користувача',
  'user.delete': 'Видалено користувача', 'landing.create': 'Додано лендинг', 'landing.update': 'Змінено лендинг',
  'landing.delete': 'Видалено лендинг', 'goal.set': 'Задано план', 'goal.remove': 'Прибрано план',
  'account.password': 'Змінено свій пароль', 'account.2fa.enable': 'Увімкнено 2FA', 'account.2fa.disable': 'Вимкнено 2FA',
  'telegram.test': 'Тест Telegram', 'telegram.run': 'Ручна перевірка сповіщень',
}
watch(tab, (v) => {
  if (v === 'alerts') refreshTg()
  if (v === 'log') refreshLog()
}, { immediate: true })
</script>

<template>
  <div class="container page">
    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'users'" :class="{ on: tab === 'users' }" @click="tab = 'users'"><Users :size="16" :stroke-width="1.75" />{{ t('Користувачі') }} ({{ users?.length ?? 0 }})</button>
      <button role="tab" :aria-selected="tab === 'landings'" :class="{ on: tab === 'landings' }" @click="tab = 'landings'"><Globe :size="16" :stroke-width="1.75" />{{ t('Лендинги') }} ({{ landings?.length ?? 0 }})</button>
      <button role="tab" :aria-selected="tab === 'alerts'" :class="{ on: tab === 'alerts' }" @click="tab = 'alerts'"><Bell :size="16" :stroke-width="1.75" />{{ t('Сповіщення') }}</button>
      <button role="tab" :aria-selected="tab === 'log'" :class="{ on: tab === 'log' }" @click="tab = 'log'"><History :size="16" :stroke-width="1.75" />{{ t('Журнал') }}</button>
    </div>

    <Transition name="toast"><p v-if="msg" class="flash ok"><CircleCheck :size="16" :stroke-width="2" />{{ msg }}</p></Transition>
    <Transition name="toast"><p v-if="err" class="flash error" role="alert"><CircleAlert :size="16" :stroke-width="2" />{{ err }}</p></Transition>

    <!-- USERS -->
    <template v-if="tab === 'users'">
      <section class="card">
        <h3>{{ t('Новий користувач') }}</h3>
        <div class="form">
          <label class="field">{{ t('Логін') }} <input v-model="nu.login" class="input" autocomplete="off"></label>
          <label class="field">{{ t('Пароль') }}
            <span class="row"><input v-model="nu.password" class="input grow" autocomplete="new-password"><button class="btn sm" type="button" @click="genPassword(nu)"><KeyRound :size="15" :stroke-width="1.9" />{{ t('Згенерувати') }}</button></span>
          </label>
          <label class="field">{{ t('Роль') }}
            <select v-model="nu.role" class="input"><option value="user">{{ t('Користувач') }}</option><option value="admin">{{ t('Адміністратор') }}</option></select>
          </label>
        </div>
        <fieldset v-if="nu.role === 'user'" class="checks">
          <legend>{{ t('Доступ до лендингів') }}</legend>
          <label v-for="l in landings" :key="l.id" class="check"><input v-model="nu.landingIds" type="checkbox" :value="l.id"> {{ l.name }} <span class="muted">{{ l.hostname }}</span></label>
          <span v-if="!landings?.length" class="muted">{{ t('Спершу додайте лендинги на вкладці «Лендинги».') }}</span>
        </fieldset>
        <button class="btn primary" :disabled="!nu.login || nu.password.length < 8" @click="createUser"><UserPlus :size="15" :stroke-width="1.9" />{{ t('Створити') }}</button>
        <p class="muted tiny">{{ t('Пароль щонайменше 8 символів. Передайте його користувачу окремо: тут він більше не показується.') }}</p>
      </section>

      <TransitionGroup tag="section" name="list" class="card list">
        <div v-for="u in users" :key="u.id" class="item">
          <div class="item-head">
            <div class="who-l">
              <span class="avatar" :class="u.role"><ShieldCheck v-if="u.role === 'admin'" :size="16" :stroke-width="1.9" /><UserIcon v-else :size="16" :stroke-width="1.9" /></span>
              <div>
                <b>{{ u.login }}</b>
                <span class="role" :class="u.role">{{ u.role === 'admin' ? t('адмін') : t('користувач') }}</span>
                <span v-if="u.totp_enabled" class="role tfa" :title="t('Двофакторний вхід увімкнено')">2FA</span>
                <span v-if="u.id === me?.id" class="muted tiny">{{ t('(це ви)') }}</span>
                <div class="muted tiny">
                  <template v-if="u.role === 'admin'">{{ t('Бачить усі лендинги') }}</template>
                  <template v-else-if="u.landing_ids.length">{{ u.landing_ids.map(landingName).join(', ') }}</template>
                  <template v-else>{{ t('Немає доступу до лендингів') }}</template>
                </div>
              </div>
            </div>
            <div class="actions">
              <button v-if="editing !== u.id" class="btn sm" @click="startEdit(u)"><Pencil :size="15" :stroke-width="1.9" />{{ t('Змінити') }}</button>
              <button v-if="u.id !== me?.id" class="btn sm danger" @click="deleteUser(u)"><Trash2 :size="15" :stroke-width="1.9" />{{ t('Видалити') }}</button>
            </div>
          </div>
          <Transition name="expand">
            <div v-if="editing === u.id" class="edit">
              <div class="form">
                <label class="field">{{ t('Роль') }}
                  <select v-model="edit.role" class="input" :disabled="u.id === me?.id"><option value="user">{{ t('Користувач') }}</option><option value="admin">{{ t('Адміністратор') }}</option></select>
                </label>
                <label class="field">{{ t('Новий пароль (необовʼязково)') }}
                  <span class="row"><input v-model="edit.password" class="input grow" autocomplete="new-password"><button class="btn sm" type="button" @click="genPassword(edit)"><KeyRound :size="15" />{{ t('Згенерувати') }}</button></span>
                </label>
              </div>
              <fieldset v-if="edit.role === 'user'" class="checks">
                <legend>{{ t('Доступ до лендингів') }}</legend>
                <label v-for="l in landings" :key="l.id" class="check"><input v-model="edit.landingIds" type="checkbox" :value="l.id"> {{ l.name }} <span class="muted">{{ l.hostname }}</span></label>
              </fieldset>
              <div class="row">
                <button class="btn primary sm" :disabled="!!edit.password && edit.password.length < 8" @click="saveEdit(u)"><Check :size="15" :stroke-width="1.9" />{{ t('Зберегти') }}</button>
                <button class="btn sm" @click="editing = null"><X :size="15" :stroke-width="1.9" />{{ t('Скасувати') }}</button>
                <button v-if="u.totp_enabled && u.id !== me?.id" class="btn sm danger" @click="reset2fa(u)"><ShieldOff :size="15" />{{ t('Скинути 2FA') }}</button>
              </div>
            </div>
          </Transition>
        </div>
      </TransitionGroup>
    </template>

    <!-- LANDINGS -->
    <template v-else-if="tab === 'landings'">
      <section class="card">
        <h3>{{ t('Новий лендинг') }}</h3>
        <p class="note">{{ t('Домен має збігатися з hostname у GA4 (без https:// і шляху).') }}</p>
        <div class="form">
          <label class="field">{{ t('Назва (модель)') }} <input v-model="nl.name" class="input" :placeholder="t('Напр. Fansguider')"></label>
          <label class="field">{{ t('Домен') }} <input v-model="nl.hostname" class="input" placeholder="fans-guider.com" list="ga-hosts"></label>
        </div>
        <datalist id="ga-hosts"><option v-for="h in unusedHosts" :key="h.hostname" :value="h.hostname" /></datalist>
        <div class="row">
          <button class="btn primary" :disabled="!nl.hostname" @click="createLanding"><Plus :size="15" :stroke-width="1.9" />{{ t('Додати') }}</button>
          <button class="btn" :disabled="hostsPending" @click="loadHosts()"><LoaderCircle v-if="hostsPending" :size="15" :stroke-width="1.9" class="spin" /><RefreshCw v-else :size="15" :stroke-width="1.9" />{{ hostsPending ? t('Завантаження…') : t('Підтягнути домени з GA4') }}</button>
        </div>
        <div v-if="unusedHosts.length" class="hosts">
          <span class="muted tiny">{{ t('Є в GA4 за 90 днів, ще не додані:') }}</span>
          <button v-for="h in unusedHosts" :key="h.hostname" class="btn sm" @click="nl.hostname = h.hostname"><Globe :size="14" :stroke-width="1.9" />{{ h.hostname }} <span class="muted">{{ fmtInt(h.sessions) }}</span></button>
        </div>
      </section>

      <p v-if="!landings?.length" class="card muted">{{ t('Лендингів ще немає.') }}</p>
      <TransitionGroup v-else tag="section" name="list" class="card list">
        <div v-for="l in landings" :key="l.id" class="item">
          <div v-if="editingL !== l.id" class="item-head">
            <div class="who-l"><span class="avatar site"><Globe :size="16" :stroke-width="1.9" /></span><div><b>{{ l.name }}</b><div class="muted tiny">{{ l.hostname }}</div></div></div>
            <div class="actions">
              <NuxtLink class="btn sm" :to="{ path: '/', query: { landing: l.id } }"><BarChart3 :size="15" :stroke-width="1.9" />{{ t('Дашборд') }}</NuxtLink>
              <button class="btn sm" @click="startEditL(l)"><Pencil :size="15" :stroke-width="1.9" />{{ t('Змінити') }}</button>
              <button class="btn sm danger" @click="deleteLanding(l)"><Trash2 :size="15" :stroke-width="1.9" />{{ t('Видалити') }}</button>
            </div>
          </div>
          <div v-else class="edit">
            <div class="form">
              <label class="field">{{ t('Назва') }} <input v-model="el.name" class="input"></label>
              <label class="field">{{ t('Домен') }} <input v-model="el.hostname" class="input"></label>
              <label class="field"><span class="lbl-ico"><Flag :size="14" />{{ t('План лідів на {m}', { m: fmtMonthLong(goalMonth) }) }}</span>
                <input v-model="el.goal" class="input" type="number" min="0" step="1" :placeholder="t('без плану')">
              </label>
            </div>
            <div class="row">
              <button class="btn primary sm" @click="saveL(l)"><Check :size="15" :stroke-width="1.9" />{{ t('Зберегти') }}</button>
              <button class="btn sm" @click="editingL = null"><X :size="15" :stroke-width="1.9" />{{ t('Скасувати') }}</button>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </template>

    <!-- ALERTS -->
    <template v-else-if="tab === 'alerts'">
      <section class="card">
        <h3><Bell :size="16" class="ico" />{{ t('Сповіщення в Telegram') }}</h3>
        <p class="note">{{ t('Щоранку (о 8:00 за Мадридом узимку, о 9:00 улітку) застосунок перевіряє вчорашній день кожного лендингу: різке падіння лідів, зникнення трафіку або сплеск сесій порівняно з попередніми 14 днями. Щопонеділка надсилає тижневий звіт.') }}</p>
        <ul class="status">
          <li :class="tg?.configured ? 'ok' : 'bad'">
            <CircleCheck v-if="tg?.configured" :size="16" /><CircleAlert v-else :size="16" />
            {{ tg?.configured ? t('Бот і чат налаштовано') : t('Бот не налаштовано: додайте NUXT_TELEGRAM_BOT_TOKEN і NUXT_TELEGRAM_CHAT_ID у Vercel') }}
          </li>
          <li :class="tg?.cron ? 'ok' : 'bad'">
            <CircleCheck v-if="tg?.cron" :size="16" /><CircleAlert v-else :size="16" />
            {{ tg?.cron ? t('Щоденний запуск захищено (CRON_SECRET)') : t('Додайте CRON_SECRET у Vercel, щоб увімкнути щоденну перевірку') }}
          </li>
        </ul>
        <div class="row">
          <button class="btn" :disabled="!tg?.configured || !!tgBusy" @click="tgAction('test')"><LoaderCircle v-if="tgBusy === 'test'" :size="15" class="spin" /><Send v-else :size="15" />{{ t('Надіслати тест') }}</button>
          <button class="btn" :disabled="!!tgBusy" @click="tgAction('run')"><LoaderCircle v-if="tgBusy === 'run'" :size="15" class="spin" /><Play v-else :size="15" />{{ t('Перевірити зараз') }}</button>
        </div>
        <pre v-if="preview" class="preview">{{ preview.replace(/<[^>]+>/g, '') }}</pre>
      </section>
    </template>

    <!-- LOG -->
    <template v-else>
      <section class="card">
        <div class="log-head">
          <h3><History :size="16" class="ico" />{{ t('Журнал дій') }}</h3>
          <button class="btn sm" :disabled="logStatus === 'pending'" @click="refreshLog()"><RefreshCw :size="14" />{{ t('Оновити') }}</button>
        </div>
        <p class="note">{{ t('Останні 300 подій: входи, зміни користувачів, лендингів і планів.') }}</p>
        <div class="scroll">
          <table class="log">
            <thead><tr><th>{{ t('Коли') }}</th><th>{{ t('Хто') }}</th><th>{{ t('Дія') }}</th><th>{{ t('Деталі') }}</th></tr></thead>
            <tbody>
              <tr v-for="r in log" :key="r.id" :class="{ warn: r.action === 'login.fail' }">
                <td class="num nowrap">{{ fmtDateTime(r.at) }}</td>
                <td>{{ r.actor }}</td>
                <td class="nowrap">{{ t(ACTIONS[r.action] ?? r.action) }}</td>
                <td class="details">{{ r.details }}</td>
              </tr>
              <tr v-if="!log?.length"><td colspan="4" class="muted">{{ t('Поки порожньо') }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page { padding-top: 16px; padding-bottom: 48px; display: grid; gap: 16px; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--hair); overflow-x: auto; scrollbar-width: none; }
.tabs button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; padding: 10px 14px; color: var(--ink-2); border-bottom: 2px solid transparent; white-space: nowrap; font-size: 14px; }
.tabs button.on { color: var(--ink); border-color: var(--accent); }
.tabs button:focus-visible { outline: 2px solid var(--accent); }
.card { display: grid; gap: 12px; }
.card > .btn { justify-self: start; }
h3 { display: flex; align-items: center; gap: 8px; }
.ico { color: var(--accent); }
.form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.grow { flex: 1; min-width: 0; }
.checks { border: 1px solid var(--hair); border-radius: 8px; padding: 10px 12px; display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); margin: 0; }
.checks legend { font-size: 13px; color: var(--ink-2); padding: 0 4px; }
.check { display: flex; gap: 8px; align-items: center; font-size: 14px; }
.tiny { font-size: 12.5px; margin: 0; }
.note { margin: -6px 0 0; font-size: 13px; color: var(--ink-3); max-width: 80ch; }
.list { gap: 0; padding: 4px 18px; }
.item { padding: 12px 0; border-bottom: 1px solid var(--hair); display: grid; gap: 12px; }
.item:last-child { border-bottom: none; }
.item-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.avatar { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--grid); color: var(--ink-2); margin-right: 10px; flex: none; }
.avatar.admin { background: var(--accent-wash); color: var(--accent); }
.who-l { display: flex; align-items: center; }
.role { font-size: 11.5px; padding: 1px 8px; border-radius: 99px; margin-left: 6px; background: var(--grid); color: var(--ink-2); }
.role.admin { background: var(--accent-wash); color: var(--accent); }
.role.tfa { background: color-mix(in oklab, var(--good) 14%, transparent); color: var(--good); font-weight: 600; }
.edit { display: grid; gap: 12px; padding: 12px; border-radius: 8px; background: var(--page); }
.lbl-ico { display: inline-flex; align-items: center; gap: 5px; }
.flash { display: flex; align-items: center; gap: 8px; margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--hair); font-size: 14px; }
.flash.ok { color: var(--good); }
.hosts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.status { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 14px; }
.status li { display: flex; gap: 8px; align-items: flex-start; }
.status li svg { flex: none; margin-top: 2px; }
.status .ok { color: var(--good); }
.status .bad { color: var(--ink-2); }
.status .bad svg { color: var(--c4); }
.preview { margin: 0; padding: 12px; border-radius: 8px; background: var(--page); border: 1px solid var(--hair); font: 13px/1.5 inherit; white-space: pre-wrap; }
.log-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.scroll { overflow-x: auto; }
.log { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.log th, .log td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--hair); vertical-align: top; }
.log th { font-size: 12.5px; color: var(--ink-2); background: var(--grid); }
.log tr.warn td { color: var(--bad); }
.nowrap { white-space: nowrap; }
.details { color: var(--ink-2); overflow-wrap: anywhere; }
@media (prefers-reduced-motion: no-preference) { .spin { animation: spin .8s linear infinite; } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
