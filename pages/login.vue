<script setup lang="ts">
import { Eye, EyeOff, LoaderCircle, LogIn, ScanFace, ShieldCheck } from 'lucide-vue-next'
const { fetch } = useUserSession()
const login = ref('')
const password = ref('')
const code = ref('')
const needCode = ref(false)
const error = ref('')
const busy = ref(false)
const show = ref(false)
const codeInput = ref<HTMLInputElement | null>(null)

// Passkey sign-in: Face ID / Touch ID, no login or password
const { authenticate, isSupported } = useWebAuthn({ authenticateEndpoint: '/api/webauthn/authenticate' })
const pkBusy = ref(false)
async function signInWithPasskey() {
  error.value = ''
  pkBusy.value = true
  try {
    await authenticate()
    await fetch()
    await navigateTo('/')
  } catch (e: any) {
    if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
      error.value = e?.data?.statusMessage || t('Не вдалося увійти з Face ID. Спробуйте пароль.')
    }
  } finally { pkBusy.value = false }
}

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { login: login.value, password: password.value, ...(needCode.value ? { code: code.value } : {}) } })
    await fetch()
    await navigateTo('/')
  } catch (e: any) {
    if (e?.data?.data?.totp) {
      // Password accepted: ask for the authenticator code
      if (needCode.value) error.value = e?.data?.statusMessage || t('Невірний код')
      needCode.value = true
      code.value = ''
      nextTick(() => codeInput.value?.focus())
    } else {
      error.value = e?.data?.statusMessage || t('Не вдалося увійти')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <div class="card box">
      <div class="head">
        <AppLogo :size="44" class="mark" />
        <h1>Landing Stats</h1>
        <p class="muted">{{ t('Статистика трафіку лендингів') }}</p>
      </div>
      <div class="form" @keydown.enter.prevent="submit">
        <template v-if="!needCode">
          <label class="field">{{ t('Логін') }}
            <input v-model="login" class="input" autocomplete="username" autofocus>
          </label>
          <label class="field">{{ t('Пароль') }}
            <span class="pw">
              <input v-model="password" class="input" :type="show ? 'text' : 'password'" autocomplete="current-password">
              <button type="button" class="eye" :aria-label="show ? t('Сховати пароль') : t('Показати пароль')" @click="show = !show">
                <EyeOff v-if="show" :size="17" :stroke-width="1.75" /><Eye v-else :size="17" :stroke-width="1.75" />
              </button>
            </span>
          </label>
        </template>
        <template v-else>
          <p class="tf"><ShieldCheck :size="18" />{{ t('Введіть 6-значний код з додатка-автентифікатора') }}</p>
          <input ref="codeInput" v-model="code" class="input code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :aria-label="t('Код')">
        </template>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="btn primary full" :disabled="busy || !login || !password || (needCode && code.length !== 6)" @click="submit">
          <LoaderCircle v-if="busy" :size="17" class="spin" /><LogIn v-else :size="17" :stroke-width="1.9" />
          {{ busy ? t('Вхід…') : t('Увійти') }}
        </button>
        <button v-if="needCode" class="back" @click="needCode = false; error = ''">{{ t('Інший акаунт') }}</button>
        <template v-if="isSupported && !needCode">
          <div class="or"><span>{{ t('або') }}</span></div>
          <button class="btn full passkey" :disabled="pkBusy" @click="signInWithPasskey">
            <LoaderCircle v-if="pkBusy" :size="18" class="spin" /><ScanFace v-else :size="18" :stroke-width="1.9" />
            {{ t('Увійти з Face ID / Touch ID') }}
          </button>
        </template>
      </div>
      <div class="prefs">
        <button :aria-pressed="locale === 'uk'" @click="setLocale('uk')">UA</button>
        <button :aria-pressed="locale === 'ru'" @click="setLocale('ru')">RU</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
.box { width: min(100%, 380px); padding: 28px; }
@media (prefers-reduced-motion: no-preference) { .box { animation: rise .45s cubic-bezier(.2, .7, .2, 1) both; } }
@keyframes rise { from { opacity: 0; transform: translateY(8px) scale(.99); } }
.head { text-align: center; margin-bottom: 20px; }
.head h1 { font-size: 22px; margin-top: 10px; }
.head p { margin: 4px 0 0; font-size: 14px; }
.mark { margin: 0 auto; }
.form { display: grid; gap: 14px; }
.full { justify-content: center; width: 100%; padding: 10px; }
.error { margin: 0; }
.pw { position: relative; display: block; }
.pw .input { width: 100%; padding-right: 40px; }
.eye { all: unset; position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 30px; height: 30px; border-radius: 6px; color: var(--ink-3); cursor: pointer; }
.eye:hover { color: var(--ink); }
.eye:focus-visible { outline: 2px solid var(--accent); }
.form .input { width: 100%; }
.tf { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 14px; color: var(--ink-2); }
.tf svg { color: var(--accent); flex: none; }
.code { font-size: 22px; letter-spacing: .35em; text-align: center; font-variant-numeric: tabular-nums; }
.back { all: unset; cursor: pointer; justify-self: center; font-size: 13px; color: var(--ink-2); text-decoration: underline; text-underline-offset: 3px; }
.or { display: flex; align-items: center; gap: 10px; color: var(--ink-3); font-size: 12.5px; }
.or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--hair); }
.passkey { font-weight: 600; }
.prefs { display: flex; justify-content: center; gap: 4px; margin-top: 18px; }
.prefs button { all: unset; cursor: pointer; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 6px; color: var(--ink-3); }
.prefs button[aria-pressed='true'] { background: var(--grid); color: var(--ink); }
@media (prefers-reduced-motion: no-preference) { .spin { animation: spin .8s linear infinite; } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
