<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useNotesStore } from '../stores/notes'

const props = defineProps({
  note: Object
})

const emit = defineEmits(['update', 'delete', 'navigate'])
const store = useNotesStore()

const title = ref('')
const showHistory = ref(false)
const showTableModal = ref(false)
const tableRows = ref(3)
const tableCols = ref(3)
const fileInputRef = ref(null)

// 双向链接自动补全
const showAutocomplete = ref(false)
const autocompleteQuery = ref('')
const autocompletePosition = ref({ top: 0, left: 0 })
const selectedIndex = ref(0)

const autocompleteResults = computed(() => {
  if (!autocompleteQuery.value.trim()) return store.notes.slice(0, 5)
  const q = autocompleteQuery.value.toLowerCase()
  return store.notes.filter(n =>
    n.title.toLowerCase().includes(q) && n.id !== props.note?.id
  ).slice(0, 8)
})

// 块引用渲染
const blockRefs = computed(() => {
  if (!props.note) return []
  const regex = /!?\[\[([^\]]+)\^([^\]]+)\]\]/g
  const refs = []
  const content = props.note.content
  let match
  while ((match = regex.exec(content)) !== null) {
    const isEmbed = match[1] === '!'
    const parts = match[2].split('^')
    const noteTitle = parts[0]
    const blockId = parts[1]
    const targetNote = store.notes.find(n => n.title === noteTitle)
    refs.push({
      fullMatch: match[0],
      isEmbed,
      noteTitle,
      blockId,
      targetNote,
      content: targetNote ? `[块 ${blockId} 内容]` : '[笔记未找到]'
    })
  }
  return refs
})

// 历史记录
const historyList = computed(() => {
  if (!props.note?.history?.length) return []
  return [...props.note.history].reverse()
})

// 初始化编辑器
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '开始写点什么...输入 [[ 链接笔记，#标签 添加标签'
    }),
    Highlight.configure({ multicolor: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'bi-link' }
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({
      inline: true,
      allowBase64: true
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: { class: 'editor-table' }
    }),
    TableRow,
    TableCell,
    TableHeader
  ],
  content: '',
  editorProps: {
    attributes: { class: 'ProseMirror' }
  }
})

// 监听笔记变化
watch(() => props.note, (note) => {
  if (note && editor.value) {
    title.value = note.title
    editor.value.commands.setContent(note.content || '')
    showHistory.value = false
  }
}, { immediate: true })

// 自动保存
let saveTimeout = null
function scheduleSave() {
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    if (props.note) {
      emit('update', props.note.id, {
        title: title.value,
        content: editor.value?.getHTML() || ''
      })
    }
  }, 1500)
}

function onTitleInput(e) {
  title.value = e.target.value
  scheduleSave()
}

function onContentUpdate() {
  scheduleSave()
  checkAutocomplete()
}

// 检测 [[ 自动补全
function checkAutocomplete() {
  if (!editor.value) return
  const { selection, doc } = editor.value.state
  const pos = selection.$from
  const textBefore = doc.textBetween(Math.max(0, pos.pos - 50), pos.pos)
  const match = textBefore.match(/\[\[([^\]]*?)$/)
  if (match) {
    autocompleteQuery.value = match[1]
    showAutocomplete.value = true
    selectedIndex.value = 0
    const coords = editor.value.view.coordsAtPos(pos.pos)
    autocompletePosition.value = {
      top: coords.bottom + 4,
      left: coords.left
    }
  } else {
    showAutocomplete.value = false
  }
}

// 选择自动补全项
function selectAutocomplete(note) {
  if (!editor.value) return
  const { state } = editor.value
  const pos = state.selection.$from
  const textBefore = state.doc.textBetween(Math.max(0, pos.pos - 50), pos.pos)
  const match = textBefore.match(/\[\[([^\]]*?)$/)
  if (match) {
    const start = pos.pos - match[0].length
    editor.value.chain()
      .deleteRange({ from: start, to: pos.pos })
      .insertContent(`[[${note.title}]]`)
      .run()
  }
  showAutocomplete.value = false
}

// 键盘导航
function handleKeydown(e) {
  if (showAutocomplete.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, autocompleteResults.value.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    } else if (e.key === 'Enter' && autocompleteResults.value.length > 0) {
      e.preventDefault()
      selectAutocomplete(autocompleteResults.value[selectedIndex.value])
    } else if (e.key === 'Escape') {
      showAutocomplete.value = false
    }
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') {
      e.preventDefault()
      if (props.note) {
        emit('update', props.note.id, {
          title: title.value,
          content: editor.value?.getHTML() || ''
        })
      }
    }
    if (e.key === 'k') {
      e.preventDefault()
      showAutocomplete.value = true
      autocompleteQuery.value = ''
      selectedIndex.value = 0
    }
  }
}

