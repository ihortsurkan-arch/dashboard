<script setup lang="ts">
const { fetch } = useUserSession()
const login = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

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
        <span class="logo" aria-hidden="true" />
        <h1>Landing Stats</h1>
        <p class="muted">Статистика трафіку лендингів</p>
      </div>
      <div class="form" @keydown.enter.prevent="submit">
        <label class="field">Логін
          <input v-model="login" class="input" autocomplete="username" autofocus>
        </label>
        <label class="field">Пароль
          <input v-model="password" class="input" type="password" autocomplete="current-password">
        </label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="btn primary full" :disabled="busy || !login || !password" @click="submit">
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
.logo { display: inline-block; width: 40px; height: 40px; border-radius: 11px; background: var(--accent); mask: radial-gradient(circle at 70% 30%, transparent 0 22%, #000 23%); }
.form { display: grid; gap: 14px; }
.full { justify-content: center; width: 100%; padding: 10px; }
.error { margin: 0; }
</style>
