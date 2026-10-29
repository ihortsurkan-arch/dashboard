import type { Ref } from 'vue'

/**
 * A panel teleported to <body> and pinned under (or above) a trigger, so it is never clipped by
 * cards or collapsing sections. Closes on outside pointer-down; follows scroll and resize.
 */
export function usePopover(trigger: Ref<HTMLElement | null>, panel: Ref<HTMLElement | null>, opts: { minWidth?: number; width?: number } = {}) {
  const open = ref(false)
  const pos = ref({ top: 0, left: 0, width: 0, up: false })

  function place() {
    const el = trigger.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(opts.width ?? Math.max(r.width, opts.minWidth ?? 220), vw - 16)
    const left = Math.min(Math.max(8, r.left), vw - width - 8)
    const h = panel.value?.offsetHeight ?? 360
    const below = vh - r.bottom - 12
    const up = below < h && r.top - 12 > below
    pos.value = { top: up ? r.top - 6 : r.bottom + 6, left, width, up }
  }
  function onDown(e: PointerEvent) {
    const t = e.target as Node
    if (!panel.value?.contains(t) && !trigger.value?.contains(t)) open.value = false
  }
  const onViewport = () => { if (open.value) place() }
  watch(open, async (v) => {
    if (v) {
      place()
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('resize', onViewport)
      window.addEventListener('scroll', onViewport, true)
      await nextTick()
      place() // again, now that the panel's real height is known
    } else {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', onViewport)
      window.removeEventListener('scroll', onViewport, true)
    }
  })
  onBeforeUnmount(() => { open.value = false })
  const style = computed(() => ({ top: `${pos.value.top}px`, left: `${pos.value.left}px`, width: `${pos.value.width}px` }))
  return { open, pos, style, place }
}
