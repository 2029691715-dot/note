<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useNotesStore } from './stores/notes'
import SidebarNav from './components/SidebarNav.vue'
import FileList from './components/FileList.vue'
import EditorArea from './components/EditorArea.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import GraphView from './components/GraphView.vue'

const store = useNotesStore()
const showSettings = ref(false)
const showGraph = ref(false)
const currentView = ref('notes') // notes, search, tags, trash

onMounted(() => {
  store.loadNotes()
})

const currentNote = computed(() => store.currentNote)
const notes = computed(() => store.notes)
const searchQuery = computed({
  get: () => store.searchQuery,
  set: (v) => store.searchQuery = v
})
</script>

<template>
  <div id="app">
    <SidebarNav
      @new-note="store.createNote()"
      @search="currentView = 'search'"
      @all-notes="currentView = 'notes'"
      @graph="showGraph = true"
      @settings="showSettings = true"
    />

    <FileList
      :notes="currentView === 'search' ? store.searchResults : notes"
      :current-note="currentNote"
      :search-query="searchQuery"
      @select="store.selectNote"
      @search="store.searchQuery = $event"
    />

    <EditorArea
      v-if="currentNote"
      :note="currentNote"
      @update="store.updateNote"
      @delete="store.deleteNote"
      @navigate="store.selectNoteByTitle"
    />

    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
      <h3>选择或创建笔记</h3>
      <p>按 <kbd>Ctrl</kbd>+<kbd>N</kbd> 新建笔记</p>
    </div>

    <SettingsPanel
      v-if="showSettings"
      @close="showSettings = false"
    />

    <GraphView
      v-if="showGraph"
      :notes="store.notesWithLinks"
      @close="showGraph = false"
      @navigate="store.selectNoteByTitle"
    />

    <div class="keyboard-hint">
      <kbd>Ctrl</kbd>+<kbd>N</kbd> 新建 &nbsp;
      <kbd>Ctrl</kbd>+<kbd>S</kbd> 保存 &nbsp;
      <kbd>Ctrl</kbd>+<kbd>[[</kbd> 链接
    </div>
  </div>
</template>