// Motion helpers. Everything here turns itself off under prefers-reduced-motion.

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Tweens a number towards `target`. The first value counts up from 0 (the page-load moment);
 * later changes (a new period or landing) tween from the previous value, shorter.
 */
export function useCountUp(target: () => number | null, opts: { duration?: number; delay?: number } = {}) {
  const shown = ref<number | null>(null)
  let raf = 0
  let first = true

  function run(to: number | null) {
    cancelAnimationFrame(raf)
    if (to == null) { shown.value = null; return }
    if (prefersReducedMotion()) { shown.value = to; first = false; return }
    const from = first ? 0 : (shown.value ?? 0)
    const duration = first ? (opts.duration ?? 900) : 450
    const delay = first ? (opts.delay ?? 0) : 0
    first = false
    const start = performance.now() + delay
    shown.value = from
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      shown.value = from + (to - from) * easeOutCubic(t)
      if (t < 1) raf = requestAnimationFrame(step)
      else shown.value = to
    }
    raf = requestAnimationFrame(step)
  }

  onMounted(() => run(target()))
  watch(target, (v) => run(v))
  onBeforeUnmount(() => cancelAnimationFrame(raf))
  return shown
}