// ========== 图片上传 ==========
function triggerImageUpload() {
  fileInputRef.value?.click()
}

function handleFileSelect(e) {
  const files = e.target.files
  if (files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (evt) => {
          editor.value?.chain().focus().setImage({ src: evt.target.result }).run()
        }
        reader.readAsDataURL(file)
      }
    })
  }
  e.target.value = ''
}

// 图片拖拽上传
function handleDrop(e) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (evt) => {
          editor.value?.chain().focus().setImage({ src: evt.target.result }).run()
        }
        reader.readAsDataURL(file)
      }
    })
  }
}

function handleDragOver(e) {
  e.preventDefault()
}

// ========== 表格功能 ==========
function openTableModal() {
  tableRows.value = 3
  tableCols.value = 3
  showTableModal.value = true
}

function insertTable() {
  editor.value?.chain().focus().insertTable({
    rows: tableRows.value,
    cols: tableCols.value,
    withHeaderRow: true
  }).run()
  showTableModal.value = false
}

function addTableRow() {
  editor.value?.chain().focus().addRowAfter().run()
}

function addTableCol() {
  editor.value?.chain().focus().addColumnAfter().run()
}

function deleteTableRow() {
  editor.value?.chain().focus().deleteRow().run()
}

function deleteTableCol() {
  editor.value?.chain().focus().deleteColumn().run()
}

function deleteTable() {
  editor.value?.chain().focus().deleteTable().run()
}

// 点击双向链接
function handleClick(e) {
  const link = e.target.closest('.bi-link')
  if (link) {
    const href = link.getAttribute('href') || link.textContent
    if (href) emit('navigate', href)
  }
}

// 反向链接
const backlinks = computed(() => {
  if (!props.note) return []
  return store.getBacklinks(props.note.title)
})

// 回滚
function rollback(historyIndex) {
  if (store.rollbackToHistory(props.note.id, historyIndex)) {
    showHistory.value = false
  }
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  clearTimeout(saveTimeout)
})
</script>

