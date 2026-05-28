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
import { useNotesStore } from '../stores/notes'

const props = defineProps({
  note: Object
})

const emit = defineEmits(['update', 'delete', 'navigate'])
const store = useNotesStore()

const title = ref('')
const showHistory = ref(false)

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
    })
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
    // 计算弹窗位置
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
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 16px;
}

.breadcrumb { flex: 1; font-size: 13px; color: var(--text-secondary); }
.breadcrumb span { color: var(--text-primary); }

.header-actions { display: flex; align-items: center; gap: 12px; }

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
.autocomplete-item:hover, .autocomplete-item.selected {
  background: var(--border);
}
.autocomplete-title {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.autocomplete-preview {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>