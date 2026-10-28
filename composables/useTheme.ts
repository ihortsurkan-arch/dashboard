// Theme: follows the system unless the viewer picks light or dark (remembered per browser).
export type ThemeChoice = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'ls:theme'

function initial(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

export const themeChoice = ref<ThemeChoice>(typeof window === 'undefined' ? 'system' : initial())
const tick = ref(0)

function apply(choice: ThemeChoice) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (choice === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', choice)
  // Charts read colours from CSS variables: let them redraw after the switch lands
  requestAnimationFrame(() => { tick.value++ })
}

let wired = false
function wire() {
  if (wired || typeof window === 'undefined') return
  wired = true
  apply(themeChoice.value)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { tick.value++ })
  watch(themeChoice, (c) => {
    try { localStorage.setItem(STORAGE_KEY, c) } catch {}
    apply(c)
  })
}

export function setTheme(c: ThemeChoice) {
  wire()
  themeChoice.value = c
}

/** A counter that changes whenever the effective theme changes; read it inside chart computeds. */
export function useThemeTick() {
  wire()
  return tick
}