<template>
  <main class="editor-area">
    <header class="editor-header">
      <div class="breadcrumb">
        工作 &gt; <span>{{ note?.title }}</span>
      </div>
      <div class="header-actions">
        <!-- 工具栏按钮 -->
        <div class="editor-toolbar">
          <button class="toolbar-btn" title="插入图片" @click="triggerImageUpload">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <button class="toolbar-btn" title="插入表格" @click="openTableModal">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
          </button>
        </div>

        <button class="btn-icon" title="历史版本" @click="showHistory = !showHistory">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
        <span style="font-size: 12px; color: var(--text-secondary);">
          {{ formatDate(note?.updatedAt || Date.now()) }}
        </span>
      </div>
    </header>

    <div
      class="editor-container"
      @click="handleClick"
      @drop="handleDrop"
      @dragover="handleDragOver"
    >
      <div class="editor-wrapper">
        <input
          type="text"
          class="title-input"
          v-model="title"
          placeholder="笔记标题..."
          @input="onTitleInput"
        />

        <EditorContent :editor="editor" @update="onContentUpdate" />

        <!-- 表格工具栏（当光标在表格内时显示） -->
        <div v-if="editor?.isActive('table')" class="table-toolbar">
          <button class="table-btn" @click="addTableRow" title="添加行">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加行
          </button>
          <button class="table-btn" @click="deleteTableRow" title="删除行">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            删除行
          </button>
          <button class="table-btn" @click="addTableCol" title="添加列">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加列
          </button>
          <button class="table-btn" @click="deleteTableCol" title="删除列">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            删除列
          </button>
          <button class="table-btn danger" @click="deleteTable" title="删除表格">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            删除表格
          </button>
        </div>

        <!-- 块引用展示 -->
        <div v-if="blockRefs.length > 0" class="block-refs-panel">
          <div class="block-refs-title">引用的块</div>
          <div v-for="ref in blockRefs" :key="ref.fullMatch" class="block-ref-item" :class="{ embed: ref.isEmbed }">
            <div class="block-ref-source">{{ ref.noteTitle }} ^{{ ref.blockId }}</div>
            <div class="block-ref-content">{{ ref.content }}</div>
          </div>
        </div>

        <!-- 反向链接面板 -->
        <div v-if="backlinks.length > 0" class="backlinks-panel">
          <div class="backlinks-title">反向链接 ({{ backlinks.length }})</div>
          <div
            v-for="bl in backlinks"
            :key="bl.id"
            class="backlink-item"
            @click="$emit('navigate', bl.title)"
          >
            <div class="backlink-title">{{ bl.title }}</div>
            <div class="backlink-context">{{ bl.preview }}</div>
          </div>
        </div>

        <!-- 历史版本 -->
        <div v-if="showHistory && historyList.length > 0" class="history-panel">
          <div class="history-title">历史版本 ({{ historyList.length }})</div>
          <div
            v-for="(hist, idx) in historyList"
            :key="idx"
            class="history-item"
          >
            <div class="history-time">{{ formatDate(hist.timestamp) }}</div>
            <button class="btn-small" @click="rollback(idx)">回滚到此版本</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件输入框 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 表格创建弹窗 -->
    <Teleport to="body">
      <div v-if="showTableModal" class="modal-overlay" @click.self="showTableModal = false">
        <div class="modal-content">
          <h3>插入表格</h3>
          <div class="modal-field">
            <label>行数</label>
            <div class="stepper">
              <button @click="tableRows = Math.max(2, tableRows - 1)">-</button>
              <input type="number" v-model.number="tableRows" min="2" max="20" />
              <button @click="tableRows = Math.min(20, tableRows + 1)">+</button>
            </div>
          </div>
          <div class="modal-field">
            <label>列数</label>
            <div class="stepper">
              <button @click="tableCols = Math.max(2, tableCols - 1)">-</button>
              <input type="number" v-model.number="tableCols" min="2" max="10" />
              <button @click="tableCols = Math.min(10, tableCols + 1)">+</button>
            </div>
          </div>
          <div class="modal-preview">
            <span>预览: {{ tableRows }} 行 × {{ tableCols }} 列</span>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="showTableModal = false">取消</button>
            <button class="btn-confirm" @click="insertTable">插入</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 双向链接自动补全弹窗 -->
    <Teleport to="body">
      <div
        v-if="showAutocomplete && autocompleteResults.length > 0"
        class="autocomplete-popup"
        :style="{ top: autocompletePosition.top + 'px', left: autocompletePosition.left + 'px' }"
      >
        <div
          v-for="(note, idx) in autocompleteResults"
          :key="note.id"
          class="autocomplete-item"
          :class="{ selected: idx === selectedIndex }"
          @click="selectAutocomplete(note)"
          @mouseenter="selectedIndex = idx"
        >
          <span class="autocomplete-title">{{ note.title }}</span>
          <span class="autocomplete-preview">{{ note.content.slice(0, 30) }}...</span>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
}

