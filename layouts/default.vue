<script setup lang="ts">
import { LayoutDashboard, LogOut, Settings2, CircleUserRound } from 'lucide-vue-next'
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
          <AppLogo :size="26" />
          <span>Landing Stats</span>
        </NuxtLink>
        <nav class="nav">
          <NuxtLink to="/" :class="{ on: route.path === '/' }"><LayoutDashboard :size="16" :stroke-width="1.75" />Дашборд</NuxtLink>
          <NuxtLink v-if="user?.role === 'admin'" to="/admin" :class="{ on: route.path.startsWith('/admin') }"><Settings2 :size="16" :stroke-width="1.75" />Адміністрування</NuxtLink>
        </nav>
        <div class="who">
          <span class="login"><CircleUserRound :size="18" :stroke-width="1.75" />{{ user?.login }}</span>
          <button class="btn sm ghost" aria-label="Вийти" @click="logout"><LogOut :size="15" :stroke-width="1.9" /><span class="lbl">Вийти</span></button>
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
.nav { display: flex; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; }
.nav a { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-2); padding: 6px 10px; border-radius: 8px; font-size: 14px; white-space: nowrap; }
.nav a.on { color: var(--ink); background: var(--accent-wash); }
.who { display: flex; align-items: center; gap: 10px; }
.login { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); font-size: 14px; }
.ghost { border-color: transparent; color: var(--ink-2); }
.ghost:hover { border-color: var(--hair-strong); color: var(--ink); }
@media (max-width: 600px) {
  .login { display: none; }
  .brand span, .lbl { display: none; }
  .bar { gap: 10px; }
}
</style>
