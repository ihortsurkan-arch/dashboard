<script setup lang="ts">
import { CircleCheck, KeyRound, Languages, Palette, ShieldCheck, ShieldOff, Smartphone } from 'lucide-vue-next'

const { data: me, refresh } = await useFetch<{ login: string; role: string; totpEnabled: boolean }>('/api/account')

// ---- password ----
const pw = reactive({ current: '', next: '', repeat: '' })
const pwMsg = ref('')
const pwErr = ref('')
async function changePassword() {
  pwMsg.value = ''; pwErr.value = ''
  if (pw.next !== pw.repeat) { pwErr.value = t('Нові паролі не збігаються'); return }
  try {
    await $fetch<{ ok: boolean }>('/api/account/password', { method: 'PUT', body: { current: pw.current, next: pw.next } })
    Object.assign(pw, { current: '', next: '', repeat: '' })
    pwMsg.value = t('Пароль змінено')
  } catch (e: any) { pwErr.value = e?.data?.statusMessage || t('Помилка') }
}

// ---- 2FA ----
const setup = ref<{ secret: string; qr: string } | null>(null)
const code = ref('')
const tfMsg = ref('')
const tfErr = ref('')
async function start2fa() {
  tfErr.value = ''
  try { setup.value = await $fetch<{ secret: string; qr: string }>('/api/account/2fa/setup', { method: 'POST' }) } catch (e: any) { tfErr.value = e?.data?.statusMessage || t('Помилка') }
}
async function enable2fa() {
  tfErr.value = ''
  try {
    await $fetch<{ ok: boolean }>('/api/account/2fa/enable', { method: 'POST', body: { code: code.value } })
    setup.value = null; code.value = ''
    tfMsg.value = t('Двофакторний вхід увімкнено')
    await refresh()
  } catch (e: any) { tfErr.value = e?.data?.statusMessage || t('Помилка') }
}
async function disable2fa() {
  tfErr.value = ''
  try {
    await $fetch<{ ok: boolean }>('/api/account/2fa/disable', { method: 'POST', body: { code: code.value } })
    code.value = ''
    tfMsg.value = t('Двофакторний вхід вимкнено')
    await refresh()
  } catch (e: any) { tfErr.value = e?.data?.statusMessage || t('Помилка') }
}
</script>

