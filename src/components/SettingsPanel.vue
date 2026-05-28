<script setup>
import { useNotesStore } from '../stores/notes'

const emit = defineEmits(['close'])
const store = useNotesStore()

function exportData() {
  const data = JSON.stringify(store.allNotes, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'notes-backup.json'
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result)
        if (Array.isArray(data)) {
          localStorage.setItem('notes-data', JSON.stringify(data))
          store.loadNotes()
        }
      } catch (err) {
        alert('导入失败：文件格式错误')
      }
    }
    reader.readAsText(file)
  }
  input.click()
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
        <h4>数据</h4>
        <div class="setting-item">
          <span>笔记数量</span>
          <span>{{ store.allNotes.length }}</span>
        </div>
        <div class="setting-item">
          <span>导出笔记</span>
          <button class="btn-secondary" @click="exportData">导出 JSON</button>
        </div>
        <div class="setting-item">
          <span>导入笔记</span>
          <button class="btn-secondary" @click="importData">导入 JSON</button>
        </div>
      </div>

      <div class="settings-section">
        <h4>关于</h4>
        <div class="setting-item">
          <span>版本</span>
          <span>1.0.0</span>
        </div>
        <div class="setting-item">
          <span>基于</span>
          <span>Tiptap + Vue 3</span>
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
  width: 400px;
  max-height: 80vh;
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