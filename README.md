# 拾遗录 · 个人博客

一个可以直接部署到 GitHub Pages 的个人博客。前台是纯静态页面，随时浏览；后台可以登录后在线写作、上传图片、发布文章，所有内容以文件形式存放在你自己的 GitHub 仓库里，无需额外服务器或数据库。

## 文件结构

```text
index.html        页面入口
styles.css        全部样式（深浅色双主题）
markdown.js       Markdown 渲染、代码高亮、双模式转换
app.js            前台浏览（首页/文章/归档/搜索/评论/统计）
admin.js          管理后台（登录/编辑器/图片/GitHub 同步）
content/site.json 站点信息与设置
content/posts.json 文章列表
content/posts/    每篇文章一个 Markdown 文件
images/           文章图片（上传时自动创建）
```

## 一、部署到 GitHub Pages

1. 在 GitHub 上新建一个公开仓库（例如 `blog`），把整个文件夹推上去：

   ```bash
   git init
   git add .
   git commit -m "init blog"
   git branch -M main
   git remote add origin https://github.com/你的用户名/blog.git
   git push -u origin main
   ```

2. 打开仓库的 Settings → Pages，在「Build and deployment」里选择 `Deploy from a branch`，分支选 `main`、目录选 `/ (root)`，保存。

3. 等一两分钟，打开 `https://你的用户名.github.io/blog/` 就能看到博客了。

## 二、开启管理后台

1. 在 GitHub 创建访问令牌：
   - 右上角头像 → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token；
   - 在 Repository access 里只选择你的博客仓库；
   - Permissions 里给 Contents 选择 `Read and write`；
   - 生成后复制令牌（只显示一次）。

2. 打开博客，点击右上角「管理」，完成首次设置：
   - 填 GitHub 用户名、仓库名和令牌；
   - 设置管理员密码。

3. 之后每次进入「管理」输入密码即可写作。换设备时，需要在新设备的「管理」页重新填写令牌与密码。

> 安全提示：令牌保存在当前浏览器的本地存储中，仅用于向你的仓库提交内容。建议使用权限受限的 Fine-grained 令牌，只授权这一个仓库。

## 三、写作与图片

- 编辑页支持 Markdown 和可视化两种模式，可随时切换；
- 图片支持本地上传、粘贴截图（Ctrl+V）、拖拽三种方式，会自动压缩后存入仓库的 `images/` 目录；
- 「保存草稿」不对外可见，「发布」后立即出现在首页；
- 删除文章会同时删除正文文件和列表记录，无法恢复，请谨慎操作。

## 四、可选功能

### 评论（Giscus）

1. 在仓库 Settings → Discussions 里开启 Discussions；
2. 打开 [giscus.app](https://giscus.app)，按提示选择仓库并生成配置；
3. 在管理后台的「站点设置」里粘贴仓库、repoId、分类、categoryId 四项，并勾选开启。

### 访问统计（GoatCounter）

1. 到 [goatcounter.com](https://www.goatcounter.com) 免费注册一个站点；
2. 把站点 ID 填进「站点设置」并勾选开启。

## 五、本地预览

在项目目录运行一个静态服务器（直接双击打开 HTML 无法读取本地 JSON 文件）：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 六、常见问题

**内容存在哪？** 全部存在你的 GitHub 仓库里：文章是 `content/posts/` 下的 Markdown 文件，列表是 `content/posts.json`，图片是 `images/` 下的文件。每次发布就是一次 Git 提交，历史可追溯。

**GitHub 接口报「频率超限」？** 免费额度每小时 5000 次调用，个人博客很难用完；如果遇到，等一小时即可。前台浏览走的是 Pages 静态文件，不受影响。

**想换博客名称？** 管理后台 → 站点设置，修改「博客名称」保存即可。
