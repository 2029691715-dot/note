import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

const DB_NAME = 'notes-app'
const DB_VERSION = 1
const STORE_NAME = 'notes'

// 双向链接正则
const BI_LINK_REGEX = /\[\[([^\]]+)\]\]/g
// 块引用正则
const BLOCK_REF_REGEX = /(!?)\[\[([^\]]+)\^([^\]]+)\]\]/g
// 标签正则
const TAG_REGEX = /#([^\s#]+)/g

// IndexedDB 封装
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('title', 'title', { unique: false })
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true })
      }
    }
  })
}

async function dbGetAll() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(note) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(note)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function dbDelete(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function dbGetAllAsJson() {
  return new Promise((resolve) => {
    const data = localStorage.getItem('notes-data')
    resolve(data ? JSON.parse(data) : [])
  })
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const currentNoteId = ref(null)
  const searchQuery = ref('')
  const darkMode = ref(true)
  const useIndexedDB = ref(false)

  const allNotes = computed(() => notes.value)

  const currentNote = computed(() =>
    notes.value.find(n => n.id === currentNoteId.value) || null
  )

  const searchResults = computed(() => {
    if (!searchQuery.value.trim()) return notes.value
    const q = searchQuery.value.toLowerCase()
    return notes.value.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    )
  })

  // 所有标签
  const allTags = computed(() => {
    const tagSet = new Set()
    notes.value.forEach(note => {
      const tags = note.content.match(TAG_REGEX) || []
      tags.forEach(t => tagSet.add(t.slice(1)))
    })
    return Array.from(tagSet).sort()
  })

  // 按标签筛选
  const notesByTag = computed(() => (tag) => {
    if (!tag) return notes.value
    return notes.value.filter(n =>
      n.content.includes(`#${tag}`)
    )
  })

  // 出链索引
  const outLinksMap = computed(() => {
    const map = {}
    notes.value.forEach(note => {
      const matches = [...note.content.matchAll(BI_LINK_REGEX)]
      map[note.id] = matches.map(m => m[1].split('#')[0].trim())
    })
    return map
  })

  // 反向链接
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

  // 知识图谱数据
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

  function extractContext(content, link) {
    const idx = content.indexOf(link)
    if (idx === -1) return ''
    const start = Math.max(0, idx - 50)
    const end = Math.min(content.length, idx + link.length + 50)
    return (start > 0 ? '...' : '') +
      content.slice(start, end).replace(/\n/g, ' ') +
      (end < content.length ? '...' : '')
  }

  // 加载笔记（兼容旧 localStorage + 新 IndexedDB）
  async function loadNotes() {
    try {
      if (useIndexedDB.value) {
        notes.value = await dbGetAll()
      } else {
        const saved = localStorage.getItem('notes-data')
        if (saved) {
          notes.value = JSON.parse(saved)
        }
      }
      if (notes.value.length === 0) {
        createNote('欢迎使用 Notes', `# 欢迎使用 Notes

这是一款现代化的笔记应用，支持双向链接、块引用和标签等功能。

## 双向链接
使用 [[]] 语法链接其他笔记，如 [[入门指南]]

## 标签系统
在笔记中使用 #标签 来分类，如 #学习 #笔记

## 深色模式
点击左下角设置切换主题`)
      }
    } catch (err) {
      console.error('Failed to load notes:', err)
      notes.value = []
    }
  }

  async function saveNotes() {
    try {
      if (useIndexedDB.value) {
        for (const note of notes.value) {
          await dbPut(note)
        }
      } else {
        localStorage.setItem('notes-data', JSON.stringify(notes.value))
      }
    } catch (err) {
      console.error('Failed to save notes:', err)
    }
  }

  // 迁移到 IndexedDB
  async function migrateToIndexedDB() {
    for (const note of notes.value) {
      await dbPut(note)
    }
    useIndexedDB.value = true
    localStorage.removeItem('notes-data')
  }

  // 创建笔记（带历史记录）
  function createNote(title = '', content = '') {
    const note = {
      id: uuidv4(),
      title: title || '新笔记',
      content: content || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: extractTags(content),
      history: []
    }
    notes.value.unshift(note)
    currentNoteId.value = note.id
    saveNotes()
    return note
  }

  // 提取标签
  function extractTags(content) {
    const matches = content.match(TAG_REGEX) || []
    return [...new Set(matches.map(t => t.slice(1)))]
  }

  function selectNote(note) {
    currentNoteId.value = note.id
  }

  function selectNoteByTitle(title) {
    const note = notes.value.find(n => n.title === title)
    if (note) currentNoteId.value = note.id
  }

  // 更新笔记（带历史记录）
  function updateNote(noteId, updates, skipHistory = false) {
    const idx = notes.value.findIndex(n => n.id === noteId)
    if (idx !== -1) {
      const oldNote = { ...notes.value[idx] }

      // 保存历史（最多保留20条）
      if (!skipHistory && updates.content && updates.content !== oldNote.content) {
        if (!notes.value[idx].history) notes.value[idx].history = []
        notes.value[idx].history.push({
          content: oldNote.content,
          timestamp: Date.now()
        })
        if (notes.value[idx].history.length > 20) {
          notes.value[idx].history.shift()
        }
      }

      notes.value[idx] = {
        ...oldNote,
        ...updates,
        tags: extractTags(updates.content || oldNote.content),
        updatedAt: Date.now()
      }
      saveNotes()
    }
  }

  function deleteNote(noteId) {
    const idx = notes.value.findIndex(n => n.id === noteId)
    if (idx !== -1) {
      notes.value.splice(idx, 1)
      if (currentNoteId.value === noteId) {
        currentNoteId.value = notes.value[0]?.id || null
      }
      if (useIndexedDB.value) {
        dbDelete(noteId)
      } else {
        saveNotes()
      }
    }
  }

  function getBacklinks(noteTitle) {
    return backlinksMap.value[noteTitle] || []
  }

  // 回滚到历史版本
  function rollbackToHistory(noteId, historyIndex) {
    const note = notes.value.find(n => n.id === noteId)
    if (note && note.history && note.history[historyIndex]) {
      const hist = note.history[historyIndex]
      updateNote(noteId, { content: hist.content })
      return true
    }
    return false
  }

  // 导出单个笔记为 .md
  function exportNoteAsMd(note) {
    const html = note.content
    // 简单转换 HTML 到 Markdown
    let md = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()

    return md
  }

  // 导出所有笔记为 zip
  async function exportAllAsZip() {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()

    notes.value.forEach(note => {
      const md = exportNoteAsMd(note)
      const filename = note.title.replace(/[\/\\:*?"<>|]/g, '_') + '.md'
      zip.file(filename, md)
    })

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notes-backup-${new Date().toISOString().slice(0,10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    notes,
    currentNoteId,
    searchQuery,
    darkMode,
    useIndexedDB,
    allNotes,
    currentNote,
    searchResults,
    allTags,
    notesByTag,
    notesWithLinks,
    loadNotes,
    createNote,
    selectNote,
    selectNoteByTitle,
    updateNote,
    deleteNote,
    getBacklinks,
    saveNotes,
    migrateToIndexedDB,
    rollbackToHistory,
    exportNoteAsMd,
    exportAllAsZip
  }
})