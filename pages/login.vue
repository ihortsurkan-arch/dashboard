<script setup lang="ts">
import { Eye, EyeOff, LogIn, LoaderCircle } from 'lucide-vue-next'
const { fetch } = useUserSession()
const login = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const show = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { login: login.value, password: password.value } })
    await fetch()
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Не вдалося увійти'
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
        <p class="muted">Статистика трафіку лендингів</p>
      </div>
      <div class="form" @keydown.enter.prevent="submit">
        <label class="field">Логін
          <input v-model="login" class="input" autocomplete="username" autofocus>
        </label>
        <label class="field">Пароль
          <span class="pw">
            <input v-model="password" class="input" :type="show ? 'text' : 'password'" autocomplete="current-password">
            <button type="button" class="eye" :aria-label="show ? 'Сховати пароль' : 'Показати пароль'" @click="show = !show">
              <EyeOff v-if="show" :size="17" :stroke-width="1.75" /><Eye v-else :size="17" :stroke-width="1.75" />
            </button>
          </span>
        </label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="btn primary full" :disabled="busy || !login || !password" @click="submit">
          <LoaderCircle v-if="busy" :size="17" class="spin" /><LogIn v-else :size="17" :stroke-width="1.9" />
          {{ busy ? 'Вхід…' : 'Увійти' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
.box { width: min(100%, 380px); padding: 28px; }
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
@media (prefers-reduced-motion: no-preference) { .spin { animation: spin .8s linear infinite; } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
