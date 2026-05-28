<script setup>
import { useNotesStore } from '../stores/notes'

const emit = defineEmits(['close'])
const store = useNotesStore()

async function exportMdZip() {
  try {
    await store.exportAllAsZip()
  } catch (err) {
    alert('导出失败: ' + err.message)
  }
}

function exportJson() {
  const data = JSON.stringify(store.allNotes, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `notes-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importJson() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result)
        if (Array.isArray(data)) {
          if (store.useIndexedDB) {
            for (const note of data) {
              await store.notes.push(note)
            }
          } else {
            localStorage.setItem('notes-data', JSON.stringify(data))
          }
          await store.loadNotes()
        }
      } catch (err) {
        alert('导入失败：文件格式错误')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

async function migrateToIDB() {
  if (confirm('是否将数据迁移到 IndexedDB？这可以支持更大的数据量。')) {
    await store.migrateToIndexedDB()
    alert('迁移完成！')
  }
}
</script>

<template>
  <div class="settings-overlay" @click.self="$emit('close')">
    <div class="settings-panel">
      <h2 class="settings-title">设置</h2>

      <div class="settings-section">
        <h4>外观</h4>
        <div class="setting-item">
          <span>深色模式</span>
          <div
            class="toggle-switch"
            :class="{ active: store.darkMode }"
            @click="store.darkMode = !store.darkMode"
          ></div>
        </div>
      </div>

      <div class="settings-section">
        <h4>导出</h4>
        <div class="setting-item">
          <span>笔记数量</span>
          <span class="setting-value">{{ store.allNotes.length }}</span>
        </div>
        <div class="setting-item">
          <span>导出为 Markdown</span>
          <button class="btn-secondary" @click="exportMdZip">导出 .zip</button>
        </div>
        <div class="setting-item">
          <span>导出为 JSON</span>
          <button class="btn-secondary" @click="exportJson">导出 .json</button>
        </div>
        <div class="setting-item">
          <span>导入 JSON</span>
          <button class="btn-secondary" @click="importJson">导入</button>
        </div>
      </div>

      <div class="settings-section">
        <h4>存储</h4>
        <div class="setting-item">
          <span>存储方式</span>
          <span class="setting-value">{{ store.useIndexedDB ? 'IndexedDB' : 'localStorage' }}</span>
        </div>
        <div class="setting-item">
          <span>迁移到 IndexedDB</span>
          <button class="btn-secondary" @click="migrateToIDB">迁移</button>
        </div>
      </div>

      <div class="settings-section">
        <h4>关于</h4>
        <div class="setting-item">
          <span>版本</span>
          <span class="setting-value">1.1.0</span>
        </div>
        <div class="setting-item">
          <span>基于</span>
          <span class="setting-value">Vue 3 + Tiptap</span>
        </div>
      </div>

      <div class="shortcuts-section">
        <h4>快捷键</h4>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd>+<kbd>N</kbd>
          <span>新建笔记</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd>+<kbd>S</kbd>
          <span>保存笔记</span>
        </div>
        <div class="shortcut-item">
          <kbd>Ctrl</kbd>+<kbd>K</kbd>
          <span>插入链接</span>
        </div>
        <div class="shortcut-item">
          <kbd>[[</kbd>
          <span>输入时自动补全</span>
        </div>
        <div class="shortcut-item">
          <kbd>#标签</kbd>
          <span>添加标签</span>
        </div>
      </div>

      <button class="btn-primary close-btn" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.settings-panel {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  width: 420px;
  max-height: 85vh;
  overflow-y: auto;
}

.settings-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h4 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-value {
  font-size: 13px;
  color: var(--text-secondary);
}

.toggle-switch {
  width: 48px;
  height: 24px;
  background: var(--border);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-switch.active {
  background: var(--accent);
}

.toggle-switch::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
}

.toggle-switch.active::after {
  transform: translateX(24px);
}

.btn-secondary {
  padding: 6px 12px;
  background: var(--border);
  border: none;
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--accent);
}

.shortcuts-section {
  margin-bottom: 24px;
}

.shortcuts-section h4 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.shortcut-item span {
  font-size: 13px;
  color: var(--text-primary);
}

kbd {
  background: var(--bg-primary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid var(--border);
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin-top: 16px;
}

.btn-primary:hover {
  background: var(--accent-hover);
}
</style>