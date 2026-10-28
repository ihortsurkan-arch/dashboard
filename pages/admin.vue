<script setup lang="ts">
interface Landing { id: number; name: string; hostname: string }
interface User { id: number; login: string; role: 'admin' | 'user'; created_at: string; landing_ids: number[] }

const { user: me } = useUserSession()
const tab = ref<'users' | 'landings'>('users')
const { data: landings, refresh: refreshLandings } = await useFetch<Landing[]>('/api/landings', { default: () => [] })
const { data: users, refresh: refreshUsers } = await useFetch<User[]>('/api/admin/users', { default: () => [] })
const landingName = (id: number) => landings.value?.find((l) => l.id === id)?.name ?? `#${id}`

const msg = ref('')
const err = ref('')
function flash(m: string) { msg.value = m; err.value = ''; setTimeout(() => { if (msg.value === m) msg.value = '' }, 3000) }
function fail(e: any) { err.value = e?.data?.statusMessage || 'Помилка'; msg.value = '' }

// ---- new user ----
const nu = reactive({ login: '', password: '', role: 'user' as 'admin' | 'user', landingIds: [] as number[] })
function genPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const a = new Uint32Array(12)
  crypto.getRandomValues(a)
  nu.password = [...a].map((x) => abc[x % abc.length]).join('')
}
async function createUser() {
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: nu })
    flash(`Користувача ${nu.login} створено`)
    Object.assign(nu, { login: '', password: '', role: 'user', landingIds: [] })
    await refreshUsers()
  } catch (e) { fail(e) }
}

// ---- edit user ----
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
    flash(`Збережено: ${u.login}`)
    await refreshUsers()
  } catch (e) { fail(e) }
}
async function deleteUser(u: User) {
  if (!confirm(`Видалити користувача ${u.login}?`)) return
  try {
    await $fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    flash(`Видалено: ${u.login}`)
    await refreshUsers()
  } catch (e) { fail(e) }
}

// ---- landings ----
const nl = reactive({ name: '', hostname: '' })
const { data: hostnames, pending: hostsPending, execute: loadHosts } = useLazyFetch<{ hostname: string; sessions: number }[]>('/api/admin/hostnames', { immediate: false, default: () => [] })
const unusedHosts = computed(() => (hostnames.value ?? []).filter((h) => h.hostname && !landings.value?.some((l) => l.hostname === h.hostname)))
async function createLanding() {
  try {
    await $fetch('/api/admin/landings', { method: 'POST', body: nl })
    flash(`Лендинг ${nl.hostname} додано`)
    Object.assign(nl, { name: '', hostname: '' })
    await refreshLandings()
  } catch (e) { fail(e) }
}
const editingL = ref<number | null>(null)
const el = reactive({ name: '', hostname: '' })
function startEditL(l: Landing) { editingL.value = l.id; Object.assign(el, { name: l.name, hostname: l.hostname }) }
async function saveL(l: Landing) {
  try {
    await $fetch(`/api/admin/landings/${l.id}`, { method: 'PUT', body: el })
    editingL.value = null
    flash('Лендинг збережено')
    await refreshLandings()
  } catch (e) { fail(e) }
}
async function deleteLanding(l: Landing) {
  if (!confirm(`Видалити лендинг ${l.name}? Доступи до нього також зникнуть.`)) return
  try {
    await $fetch(`/api/admin/landings/${l.id}`, { method: 'DELETE' })
    flash('Лендинг видалено')
    await Promise.all([refreshLandings(), refreshUsers()])
  } catch (e) { fail(e) }
}
</script>

