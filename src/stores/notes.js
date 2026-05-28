import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

// 双向链接正则: [[笔记标题]] 或 [[笔记标题#段落ID]]
const BI_LINK_REGEX = /\[\[([^\]]+)\]\]/g
// 块引用正则: [[笔记标题^block-id]] 或 ![[笔记标题^block-id]]
const BLOCK_REF_REGEX = /(!?)\[\[([^\]]+)\^([^\]]+)\]\]/g

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const currentNoteId = ref(null)
  const searchQuery = ref('')
  const darkMode = ref(true)

  // 计算属性：所有笔记
  const allNotes = computed(() => notes.value)

  // 当前笔记
  const currentNote = computed(() =>
    notes.value.find(n => n.id === currentNoteId.value) || null
  )

  // 搜索结果
  const searchResults = computed(() => {
    if (!searchQuery.value.trim()) return notes.value
    const q = searchQuery.value.toLowerCase()
    return notes.value.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    )
  })

  // 建立出链索引: noteId -> [targetTitle, ...]
  const outLinksMap = computed(() => {
    const map = {}
    notes.value.forEach(note => {
      const matches = [...note.content.matchAll(BI_LINK_REGEX)]
      map[note.id] = matches.map(m => m[1].split('#')[0].trim())
    })
    return map
  })

  // 计算反向链接: noteTitle -> [sourceNote, ...]
  const backlinksMap = computed(() => {
    const map = {}
    notes.value.forEach(note => {
      const outLinks = outLinksMap.value[note.id] || []
      outLinks.forEach(targetTitle => {
        if (!map[targetTitle]) map[targetTitle] = []
        map[targetTitle].push({
          id: note.id,
          title: note.title,
          preview: extractContext(note.content, `[[${targetTitle}]]`)
        })
      })
    })
    return map
  })

  // 带有链接信息的笔记列表（用于知识图谱）
  const notesWithLinks = computed(() =>
    notes.value.map(n => ({
      id: n.id,
      title: n.title,
      links: (outLinksMap.value[n.id] || []).map(title => {
        const target = notes.value.find(note => note.title === title)
        return target ? target.id : null
      }).filter(Boolean)
    }))
  )

  // 辅助函数：提取链接周围的上下文
  function extractContext(content, link) {
    const idx = content.indexOf(link)
    if (idx === -1) return ''
    const start = Math.max(0, idx - 50)
    const end = Math.min(content.length, idx + link.length + 50)
    return (start > 0 ? '...' : '') +
      content.slice(start, end).replace(/\n/g, ' ') +
      (end < content.length ? '...' : '')
  }

  // 加载笔记
  function loadNotes() {
    const saved = localStorage.getItem('notes-data')
    if (saved) {
      try {
        notes.value = JSON.parse(saved)
      } catch {
        notes.value = []
      }
    }
    if (notes.value.length === 0) {
      // 创建示例笔记
      createNote('欢迎使用 Notes', '# 欢迎使用 Notes\n\n这是一款现代化的笔记应用，支持以下特性：\n\n## 双向链接\n使用 [[]] 语法链接其他笔记，如 [[入门指南]]\n\n## 块引用\n使用 [[笔记^block-id]] 引用特定段落\n\n## 深色模式\n点击左下角设置切换主题')
    }
  }

  // 保存笔记到本地
  function saveNotes() {
    localStorage.setItem('notes-data', JSON.stringify(notes.value))
  }

  // 创建笔记
  function createNote(title = '', content = '') {
    const note = {
      id: uuidv4(),
      title: title || '新笔记',
      content: content || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: []
    }
    notes.value.unshift(note)
    currentNoteId.value = note.id
    saveNotes()
    return note
  }

  // 选择笔记
  function selectNote(note) {
    currentNoteId.value = note.id
  }

  // 按标题选择笔记
  function selectNoteByTitle(title) {
    const note = notes.value.find(n => n.title === title)
    if (note) currentNoteId.value = note.id
  }

  // 更新笔记
  function updateNote(noteId, updates) {
    const idx = notes.value.findIndex(n => n.id === noteId)
    if (idx !== -1) {
      notes.value[idx] = {
        ...notes.value[idx],
        ...updates,
        updatedAt: Date.now()
      }
      saveNotes()
    }
  }

  // 删除笔记
  function deleteNote(noteId) {
    const idx = notes.value.findIndex(n => n.id === noteId)
    if (idx !== -1) {
      notes.value.splice(idx, 1)
      if (currentNoteId.value === noteId) {
        currentNoteId.value = notes.value[0]?.id || null
      }
      saveNotes()
    }
  }

  // 获取反向链接
  function getBacklinks(noteTitle) {
    return backlinksMap.value[noteTitle] || []
  }

  return {
    notes,
    currentNoteId,
    searchQuery,
    darkMode,
    allNotes,
    currentNote,
    searchResults,
    notesWithLinks,
    loadNotes,
    createNote,
    selectNote,
    selectNoteByTitle,
    updateNote,
    deleteNote,
    getBacklinks,
    saveNotes
  }
})