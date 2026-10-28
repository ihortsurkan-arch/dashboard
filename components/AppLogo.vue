<script setup lang="ts">
defineProps<{ size?: number }>()
</script>

<template>
  <!-- Plum tile with three rising bars: traffic going up on a landing -->
  <svg :width="size ?? 24" :height="size ?? 24" viewBox="0 0 32 32" aria-hidden="true" class="app-logo">
    <rect width="32" height="32" rx="9" fill="var(--accent)" />
    <rect x="8" y="17" width="4" height="7" rx="2" fill="var(--accent-ink)" opacity=".55" />
    <rect x="14" y="12" width="4" height="12" rx="2" fill="var(--accent-ink)" opacity=".8" />
    <rect x="20" y="8" width="4" height="16" rx="2" fill="var(--accent-ink)" />
  </svg>
</template>

<style scoped>
.app-logo { display: block; flex: none; }
</style>
