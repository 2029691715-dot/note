<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useNotesStore } from './stores/notes'
import SidebarNav from './components/SidebarNav.vue'
import FileList from './components/FileList.vue'
import EditorArea from './components/EditorArea.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import GraphView from './components/GraphView.vue'

const store = useNotesStore()
const showSettings = ref(false)
const showGraph = ref(false)
const currentView = ref('notes')
const isMobile = ref(false)
const showMobileSidebar = ref(false)
const filterTag = ref(null)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) showMobileSidebar.value = false
}

function toggleMobileSidebar() {
  showMobileSidebar.value = !showMobileSidebar.value
}

function handleFilterTag(tag) {
  filterTag.value = tag
}

const displayedNotes = computed(() => {
  if (filterTag.value) {
    return store.notes.filter(n => n.content.includes(`#${filterTag.value}`))
  }
  return currentView.value === 'search' ? store.searchResults : store.notes
})

// 主题切换监听
watch(() => store.darkMode, (isDark) => {
  document.body.classList.toggle('light-mode', !isDark)
})

onMounted(() => {
  store.loadNotes()
  checkMobile()
  window.addEventListener('resize', checkMobile)
  // 初始化主题
  if (!store.darkMode) {
    document.body.classList.add('light-mode')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div id="app" :class="{ 'mobile-sidebar-open': showMobileSidebar }">
    <!-- 移动端顶部栏 -->
    <div v-if="isMobile" class="mobile-header">
      <button class="mobile-menu-btn" @click="toggleMobileSidebar">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span class="mobile-title">{{ store.currentNote?.title || 'Notes' }}</span>
    </div>

    <SidebarNav
      v-if="!isMobile"
      @new-note="store.createNote()"
      @search="currentView = 'search'"
      @all-notes="currentView = 'notes'"
      @graph="showGraph = true"
      @settings="showSettings = true"
    />

    <!-- 移动端侧边栏遮罩 -->
    <div v-if="isMobile && showMobileSidebar" class="sidebar-overlay" @click="showMobileSidebar = false"></div>

    <FileList
      v-if="!isMobile"
      :notes="displayedNotes"
      :current-note="store.currentNote"
      :search-query="store.searchQuery"
      :all-tags="store.allTags"
      @select="store.selectNote"
      @search="store.searchQuery = $event"
      @filter-tag="handleFilterTag"
    />

    <!-- 移动端侧边栏 -->
    <div v-if="isMobile" class="mobile-sidebar" :class="{ open: showMobileSidebar }">
      <div class="mobile-sidebar-header">
        <h2>笔记本</h2>
        <button class="close-btn" @click="showMobileSidebar = false">×</button>
      </div>
      <div class="search-box">
        <input
          type="text"
          placeholder="搜索笔记..."
          v-model="store.searchQuery"
        />
      </div>
      <div v-if="store.allTags.length" class="tags-section">
        <div class="tags-label">标签</div>
        <div class="tags-list">
          <span
            v-for="tag in store.allTags"
            :key="tag"
            class="tag-chip"
            :class="{ active: filterTag === tag }"
            @click="handleFilterTag(filterTag === tag ? null : tag)"
          >
            #{{ tag }}
          </span>
        </div>
      </div>
      <div class="note-items">
        <div
          v-for="note in displayedNotes"
          :key="note.id"
          class="note-item"
          :class="{ active: store.currentNote?.id === note.id }"
          @click="store.selectNote(note); showMobileSidebar = false"
        >
          <div class="note-item-title">{{ note.title }}</div>
        </div>
      </div>
    </div>

    <EditorArea
      v-if="store.currentNote"
      :note="store.currentNote"
      @update="store.updateNote"
      @delete="store.deleteNote"
      @navigate="store.selectNoteByTitle"
    />

    <div v-if="!store.currentNote && !isMobile" class="empty-state">
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

    <!-- 移动端新建按钮 -->
    <button v-if="isMobile" class="mobile-fab" @click="store.createNote()" title="新建笔记">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>

    <SettingsPanel v-if="showSettings" @close="showSettings = false" />

    <GraphView
      v-if="showGraph"
      :notes="store.notesWithLinks"
      @close="showGraph = false"
      @navigate="store.selectNoteByTitle"
    />

    <div v-if="!isMobile" class="keyboard-hint">
      <kbd>Ctrl</kbd>+<kbd>N</kbd> 新建 &nbsp;
      <kbd>Ctrl</kbd>+<kbd>S</kbd> 保存 &nbsp;
      <kbd>Ctrl</kbd>+<kbd>K</kbd> 链接
    </div>
  </div>
</template>

<style scoped>
/* 移动端适配 */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  align-items: center;
  padding: 0 16px;
  z-index: 50;
}

@media (max-width: 767px) {
  .mobile-header { display: flex; }
  .mobile-title {
    margin-left: 12px;
    font-size: 16px;
    font-weight: 500;
  }
}

.mobile-menu-btn {
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: 8px;
  cursor: pointer;
}

.sidebar-overlay {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 89;
}

.mobile-sidebar {
  position: fixed;
  top: 56px;
  left: 0;
  bottom: 0;
  width: 280px;
  background: var(--bg-secondary);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 90;
  overflow-y: auto;
  display: none;
}

.mobile-sidebar.open {
  transform: translateX(0);
}

@media (max-width: 767px) {
  .mobile-sidebar { display: flex; flex-direction: column; }
}

.mobile-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.mobile-sidebar-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 24px;
  cursor: pointer;
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

.tags-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.tags-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 8px;
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
}
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
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
}
.note-item:hover { background: var(--border); }
.note-item.active { background: var(--accent); }
.note-item-title {
  font-size: 13px;
  font-weight: 500;
}

/* 移动端浮动按钮 */
.mobile-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  background: var(--accent);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 40;
}

@media (max-width: 767px) {
  .mobile-fab { display: flex; }
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.empty-state svg {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  opacity: 0.3;
}

.empty-state h3 { font-size: 18px; margin-bottom: 8px; }
.empty-state p { font-size: 14px; }

/* 键盘提示 */
.keyboard-hint {
  position: fixed;
  bottom: 16px;
  right: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

kbd {
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}
</style>