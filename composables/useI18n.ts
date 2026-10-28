// Tiny i18n: the Ukrainian text is the key, Russian comes from the dictionary.
// `t('Сесії за {n} днів', { n: 7 })`. Missing entries fall back to Ukrainian.
import { ru } from '~/i18n/ru'

export type Locale = 'uk' | 'ru'
const STORAGE_KEY = 'ls:locale'

function initial(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'uk' || saved === 'ru') return saved
  } catch {}
  return 'uk'
}

export const locale = ref<Locale>(typeof window === 'undefined' ? 'uk' : initial())

export function setLocale(l: Locale) {
  locale.value = l
  try { localStorage.setItem(STORAGE_KEY, l) } catch {}
  if (typeof document !== 'undefined') document.documentElement.lang = l
}

export function t(text: string, params?: Record<string, string | number>): string {
  let out = locale.value === 'ru' ? (ru[text] ?? text) : text
  if (params) for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

/** BCP-47 tag for Intl formatting. */
export function intlLocale() {
  return locale.value === 'ru' ? 'ru-RU' : 'uk-UA'
}

export function useI18n() {
  return { t, locale, setLocale }
}
