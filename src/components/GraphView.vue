<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  notes: Array
})

const emit = defineEmits(['close', 'navigate'])

const canvas = ref(null)
let ctx = null
let animationId = null

// 节点位置
const nodes = ref([])
const edges = ref([])

// 拖拽状态
let dragging = null
let dragOffset = { x: 0, y: 0 }

// 初始化
onMounted(() => {
  initCanvas()
  initGraph()
  animate()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
})

function initCanvas() {
  const c = canvas.value
  ctx = c.getContext('2d')
  resizeCanvas()
}

function resizeCanvas() {
  canvas.value.width = window.innerWidth
  canvas.value.height = window.innerHeight
}

function handleResize() {
  resizeCanvas()
}

function initGraph() {
  const w = canvas.value.width
  const h = canvas.value.height
  const centerX = w / 2
  const centerY = h / 2
  const radius = Math.min(w, h) * 0.35

  // 为每个节点分配位置（圆形布局）
  props.notes.forEach((note, i) => {
    const angle = (2 * Math.PI * i) / props.notes.length - Math.PI / 2
    nodes.value.push({
      id: note.id,
      title: note.title,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
      radius: 30 + Math.min(note.title.length * 1.5, 25)
    })
  })

  // 建立边
  props.notes.forEach(note => {
    note.links?.forEach(targetId => {
      edges.value.push({ source: note.id, target: targetId })
    })
  })
}

function animate() {
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // 力学模拟
  simulateForces()

  // 绘制
  drawEdges()
  drawNodes()

  animationId = requestAnimationFrame(animate)
}

function simulateForces() {
  const w = canvas.value.width
  const h = canvas.value.height
  const centerX = w / 2
  const centerY = h / 2

  nodes.value.forEach(node => {
    // 向心力
    const dx = centerX - node.x
    const dy = centerY - node.y
    node.vx += dx * 0.001
    node.vy += dy * 0.001

    // 节点间排斥力
    nodes.value.forEach(other => {
      if (other.id === node.id) return
      const dx = node.x - other.x
      const dy = node.y - other.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = 2000 / (dist * dist)
      node.vx += (dx / dist) * force
      node.vy += (dy / dist) * force
    })
  })

  // 边的拉力
  edges.value.forEach(edge => {
    const source = nodes.value.find(n => n.id === edge.source)
    const target = nodes.value.find(n => n.id === edge.target)
    if (!source || !target) return

    const dx = target.x - source.x
    const dy = target.y - source.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const idealDist = 150
    const force = (dist - idealDist) * 0.01

    source.vx += (dx / dist) * force
    source.vy += (dy / dist) * force
    target.vx -= (dx / dist) * force
    target.vy -= (dy / dist) * force
  })

  // 应用速度
  nodes.value.forEach(node => {
    if (dragging && dragging.id === node.id) return
    node.x += node.vx * 0.5
    node.y += node.vy * 0.5
    node.vx *= 0.9
    node.vy *= 0.9

    // 边界约束
    node.x = Math.max(50, Math.min(w - 50, node.x))
    node.y = Math.max(50, Math.min(h - 50, node.y))
  })
}

function drawEdges() {
  ctx.strokeStyle = 'rgba(233, 69, 96, 0.3)'
  ctx.lineWidth = 1.5

  edges.value.forEach(edge => {
    const source = nodes.value.find(n => n.id === edge.source)
    const target = nodes.value.find(n => n.id === edge.target)
    if (!source || !target) return

    ctx.beginPath()
    ctx.moveTo(source.x, source.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()
  })
}

function drawNodes() {
  nodes.value.forEach(node => {
    // 节点圆
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
    ctx.fillStyle = dragging?.id === node.id ? '#e94560' : '#2a2a4a'
    ctx.fill()

    // 边框
    ctx.strokeStyle = '#e94560'
    ctx.lineWidth = 2
    ctx.stroke()

    // 文字
    ctx.fillStyle = '#eaeaea'
    ctx.font = '12px Segoe UI'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const title = node.title.length > 12 ? node.title.slice(0, 10) + '...' : node.title
    ctx.fillText(title, node.x, node.y)
  })
}

// 鼠标交互
function handleMouseDown(e) {
  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const hit = nodes.value.find(node => {
    const dx = x - node.x
    const dy = y - node.y
    return dx * dx + dy * dy < node.radius * node.radius
  })

  if (hit) {
    dragging = hit
    dragOffset = { x: x - hit.x, y: y - hit.y }
  }
}

function handleMouseMove(e) {
  if (!dragging) return
  const rect = canvas.value.getBoundingClientRect()
  dragging.x = e.clientX - rect.left - dragOffset.x
  dragging.y = e.clientY - rect.top - dragOffset.y
  dragging.vx = 0
  dragging.vy = 0
}

function handleMouseUp() {
  dragging = null
}

function handleClick(e) {
  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const hit = nodes.value.find(node => {
    const dx = x - node.x
    const dy = y - node.y
    return dx * dx + dy * dy < node.radius * node.radius
  })

  if (hit) {
    emit('navigate', hit.title)
  }
}
</script>

<template>
  <div class="graph-overlay">
    <canvas
      ref="canvas"
      class="graph-canvas"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @click="handleClick"
    ></canvas>
    <button class="graph-close" @click="$emit('close')">关闭图谱</button>
  </div>
</template>

<style scoped>
.graph-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary);
  z-index: 100;
}

.graph-canvas {
  width: 100%;
  height: 100%;
  cursor: grab;
}

.graph-canvas:active {
  cursor: grabbing;
}

.graph-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: var(--bg-secondary);
  border: none;
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.graph-close:hover {
  background: var(--accent);
}
</style>