<template>
  <div class="container page">
    <h1>{{ t('Мій акаунт') }}</h1>
    <p class="muted sub">{{ me?.login }}<template v-if="me?.role === 'admin'">, {{ t('адміністратор') }}</template></p>

    <div class="grid-2">
      <section class="card">
        <h3><KeyRound :size="16" class="ico" />{{ t('Змінити пароль') }}</h3>
        <div class="form">
          <label class="field">{{ t('Поточний пароль') }}<input v-model="pw.current" class="input" type="password" autocomplete="current-password"></label>
          <label class="field">{{ t('Новий пароль') }}<input v-model="pw.next" class="input" type="password" autocomplete="new-password"></label>
          <label class="field">{{ t('Повторіть новий пароль') }}<input v-model="pw.repeat" class="input" type="password" autocomplete="new-password"></label>
        </div>
        <p v-if="pwErr" class="error">{{ pwErr }}</p>
        <p v-if="pwMsg" class="ok"><CircleCheck :size="15" />{{ pwMsg }}</p>
        <button class="btn primary" :disabled="!pw.current || pw.next.length < 8" @click="changePassword">{{ t('Змінити пароль') }}</button>
      </section>

      <section class="card">
        <h3><ShieldCheck :size="16" class="ico" />{{ t('Двофакторний вхід') }}</h3>
        <p class="note">{{ t('Після пароля застосунок питатиме 6-значний код з Google Authenticator, 1Password чи Authy.') }}</p>
        <p v-if="tfMsg" class="ok"><CircleCheck :size="15" />{{ tfMsg }}</p>

        <template v-if="me?.totpEnabled">
          <p class="state on"><ShieldCheck :size="16" />{{ t('Увімкнено') }}</p>
          <label class="field">{{ t('Код з додатка, щоб вимкнути') }}<input v-model="code" class="input code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>
          <p v-if="tfErr" class="error">{{ tfErr }}</p>
          <button class="btn danger" :disabled="code.length !== 6" @click="disable2fa"><ShieldOff :size="15" />{{ t('Вимкнути') }}</button>
        </template>

        <template v-else-if="setup">
          <ol class="steps">
            <li>{{ t('Відкрийте додаток-автентифікатор і відскануйте QR-код.') }}</li>
            <li>{{ t('Введіть 6-значний код, який він покаже.') }}</li>
          </ol>
          <img :src="setup.qr" :alt="t('QR-код для додатка')" class="qr">
          <p class="muted tiny">{{ t('Або введіть ключ вручну:') }} <code>{{ setup.secret }}</code></p>
          <label class="field">{{ t('Код') }}<input v-model="code" class="input code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" @keydown.enter="code.length === 6 && enable2fa()"></label>
          <p v-if="tfErr" class="error">{{ tfErr }}</p>
          <div class="row">
            <button class="btn primary" :disabled="code.length !== 6" @click="enable2fa">{{ t('Увімкнути') }}</button>
            <button class="btn" @click="setup = null">{{ t('Скасувати') }}</button>
          </div>
        </template>

        <template v-else>
          <p class="state off"><ShieldOff :size="16" />{{ t('Вимкнено') }}</p>
          <p v-if="tfErr" class="error">{{ tfErr }}</p>
          <button class="btn primary" @click="start2fa"><Smartphone :size="15" />{{ t('Налаштувати') }}</button>
        </template>
      </section>

      <section class="card">
        <h3><Palette :size="16" class="ico" />{{ t('Тема') }}</h3>
        <div class="seg" role="group" :aria-label="t('Тема')">
          <button :aria-pressed="themeChoice === 'system'" @click="setTheme('system')">{{ t('Як у системі') }}</button>
          <button :aria-pressed="themeChoice === 'light'" @click="setTheme('light')">{{ t('Світла') }}</button>
          <button :aria-pressed="themeChoice === 'dark'" @click="setTheme('dark')">{{ t('Темна') }}</button>
        </div>
      </section>

      <section class="card">
        <h3><Languages :size="16" class="ico" />{{ t('Мова') }}</h3>
        <div class="seg" role="group" :aria-label="t('Мова')">
          <button :aria-pressed="locale === 'uk'" @click="setLocale('uk')">Українська</button>
          <button :aria-pressed="locale === 'ru'" @click="setLocale('ru')">Русский</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page { padding-top: 24px; padding-bottom: 56px; display: grid; gap: 14px; }
.sub { margin: -8px 0 6px; }
.card { display: grid; gap: 12px; align-content: start; }
h3 { display: flex; align-items: center; gap: 8px; }
.ico { color: var(--accent); }
.form { display: grid; gap: 10px; }
.form .input { width: 100%; }
.note { margin: -6px 0 0; font-size: 13px; color: var(--ink-3); }
.ok { display: flex; align-items: center; gap: 6px; color: var(--good); margin: 0; font-size: 14px; }
.error { margin: 0; }
.state { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; font-size: 14px; }
.state.on { color: var(--good); }
.state.off { color: var(--ink-3); }
.code { width: 140px; font-size: 18px; letter-spacing: .2em; font-variant-numeric: tabular-nums; }
.qr { width: 180px; height: 180px; border-radius: 10px; background: #fff; padding: 6px; }
.steps { margin: 0; padding-left: 20px; font-size: 14px; display: grid; gap: 4px; }
.tiny { font-size: 12.5px; margin: 0; }
.tiny code { font-size: 12px; word-break: break-all; }
.row { display: flex; gap: 8px; }
.card > .btn { justify-self: start; }
.seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--hair); border-radius: 10px; justify-self: start; flex-wrap: wrap; }
.seg button { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 7px; font-size: 14px; color: var(--ink-2); }
.seg button[aria-pressed='true'] { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
.seg button:focus-visible { outline: 2px solid var(--accent); }
</style>
