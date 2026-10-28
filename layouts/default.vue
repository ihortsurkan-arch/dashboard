<script setup lang="ts">
import {
  CalendarClock, ChevronsLeft, ChevronsRight, CircleUserRound, Filter, Gauge, Globe2, LayoutDashboard, LayoutList,
  Link2, LogOut, Menu, Monitor, Moon, MousePointerClick, Settings2, Sun, Target, X,
} from 'lucide-vue-next'

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

// ---- collapsed (icons only) on desktop, drawer on phones ----
const collapsed = ref(false)
const drawer = ref(false)
onMounted(() => { try { collapsed.value = localStorage.getItem('ls:sidebar') === 'collapsed' } catch {} })
watch(collapsed, (v) => { try { localStorage.setItem('ls:sidebar', v ? 'collapsed' : 'open') } catch {} })
watch(() => route.fullPath, () => { drawer.value = false })

const pages = computed(() => [
  { to: '/', icon: LayoutDashboard, label: t('Дашборд'), on: route.path === '/' },
  { to: '/landings', icon: LayoutList, label: t('Усі лендинги'), on: route.path === '/landings' },
  ...(user.value?.role === 'admin' ? [{ to: '/admin', icon: Settings2, label: t('Адміністрування'), on: route.path.startsWith('/admin') }] : []),
])

// ---- dashboard sections with scroll-spy ----
const sections = computed(() => [
  { id: 'overview', icon: Gauge, label: t('Огляд') },
  { id: 'conversion', icon: Filter, label: t('Конверсія') },
  { id: 'leads', icon: Target, label: t('Ліди') },
  { id: 'sessions', icon: MousePointerClick, label: t('Сесії') },
  { id: 'geo', icon: Globe2, label: t('Географія') },
  { id: 'when', icon: CalendarClock, label: t('Коли приходять') },
  { id: 'sources', icon: Link2, label: t('Джерела трафіку') },
])
const current = ref('overview')
function onScroll() {
  if (route.path !== '/') return
  let best = 'overview'
  for (const s of sections.value) {
    const el = document.getElementById(s.id)
    if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) best = s.id
  }
  current.value = best
}
let raf = 0
const scrollHandler = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(onScroll) }
onMounted(() => window.addEventListener('scroll', scrollHandler, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', scrollHandler))
function jump(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: reduce ? 'auto' : 'smooth' })
  current.value = id
  drawer.value = false
}
const showSidebar = computed(() => loggedIn.value && route.path !== '/login')
</script>

<template>
  <div :class="['shell', { 'with-sb': showSidebar, collapsed }]">
    <template v-if="showSidebar">
      <!-- phones: slim top bar with a menu button -->
      <header class="mobilebar no-print">
        <button class="icon-btn" :aria-label="t('Меню')" :aria-expanded="drawer" @click="drawer = true"><Menu :size="20" /></button>
        <NuxtLink to="/" class="brand"><AppLogo :size="24" /><span>Landing Stats</span></NuxtLink>
        <button class="icon-btn" :title="themeLabel" :aria-label="themeLabel" @click="setTheme(nextTheme)">
          <Monitor v-if="themeChoice === 'system'" :size="18" /><Sun v-else-if="themeChoice === 'light'" :size="18" /><Moon v-else :size="18" />
        </button>
      </header>
      <Transition name="fade"><div v-if="drawer" class="scrim no-print" @click="drawer = false" /></Transition>

      <aside class="sidebar no-print" :class="{ open: drawer }" :aria-label="t('Навігація')">
        <div class="sb-top">
          <NuxtLink to="/" class="brand" :title="collapsed ? 'Landing Stats' : undefined"><AppLogo :size="28" /><span class="txt">Landing Stats</span></NuxtLink>
          <button class="icon-btn close" :aria-label="t('Закрити меню')" @click="drawer = false"><X :size="18" /></button>
        </div>

        <nav class="group">
          <NuxtLink v-for="p in pages" :key="p.to" :to="p.to" class="item" :class="{ on: p.on }" :title="collapsed ? p.label : undefined">
            <component :is="p.icon" :size="18" :stroke-width="1.8" /><span class="txt">{{ p.label }}</span>
          </NuxtLink>
        </nav>

        <nav v-if="route.path === '/'" class="group sections" :aria-label="t('Розділи дашборда')">
          <p class="caption txt">{{ t('Розділи') }}</p>
          <button v-for="s in sections" :key="s.id" class="item sec" :class="{ on: current === s.id }" :aria-current="current === s.id ? 'location' : undefined"
                  :title="collapsed ? s.label : undefined" @click="jump(s.id)">
            <component :is="s.icon" :size="17" :stroke-width="1.8" /><span class="txt">{{ s.label }}</span>
          </button>
        </nav>

        <div class="sb-bottom">
          <div class="prefs">
            <button class="item" :title="themeLabel" @click="setTheme(nextTheme)">
              <Monitor v-if="themeChoice === 'system'" :size="18" :stroke-width="1.8" /><Sun v-else-if="themeChoice === 'light'" :size="18" :stroke-width="1.8" /><Moon v-else :size="18" :stroke-width="1.8" />
              <span class="txt">{{ themeLabel }}</span>
            </button>
            <button class="lang" :aria-label="t('Мова')" @click="setLocale(locale === 'uk' ? 'ru' : 'uk')">
              <span :class="{ on: locale === 'uk' }">UA</span><span :class="{ on: locale === 'ru' }">RU</span>
            </button>
          </div>
          <NuxtLink to="/account" class="item" :class="{ on: route.path === '/account' }" :title="collapsed ? t('Мій акаунт') : undefined">
            <CircleUserRound :size="18" :stroke-width="1.8" /><span class="txt">{{ user?.login }}</span>
          </NuxtLink>
          <button class="item" :title="collapsed ? t('Вийти') : undefined" @click="logout"><LogOut :size="18" :stroke-width="1.8" /><span class="txt">{{ t('Вийти') }}</span></button>
          <button class="item collapse" :aria-label="collapsed ? t('Розгорнути панель') : t('Згорнути панель')" @click="collapsed = !collapsed">
            <ChevronsRight v-if="collapsed" :size="18" /><ChevronsLeft v-else :size="18" /><span class="txt">{{ t('Згорнути панель') }}</span>
          </button>
        </div>
      </aside>
    </template>

    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell { --sb: 0px; }
