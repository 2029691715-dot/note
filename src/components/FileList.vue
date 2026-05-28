<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  notes: Array,
  currentNote: Object,
  searchQuery: String,
  allTags: Array
})

const emit = defineEmits(['select', 'search', 'filterTag'])

const selectedTag = ref(null)

function formatDate(timestamp) {
  const d = new Date(timestamp)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// 高亮搜索关键词
function highlightText(text, query) {
  if (!query || !query.trim()) return text
  const q = query.trim()
  const regex = new RegExp(`(${q})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

function selectTag(tag) {
  if (selectedTag.value === tag) {
    selectedTag.value = null
    emit('filterTag', null)
  } else {
    selectedTag.value = tag
    emit('filterTag', tag)
  }
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

    <!-- 标签筛选 -->
    <div v-if="allTags && allTags.length > 0" class="tags-section">
      <div class="tags-label">标签</div>
      <div class="tags-list">
        <span
          v-for="tag in allTags"
          :key="tag"
          class="tag-chip"
          :class="{ active: selectedTag === tag }"
          @click="selectTag(tag)"
        >
          #{{ tag }}
        </span>
      </div>
    </div>

    <div class="note-items">
      <div
        v-for="note in notes"
        :key="note.id"
        class="note-item"
        :class="{ active: currentNote?.id === note.id }"
        @click="$emit('select', note)"
      >
        <div class="note-item-title" v-html="highlightText(note.title, searchQuery)"></div>
        <div class="note-item-date">{{ formatDate(note.updatedAt) }}</div>
        <div v-if="note.tags && note.tags.length" class="note-item-tags">
          <span v-for="tag in note.tags.slice(0, 3)" :key="tag" class="tag-mini">#{{ tag }}</span>
        </div>
      </div>

      <div v-if="notes.length === 0" style="padding: 16px; color: var(--text-secondary); text-align: center;">
        暂无笔记
      </div>
    </div>
  </aside>
</template>

<style scoped>
.file-list {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.file-list-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.file-list-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.search-box {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.search-box input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
}
.search-box input:focus { outline: none; border-color: var(--accent); }

/* 标签区域 */
.tags-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.tags-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tag-chip {
  padding: 3px 8px;
  background: var(--bg-primary);
  border-radius: 12px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.tag-chip:hover { background: var(--border); color: var(--text-primary); }
.tag-chip.active {
  background: var(--accent);
  color: white;
}

.note-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.note-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
  transition: background 0.15s;
}
.note-item:hover { background: var(--border); }
.note-item.active { background: var(--accent); }

.note-item-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-item-date {
  font-size: 11px;
  color: var(--text-secondary);
}
.note-item.active .note-item-date { color: rgba(255,255,255,0.7); }

.note-item-tags {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tag-mini {
  font-size: 10px;
  padding: 1px 6px;
  background: rgba(233, 69, 96, 0.2);
  border-radius: 8px;
  color: var(--accent);
}

/* 搜索高亮 */
:deep(mark) {
  background: var(--link-highlight);
  color: var(--bg-primary);
  padding: 0 2px;
  border-radius: 2px;
}
</style>