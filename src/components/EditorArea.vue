<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useNotesStore } from '../stores/notes'

const props = defineProps({
  note: Object
})

const emit = defineEmits(['update', 'delete', 'navigate'])
const store = useNotesStore()

const title = ref('')

// 初始化编辑器
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '开始写点什么...'
    }),
    Highlight.configure({
      multicolor: true
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'bi-link'
      }
    }),
    TaskList,
    TaskItem.configure({
      nested: true
    })
  ],
  content: '',
  editorProps: {
    attributes: {
      class: 'ProseMirror'
    }
  }
})

// 监听笔记变化
watch(() => props.note, (note) => {
  if (note && editor.value) {
    title.value = note.title
    editor.value.commands.setContent(note.content || '')
  }
}, { immediate: true })

// 自动保存（防抖）
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

// 处理输入
function onTitleInput(e) {
  title.value = e.target.value
  scheduleSave()
}

function onContentUpdate() {
  scheduleSave()
}

// 点击双向链接
function handleClick(e) {
  const link = e.target.closest('.bi-link')
  if (link) {
    const href = link.getAttribute('data-note-title')
    if (href) emit('navigate', href)
  }
}

// 获取反向链接
const backlinks = computed(() => {
  if (!props.note) return []
  return store.getBacklinks(props.note.title)
})

// 格式化时间
function formatDate(ts) {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 键盘快捷键
function handleKeydown(e) {
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
  }
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
      <div style="font-size: 12px; color: var(--text-secondary);">
        {{ formatDate(note?.updatedAt || Date.now()) }}
      </div>
    </header>

    <div class="editor-container" @click="handleClick">
      <div class="editor-wrapper">
        <input
          type="text"
          class="title-input"
          v-model="title"
          placeholder="笔记标题..."
          @input="onTitleInput"
        />

        <EditorContent :editor="editor" @update="onContentUpdate" />

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
      </div>
    </div>
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

.breadcrumb {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
}

.breadcrumb span {
  color: var(--text-primary);
}

.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.editor-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.title-input {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 24px;
}

.title-input:focus {
  outline: none;
}

.title-input::placeholder {
  color: var(--text-secondary);
}

.backlinks-panel {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

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

.backlink-item:hover {
  background: var(--border);
}

.backlink-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--link-highlight);
}

.backlink-context {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>