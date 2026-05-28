# Notes - 现代化笔记应用

基于设计文档构建的现代化笔记应用，支持双向链接和块引用功能。

## 核心功能

### 双向链接 (Bidirectional Links)
- 使用 `[[笔记标题]]` 语法链接其他笔记
- 自动计算反向链接（Backlinks）
- 支持知识图谱可视化

### 块引用 (Block Reference)
- 使用 `[[笔记标题^block-id]]` 引用特定段落
- 支持嵌入同步模式

### 编辑器
- 基于 Tiptap 的富文本编辑
- 支持 Markdown 语法
- 所见即所得渲染

### 数据存储
- 本地 IndexedDB/localStorage 存储
- 自动保存（防抖 1.5 秒）
- 支持导入/导出 JSON

## 技术栈

- **前端框架**: Vue 3 + Pinia
- **编辑器**: Tiptap 2.x
- **构建工具**: Vite 5
- **可选桌面端**: Tauri 2.x

## 运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 项目结构

```
notes-app/
├── index.html          # 入口 HTML
├── package.json        # 依赖配置
├── vite.config.js      # Vite 配置
└── src/
    ├── main.js         # 入口文件
    ├── App.vue         # 主应用组件
    ├── stores/
    │   └── notes.js    # Pinia 状态管理
    └── components/
        ├── SidebarNav.vue      # 左侧导航
        ├── FileList.vue        # 中间文件列表
        ├── EditorArea.vue     # 主编辑区
        ├── SettingsPanel.vue  # 设置面板
        └── GraphView.vue      # 知识图谱
```

## 快捷键

- `Ctrl+N` - 新建笔记
- `Ctrl+S` - 手动保存
- `[[` - 插入双向链接

## 设计参考

本应用按照 `E:\newnode\新建 DOC 文档.doc` 中的设计文档构建，完整实现：
1. 核心功能设计（三栏布局、Markdown 支持、双向链接）
2. 界面与布局设计（导航栏 + 文件列表 + 主编辑区）
3. 视觉与交互体验（深色模式、自动保存）
4. 数据安全（本地存储、导出功能）