.shell.with-sb { --sb: 236px; }
.shell.with-sb.collapsed { --sb: 68px; }
.main { margin-left: var(--sb); min-width: 0; transition: margin-left .2s ease; }

.sidebar {
  position: fixed; inset: 0 auto 0 0; width: var(--sb); z-index: 20;
  display: flex; flex-direction: column; gap: 18px; padding: 16px 12px;
  background: var(--surface); border-right: 1px solid var(--hair);
  overflow-y: auto; overflow-x: hidden; scrollbar-width: thin;
  transition: width .2s ease;
}
.sb-top { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; min-height: 36px; }
.brand { display: flex; align-items: center; gap: 10px; color: var(--ink); font-weight: 700; font-size: 15px; white-space: nowrap; }
.group { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
.caption { margin: 0 0 4px; padding: 0 10px; font-size: 12px; color: var(--ink-3); }
.item {
  all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 11px;
  padding: 8px 10px; border-radius: 9px; color: var(--ink-2); font-size: 14px; white-space: nowrap; min-height: 38px;
}
.item:hover { background: var(--grid); color: var(--ink); }
.item.on { background: var(--accent-wash); color: var(--accent); font-weight: 600; }
.item:focus-visible, .lang:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.item svg { flex: none; }
.sections .item.sec { font-size: 13.5px; min-height: 34px; padding: 6px 10px; position: relative; }
.sections .item.sec.on { background: transparent; color: var(--ink); }
.sections .item.sec.on::before { content: ''; position: absolute; left: 0; top: 7px; bottom: 7px; width: 3px; border-radius: 2px; background: var(--accent); }
.sections .item.sec.on svg { color: var(--accent); }
.sb-bottom { margin-top: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; border-top: 1px solid var(--hair); padding-top: 12px; }
.prefs { display: flex; align-items: center; gap: 6px; }
.prefs .item { flex: 1; min-width: 0; }
.prefs .item .txt { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
.lang { all: unset; cursor: pointer; display: inline-flex; padding: 2px; border-radius: 8px; background: var(--hair); font-size: 11.5px; font-weight: 700; flex: none; }
.lang span { padding: 4px 6px; border-radius: 6px; color: var(--ink-3); }
.lang span.on { background: var(--surface); color: var(--ink); }
.collapse { color: var(--ink-3); }
.icon-btn.close { display: none; }

/* icons only */
.collapsed .sidebar .txt, .collapsed .sidebar .caption { display: none; }
.collapsed .sidebar .item { justify-content: center; padding: 8px; }
.collapsed .sidebar .prefs { flex-direction: column; }
.collapsed .sidebar .lang span:not(.on) { display: none; }
.collapsed .sidebar .sb-top { justify-content: center; }
.collapsed .sections .item.sec.on::before { left: -6px; }

.icon-btn { all: unset; cursor: pointer; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px; color: var(--ink-2); }
.icon-btn:hover { background: var(--grid); color: var(--ink); }
.icon-btn:focus-visible { outline: 2px solid var(--accent); }

.mobilebar { display: none; }
.scrim { position: fixed; inset: 0; background: rgba(10, 12, 16, .4); z-index: 19; }

@media (max-width: 900px) {
  .shell.with-sb, .shell.with-sb.collapsed { --sb: 0px; }
  .main { margin-left: 0; }
  .mobilebar {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    position: sticky; top: 0; z-index: 15; height: 52px; padding: 0 8px;
    background: var(--surface); border-bottom: 1px solid var(--hair);
  }
  .sidebar { width: min(84vw, 280px); transform: translateX(-100%); transition: transform .22s ease; box-shadow: 0 10px 40px rgba(0, 0, 0, .2); }
  .sidebar.open { transform: none; }
  .collapsed .sidebar .txt, .collapsed .sidebar .caption { display: initial; }
  .collapsed .sidebar .item { justify-content: flex-start; padding: 8px 10px; }
  .collapsed .sidebar .prefs { flex-direction: row; }
  .collapsed .sidebar .lang span:not(.on) { display: inline; }
  .icon-btn.close { display: grid; }
  .collapse { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .sidebar, .main { transition: none; }
}
@media print {
  .main { margin-left: 0 !important; }
}
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
