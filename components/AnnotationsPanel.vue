<script setup lang="ts">
import { MapPin, Plus, Trash2, X } from 'lucide-vue-next'
import type { Annotation } from '~~/shared/stats'

// Event markers for the trend charts: list for the period, add, delete own (admins: any).
const props = defineProps<{ notes: Annotation[]; landingId: number; from: string; to: string }>()
const emit = defineEmits<{ changed: [] }>()

const adding = ref(false)
const date = ref(props.to)
const text = ref('')
const err = ref('')
const busy = ref(false)
watch(() => props.to, (v) => { date.value = v })

async function add() {
  err.value = ''
  busy.value = true
  try {
    await $fetch('/api/annotations', { method: 'POST', body: { landingId: props.landingId, date: date.value, text: text.value } })
    text.value = ''
    adding.value = false
    emit('changed')
  } catch (e: any) {
    err.value = e?.data?.statusMessage || t('Не вдалося зберегти')
  } finally { busy.value = false }
}
async function remove(n: Annotation) {
  if (!confirm(t('Видалити позначку «{t}»?', { t: n.text }))) return
  await $fetch(`/api/annotations/${n.id}`, { method: 'DELETE' })
  emit('changed')
}
</script>

<template>
  <div class="notes">
    <div class="head">
      <span class="title"><MapPin :size="15" :stroke-width="2" class="ico" />{{ t('Позначки подій') }}</span>
      <button v-if="!adding" class="btn sm ghost no-print" @click="adding = true"><Plus :size="14" :stroke-width="2" />{{ t('Додати позначку') }}</button>
    </div>
    <Transition name="expand">
      <div v-if="adding" class="form no-print" @keydown.enter.prevent="text && add()">
        <input v-model="date" class="input" type="date" :min="from" :max="to" :aria-label="t('Дата')">
        <input v-model="text" class="input grow" maxlength="200" :placeholder="t('Напр. Новий пост в Instagram')" :aria-label="t('Текст позначки')">
        <button class="btn primary sm" :disabled="!text.trim() || busy" @click="add">{{ t('Зберегти') }}</button>
        <button class="btn sm" :aria-label="t('Скасувати')" @click="adding = false"><X :size="14" /></button>
        <p v-if="err" class="error">{{ err }}</p>
      </div>
    </Transition>
    <TransitionGroup v-if="notes.length" name="list" tag="ul" class="items">
      <li v-for="n in notes" :key="n.id">
        <span class="d num">{{ fmtDay(n.date) }}</span>
        <span class="txt">{{ n.text }}</span>
        <span class="who">{{ n.author }}</span>
        <button v-if="n.canDelete" class="del no-print" :aria-label="t('Видалити')" @click="remove(n)"><Trash2 :size="14" /></button>
      </li>
    </TransitionGroup>
    <p v-else-if="!adding" class="empty-line">{{ t('За цей період позначок немає. Додайте, наприклад, дату нового поста або запуску реклами, і вона з’явиться на графіках.') }}</p>
  </div>
</template>

<style scoped>
.notes { display: grid; gap: 10px; border-top: 1px solid var(--hair); padding-top: 14px; margin-top: 14px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.title { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; }
.ico { color: var(--accent); }
.form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.grow { flex: 1 1 220px; }
.error { flex-basis: 100%; margin: 0; }
.items { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.items li { display: grid; grid-template-columns: 64px 1fr auto 24px; gap: 10px; align-items: center; font-size: 13.5px; padding: 5px 0; }
.d { color: var(--accent); font-weight: 600; }
.txt { min-width: 0; overflow-wrap: anywhere; }
.who { font-size: 12px; color: var(--ink-3); }
.del { all: unset; cursor: pointer; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: var(--ink-3); }
.del:hover { color: var(--bad); background: var(--grid); }
.empty-line { margin: 0; font-size: 13px; color: var(--ink-3); }
.ghost { border-color: transparent; color: var(--ink-2); }
</style>
