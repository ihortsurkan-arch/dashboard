// Re-reads CSS colors when the system theme flips, so charts follow light/dark.
export function useThemeTick() {
  const tick = useState('theme-tick', () => 0)
  onMounted(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => { tick.value++ }
    mq.addEventListener('change', on)
    onBeforeUnmount(() => mq.removeEventListener('change', on))
  })
  return tick
}
