<script setup lang="ts">
import { CircleUserRound, LayoutDashboard, LayoutList, LogOut, Monitor, Moon, Settings2, Sun } from 'lucide-vue-next'

const { loggedIn, user, clear } = useUserSession()
const route = useRoute()
useThemeTick() // applies the saved theme on load

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}
const nextTheme = computed(() => ({ system: 'light', light: 'dark', dark: 'system' } as const)[themeChoice.value])
const themeLabel = computed(() => ({ system: t('Тема: як у системі'), light: t('Тема: світла'), dark: t('Тема: темна') })[themeChoice.value])
watchEffect(() => { if (typeof document !== 'undefined') document.documentElement.lang = locale.value })
</script>

<template>
  <div>
    <header v-if="loggedIn && route.path !== '/login'" class="topbar no-print">
      <div class="container bar">
        <NuxtLink to="/" class="brand">
          <AppLogo :size="26" />
          <span>Landing Stats</span>
        </NuxtLink>
        <nav class="nav">
          <NuxtLink to="/" :class="{ on: route.path === '/' }"><LayoutDashboard :size="16" :stroke-width="1.75" /><span>{{ t('Дашборд') }}</span></NuxtLink>
          <NuxtLink to="/landings" :class="{ on: route.path === '/landings' }"><LayoutList :size="16" :stroke-width="1.75" /><span>{{ t('Усі лендинги') }}</span></NuxtLink>
          <NuxtLink v-if="user?.role === 'admin'" to="/admin" :class="{ on: route.path.startsWith('/admin') }"><Settings2 :size="16" :stroke-width="1.75" /><span>{{ t('Адміністрування') }}</span></NuxtLink>
        </nav>
        <div class="who">
          <button class="icon-btn" :title="themeLabel" :aria-label="themeLabel" @click="setTheme(nextTheme)">
            <Monitor v-if="themeChoice === 'system'" :size="17" :stroke-width="1.75" />
            <Sun v-else-if="themeChoice === 'light'" :size="17" :stroke-width="1.75" />
            <Moon v-else :size="17" :stroke-width="1.75" />
          </button>
          <button class="lang" :aria-label="t('Мова')" @click="setLocale(locale === 'uk' ? 'ru' : 'uk')">
            <span :class="{ on: locale === 'uk' }">UA</span><span :class="{ on: locale === 'ru' }">RU</span>
          </button>
          <NuxtLink to="/account" class="login" :class="{ on: route.path === '/account' }" :title="t('Мій акаунт')"><CircleUserRound :size="18" :stroke-width="1.75" /><span>{{ user?.login }}</span></NuxtLink>
          <button class="btn sm ghost" :aria-label="t('Вийти')" @click="logout"><LogOut :size="15" :stroke-width="1.9" /><span class="lbl">{{ t('Вийти') }}</span></button>
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
.bar { display: flex; align-items: center; gap: 18px; height: 56px; }
.brand { display: flex; align-items: center; gap: 8px; color: var(--ink); font-weight: 650; flex: none; }
.nav { display: flex; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.nav a { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-2); padding: 6px 10px; border-radius: 8px; font-size: 14px; white-space: nowrap; }
.nav a:hover { color: var(--ink); }
.nav a.on { color: var(--ink); background: var(--accent-wash); }
.who { display: flex; align-items: center; gap: 6px; flex: none; }
.icon-btn { all: unset; cursor: pointer; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; color: var(--ink-2); }
.icon-btn:hover { background: var(--grid); color: var(--ink); }
.icon-btn:focus-visible, .lang:focus-visible { outline: 2px solid var(--accent); }
.lang { all: unset; cursor: pointer; display: inline-flex; padding: 2px; border-radius: 8px; background: var(--hair); font-size: 12px; font-weight: 600; }
.lang span { padding: 4px 7px; border-radius: 6px; color: var(--ink-3); }
.lang span.on { background: var(--surface); color: var(--ink); }
.login { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); font-size: 14px; padding: 5px 8px; border-radius: 8px; }
.login:hover, .login.on { background: var(--grid); color: var(--ink); }
.ghost { border-color: transparent; color: var(--ink-2); }
.ghost:hover { border-color: var(--hair-strong); color: var(--ink); }
@media (max-width: 900px) {
  .nav a span, .login span { display: none; }
}
@media (max-width: 600px) {
  .brand span, .lbl { display: none; }
  .bar { gap: 8px; }
}
</style>