.editor-header {
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 16px;
}

.breadcrumb { flex: 1; font-size: 13px; color: var(--text-secondary); }
.breadcrumb span { color: var(--text-primary); }

.header-actions { display: flex; align-items: center; gap: 12px; }

/* 工具栏按钮 */
.editor-toolbar {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  border-right: 1px solid var(--border);
  border-left: 1px solid var(--border);
}

.toolbar-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.toolbar-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}
.btn-icon:hover { background: var(--border); color: var(--text-primary); }

.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.editor-wrapper { max-width: 800px; margin: 0 auto; }

.title-input {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 24px;
}
.title-input:focus { outline: none; }
.title-input::placeholder { color: var(--text-secondary); }

/* 表格工具栏 */
.table-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 16px;
}

.table-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--border);
  border: none;
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.table-btn:hover { background: var(--accent); }
.table-btn.danger:hover { background: #dc3545; }

/* 块引用 */
.block-refs-panel {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.block-refs-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.block-ref-item {
  padding: 12px;
  background: rgba(78, 205, 196, 0.1);
  border-left: 2px solid var(--block-highlight);
  border-radius: 0 8px 8px 0;
  margin-bottom: 8px;
}
.block-ref-item.embed { background: rgba(78, 205, 196, 0.15); }
.block-ref-source { font-size: 12px; color: var(--block-highlight); margin-bottom: 4px; }
.block-ref-content { font-size: 13px; color: var(--text-secondary); }

/* 反向链接 */
.backlinks-panel { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border); }
.backlinks-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.backlink-item {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.backlink-item:hover { background: var(--border); }
.backlink-title { font-size: 14px; font-weight: 500; margin-bottom: 4px; color: var(--link-highlight); }
.backlink-context { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

/* 历史版本 */
.history-panel {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.history-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 8px;
}
.history-time { font-size: 13px; color: var(--text-secondary); }
.btn-small {
  padding: 4px 12px;
  background: var(--accent);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  cursor: pointer;
}
.btn-small:hover { background: var(--accent-hover); }
</style>

<style>
/* 自动补全弹窗 */
.autocomplete-popup {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  z-index: 1000;
  min-width: 280px;
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
}
.autocomplete-item {
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.autocomplete-item:last-child { border-bottom: none; }
.autocomplete-item:hover, .autocomplete-item.selected { background: var(--border); }
.autocomplete-title { display: block; font-size: 14px; font-weight: 500; color: var(--text-primary); margin-bottom: 2px; }
.autocomplete-preview { display: block; font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 表格弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  width: 320px;
}
.modal-content h3 {
  margin: 0 0 20px;
  font-size: 18px;
}
.modal-field {
  margin-bottom: 16px;
}
.modal-field label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stepper button {
  width: 36px;
  height: 36px;
  background: var(--border);
  border: none;
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 18px;
  cursor: pointer;
}
.stepper button:hover { background: var(--accent); }
.stepper input {
  width: 60px;
  height: 36px;
  text-align: center;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 16px;
}
.stepper input:focus { outline: none; border-color: var(--accent); }
.modal-preview {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 20px;
  padding: 8px;
  background: var(--bg-primary);
  border-radius: 6px;
}
.modal-actions {
  display: flex;
  gap: 12px;
}
.btn-cancel {
  flex: 1;
  padding: 10px;
  background: var(--border);
  border: none;
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
}
.btn-cancel:hover { background: #444; }
.btn-confirm {
  flex: 1;
  padding: 10px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
}
.btn-confirm:hover { background: var(--accent-hover); }

/* 表格样式 */
.editor-table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}
.editor-table td, .editor-table th {
  border: 1px solid var(--border);
  padding: 8px 12px;
  min-width: 80px;
}
.editor-table th {
  background: var(--bg-secondary);
  font-weight: 600;
}
.editor-table .selectedCell {
  background: rgba(233, 69, 96, 0.2);
}
</style>