<script setup lang="ts">
import { CircleAlert, CircleCheck, Fingerprint, KeyRound, Languages, LoaderCircle, Palette, Plus, ScanFace, ShieldCheck, ShieldOff, Smartphone, Trash2 } from 'lucide-vue-next'

const { data: me, refresh } = await useFetch<{ login: string; role: string; totpEnabled: boolean }>('/api/account')

// ---- passkeys (Face ID / Touch ID) ----
interface Passkey { id: string; name: string; created_at: string; last_used_at: string | null }
const { data: passkeys, refresh: refreshKeys } = await useFetch<Passkey[]>('/api/account/passkeys', { default: () => [] })
const { register, isSupported } = useWebAuthn({ registerEndpoint: '/api/webauthn/register' })
const pkBusy = ref(false)
const pkMsg = ref('')
const pkErr = ref('')
async function addPasskey() {
  pkMsg.value = ''; pkErr.value = ''
  pkBusy.value = true
  try {
    await register({ userName: me.value!.login, displayName: me.value!.login })
    pkMsg.value = t('Готово. Тепер на сторінці входу можна натиснути «Увійти з Face ID».')
    await refreshKeys()
  } catch (e: any) {
    // The person closed the system prompt: not an error worth shouting about
    if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') pkErr.value = t('Скасовано')
    else if (e?.name === 'InvalidStateError') pkErr.value = t('Цей пристрій уже додано')
    else pkErr.value = e?.data?.statusMessage || e?.message || t('Помилка')
  } finally { pkBusy.value = false }
}
async function removePasskey(k: Passkey) {
  if (!confirm(t('Прибрати вхід з пристрою «{n}»?', { n: k.name }))) return
  await $fetch<{ ok: boolean }>('/api/account/passkeys/delete', { method: 'POST', body: { id: k.id } })
  await refreshKeys()
}

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

// ---- code from an authenticator app (advanced) ----
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

    <section class="card passkey">
      <div class="pk-head">
        <span class="pk-ico" aria-hidden="true"><ScanFace :size="26" :stroke-width="1.75" /></span>
        <div>
          <h2>{{ t('Вхід з Face ID / Touch ID') }}</h2>
          <p class="muted">{{ t('Без пароля і кодів: на сторінці входу натискаєте одну кнопку і підтверджуєте обличчям або відбитком. Ключ зберігається в «Паролях» (iCloud Keychain) чи іншому менеджері паролів і працює на всіх ваших пристроях.') }}</p>
        </div>
      </div>

      <TransitionGroup v-if="passkeys?.length" name="list" tag="ul" class="keys">
        <li v-for="k in passkeys" :key="k.id">
          <Fingerprint :size="18" class="k-ico" />
          <span class="k-name">{{ k.name }}</span>
          <span class="muted tiny">{{ k.last_used_at ? t('востаннє {d}', { d: fmtDateTime(k.last_used_at) }) : t('додано {d}', { d: fmtDateTime(k.created_at) }) }}</span>
          <button class="del" :aria-label="t('Прибрати')" @click="removePasskey(k)"><Trash2 :size="15" /></button>
        </li>
      </TransitionGroup>

      <p v-if="pkMsg" class="ok"><CircleCheck :size="16" />{{ pkMsg }}</p>
      <p v-if="pkErr" class="error"><CircleAlert :size="16" />{{ pkErr }}</p>
      <p v-if="!isSupported" class="muted tiny">{{ t('Цей браузер не підтримує ключі доступу. Відкрийте сайт у Safari або Chrome.') }}</p>
      <button class="btn primary big" :disabled="pkBusy || !isSupported" @click="addPasskey">
        <LoaderCircle v-if="pkBusy" :size="18" class="spin" /><Plus v-else :size="18" />
        {{ passkeys?.length ? t('Додати ще один пристрій') : t('Увімкнути вхід з Face ID') }}
      </button>
    </section>

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
        <details class="adv" :open="!!me?.totpEnabled || !!setup">
          <summary><ShieldCheck :size="16" class="ico" />{{ t('Код з додатка-автентифікатора') }} <span class="muted tiny">{{ me?.totpEnabled ? t('увімкнено') : t('необовʼязково') }}</span></summary>
          <div class="adv-body">
            <p class="note">{{ t('Додатковий захист: після пароля сайт питатиме 6-значний код з Google Authenticator або «Паролів» на iPhone. Вхід з Face ID працює і без цього.') }}</p>
            <p v-if="tfMsg" class="ok"><CircleCheck :size="15" />{{ tfMsg }}</p>

            <template v-if="me?.totpEnabled">
              <p class="state on"><ShieldCheck :size="16" />{{ t('Увімкнено') }}</p>
              <label class="field">{{ t('Код з додатка, щоб вимкнути') }}<input v-model="code" class="input code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>
              <p v-if="tfErr" class="error">{{ tfErr }}</p>
              <button class="btn danger" :disabled="code.length !== 6" @click="disable2fa"><ShieldOff :size="15" />{{ t('Вимкнути') }}</button>
            </template>

            <template v-else-if="setup">
              <ol class="steps">
                <li>{{ t('Відкрийте Google Authenticator і натисніть «+», або відскануйте камерою iPhone і збережіть код у «Паролях».') }}</li>
                <li>{{ t('Введіть 6 цифр, які покаже додаток.') }}</li>
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
              <p v-if="tfErr" class="error">{{ tfErr }}</p>
              <button class="btn" @click="start2fa"><Smartphone :size="15" />{{ t('Налаштувати') }}</button>
            </template>
          </div>
        </details>
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
.passkey { padding: 24px; gap: 16px; }
.pk-head { display: flex; gap: 16px; align-items: flex-start; }
.pk-head h2 { font-size: 20px; }
.pk-head p { margin: 4px 0 0; font-size: 14px; max-width: 70ch; }
.pk-ico { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 14px; background: var(--accent-wash); color: var(--accent); flex: none; }
.keys { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.keys li { display: grid; grid-template-columns: 22px auto 1fr 28px; gap: 10px; align-items: center; padding: 8px 12px; border: 1px solid var(--hair); border-radius: 10px; }
.k-ico { color: var(--good); }
.k-name { font-weight: 600; }
.del { all: unset; cursor: pointer; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; color: var(--ink-3); justify-self: end; }
.del:hover { color: var(--bad); background: var(--grid); }
.big { padding: 12px 18px; font-size: 15px; justify-self: start; }
.form { display: grid; gap: 10px; }
.form .input { width: 100%; }
.note { margin: 0; font-size: 13px; color: var(--ink-3); }
.ok { display: flex; align-items: center; gap: 6px; color: var(--good); margin: 0; font-size: 14px; }
.error { display: flex; align-items: center; gap: 6px; margin: 0; }
.state { display: inline-flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; font-size: 14px; }
.state.on { color: var(--good); }
.adv summary { cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; list-style: none; }
.adv summary::-webkit-details-marker { display: none; }
.adv summary .tiny { font-weight: 400; margin-left: auto; }
.adv-body { display: grid; gap: 12px; padding-top: 12px; }
.adv-body > .btn { justify-self: start; }
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
@media (prefers-reduced-motion: no-preference) { .spin { animation: spin .8s linear infinite; } }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 600px) { .pk-head { flex-direction: column; } .big { width: 100%; justify-content: center; } }
</style>