<template>
  <div class="container page">
    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'users'" :class="{ on: tab === 'users' }" @click="tab = 'users'">Користувачі ({{ users?.length ?? 0 }})</button>
      <button role="tab" :aria-selected="tab === 'landings'" :class="{ on: tab === 'landings' }" @click="tab = 'landings'">Лендинги ({{ landings?.length ?? 0 }})</button>
    </div>

    <p v-if="msg" class="flash ok">{{ msg }}</p>
    <p v-if="err" class="flash error" role="alert">{{ err }}</p>

    <!-- USERS -->
    <template v-if="tab === 'users'">
      <section class="card">
        <h3>Новий користувач</h3>
        <div class="form">
          <label class="field">Логін <input v-model="nu.login" class="input" autocomplete="off"></label>
          <label class="field">Пароль
            <span class="row"><input v-model="nu.password" class="input grow" autocomplete="new-password"><button class="btn sm" type="button" @click="genPassword">Згенерувати</button></span>
          </label>
          <label class="field">Роль
            <select v-model="nu.role" class="input"><option value="user">Користувач</option><option value="admin">Адміністратор</option></select>
          </label>
        </div>
        <fieldset v-if="nu.role === 'user'" class="checks">
          <legend>Доступ до лендингів</legend>
          <label v-for="l in landings" :key="l.id" class="check"><input v-model="nu.landingIds" type="checkbox" :value="l.id"> {{ l.name }} <span class="muted">{{ l.hostname }}</span></label>
          <span v-if="!landings?.length" class="muted">Спершу додайте лендинги на вкладці «Лендинги».</span>
        </fieldset>
        <button class="btn primary" :disabled="!nu.login || nu.password.length < 8" @click="createUser">Створити</button>
        <p class="muted tiny">Пароль щонайменше 8 символів. Передайте його користувачу окремо — тут він більше не показується.</p>
      </section>

      <section class="card list">
        <div v-for="u in users" :key="u.id" class="item">
          <div class="item-head">
            <div>
              <b>{{ u.login }}</b>
              <span class="role" :class="u.role">{{ u.role === 'admin' ? 'адмін' : 'користувач' }}</span>
              <span v-if="u.id === me?.id" class="muted tiny">(це ви)</span>
              <div class="muted tiny">
                <template v-if="u.role === 'admin'">Бачить усі лендинги</template>
                <template v-else-if="u.landing_ids.length">{{ u.landing_ids.map(landingName).join(', ') }}</template>
                <template v-else>Немає доступу до лендингів</template>
              </div>
            </div>
            <div class="actions">
              <button v-if="editing !== u.id" class="btn sm" @click="startEdit(u)">Змінити</button>
              <button v-if="u.id !== me?.id" class="btn sm danger" @click="deleteUser(u)">Видалити</button>
            </div>
          </div>
          <div v-if="editing === u.id" class="edit">
            <div class="form">
              <label class="field">Роль
                <select v-model="edit.role" class="input" :disabled="u.id === me?.id"><option value="user">Користувач</option><option value="admin">Адміністратор</option></select>
              </label>
              <label class="field">Новий пароль (необов'язково) <input v-model="edit.password" class="input" autocomplete="new-password"></label>
            </div>
            <fieldset v-if="edit.role === 'user'" class="checks">
              <legend>Доступ до лендингів</legend>
              <label v-for="l in landings" :key="l.id" class="check"><input v-model="edit.landingIds" type="checkbox" :value="l.id"> {{ l.name }} <span class="muted">{{ l.hostname }}</span></label>
            </fieldset>
            <div class="row">
              <button class="btn primary sm" :disabled="!!edit.password && edit.password.length < 8" @click="saveEdit(u)">Зберегти</button>
              <button class="btn sm" @click="editing = null">Скасувати</button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- LANDINGS -->
    <template v-else>
      <section class="card">
        <h3>Новий лендинг</h3>
        <p class="note">Домен має збігатися з hostname у GA4 (без https:// і шляху).</p>
        <div class="form">
          <label class="field">Назва (модель) <input v-model="nl.name" class="input" placeholder="Напр. Fansguider"></label>
          <label class="field">Домен <input v-model="nl.hostname" class="input" placeholder="fans-guider.com" list="ga-hosts"></label>
        </div>
        <datalist id="ga-hosts"><option v-for="h in unusedHosts" :key="h.hostname" :value="h.hostname" /></datalist>
        <div class="row">
          <button class="btn primary" :disabled="!nl.hostname" @click="createLanding">Додати</button>
          <button class="btn" :disabled="hostsPending" @click="loadHosts()">{{ hostsPending ? 'Завантаження…' : 'Підтягнути домени з GA4' }}</button>
        </div>
        <div v-if="unusedHosts.length" class="hosts">
          <span class="muted tiny">Є в GA4 за 90 днів, ще не додані:</span>
          <button v-for="h in unusedHosts" :key="h.hostname" class="btn sm" @click="nl.hostname = h.hostname">{{ h.hostname }} <span class="muted">{{ fmtInt(h.sessions) }}</span></button>
        </div>
      </section>

      <section class="card list">
        <p v-if="!landings?.length" class="muted">Лендингів ще немає.</p>
        <div v-for="l in landings" :key="l.id" class="item">
          <div v-if="editingL !== l.id" class="item-head">
            <div><b>{{ l.name }}</b><div class="muted tiny">{{ l.hostname }}</div></div>
            <div class="actions">
              <NuxtLink class="btn sm" :to="{ path: '/', query: { landing: l.id } }">Дашборд</NuxtLink>
              <button class="btn sm" @click="startEditL(l)">Змінити</button>
              <button class="btn sm danger" @click="deleteLanding(l)">Видалити</button>
            </div>
          </div>
          <div v-else class="edit">
            <div class="form">
              <label class="field">Назва <input v-model="el.name" class="input"></label>
              <label class="field">Домен <input v-model="el.hostname" class="input"></label>
            </div>
            <div class="row">
              <button class="btn primary sm" @click="saveL(l)">Зберегти</button>
              <button class="btn sm" @click="editingL = null">Скасувати</button>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page { padding-top: 16px; padding-bottom: 48px; display: grid; gap: 16px; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--hair); overflow-x: auto; }
.tabs button { all: unset; cursor: pointer; padding: 10px 14px; color: var(--ink-2); border-bottom: 2px solid transparent; white-space: nowrap; font-size: 14px; }
.tabs button.on { color: var(--ink); border-color: var(--accent); }
.card { display: grid; gap: 12px; }
.card > .btn { justify-self: start; }
.form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.grow { flex: 1; }
.checks { border: 1px solid var(--hair); border-radius: 8px; padding: 10px 12px; display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); margin: 0; }
.checks legend { font-size: 13px; color: var(--ink-2); padding: 0 4px; }
.check { display: flex; gap: 8px; align-items: center; font-size: 14px; }
.tiny { font-size: 12.5px; margin: 0; }
.note { margin: -8px 0 0; }
.list { gap: 0; padding: 4px 18px; }
.item { padding: 12px 0; border-bottom: 1px solid var(--hair); display: grid; gap: 12px; }
.item:last-child { border-bottom: none; }
.item-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.role { font-size: 11.5px; padding: 1px 8px; border-radius: 99px; margin-left: 6px; background: var(--grid); color: var(--ink-2); }
.role.admin { background: var(--accent-wash); color: var(--accent); }
.edit { display: grid; gap: 12px; padding: 12px; border-radius: 8px; background: var(--page); }
.flash { margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--hair); font-size: 14px; }
.flash.ok { color: var(--good); }
.hosts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
</style>
