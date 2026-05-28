<script setup>
import { computed } from 'vue'

const props = defineProps({
  notes: Array,
  currentNote: Object,
  searchQuery: String
})

defineEmits(['select', 'search'])

function formatDate(timestamp) {
  const d = new Date(timestamp)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <aside class="file-list">
    <div class="file-list-header">
      <h2>笔记本</h2>
    </div>

    <div class="search-box">
      <input
        type="text"
        placeholder="搜索笔记..."
        :value="searchQuery"
        @input="$emit('search', $event.target.value)"
      />
    </div>

    <div class="note-items">
      <div
        v-for="note in notes"
        :key="note.id"
        class="note-item"
        :class="{ active: currentNote?.id === note.id }"
        @click="$emit('select', note)"
      >
        <div class="note-item-title">{{ note.title }}</div>
        <div class="note-item-date">{{ formatDate(note.updatedAt) }}</div>
      </div>

      <div v-if="notes.length === 0" style="padding: 16px; color: var(--text-secondary); text-align: center;">
        暂无笔记
      </div>
    </div>
  </aside>
</template>