<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <header v-if="loggedIn && route.path !== '/login'" class="topbar">
      <div class="container bar">
        <NuxtLink to="/" class="brand">
          <span class="logo" aria-hidden="true" />
          Landing Stats
        </NuxtLink>
        <nav class="nav">
          <NuxtLink to="/" :class="{ on: route.path === '/' }">Дашборд</NuxtLink>
          <NuxtLink v-if="user?.role === 'admin'" to="/admin" :class="{ on: route.path.startsWith('/admin') }">Адміністрування</NuxtLink>
        </nav>
        <div class="who">
          <span class="muted login">{{ user?.login }}</span>
          <button class="btn sm" @click="logout">Вийти</button>
        </div>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<style scoped>
.topbar { background: var(--surface); border-bottom: 1px solid var(--hair); position: sticky; top: 0; z-index: 10; }
.bar { display: flex; align-items: center; gap: 20px; height: 56px; }
.brand { display: flex; align-items: center; gap: 8px; color: var(--ink); font-weight: 650; }
.logo { width: 22px; height: 22px; border-radius: 6px; background: var(--accent); mask: radial-gradient(circle at 70% 30%, transparent 0 22%, #000 23%); }
.nav { display: flex; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; }
.nav a { color: var(--ink-2); padding: 6px 10px; border-radius: 8px; font-size: 14px; white-space: nowrap; }
.nav a.on { color: var(--ink); background: var(--accent-wash); }
.who { display: flex; align-items: center; gap: 10px; }
@media (max-width: 600px) {
  .login { display: none; }
  .brand { font-size: 0; gap: 0; }
  .bar { gap: 10px; }
}
</style>
