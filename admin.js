/* admin.js
   管理后台：登录、文章管理、双模式编辑器、图片上传、GitHub 仓库同步。
   数据以文件形式存放在博客仓库中（content/ 与 images/），
   通过 GitHub Contents API 读写，无需额外服务器。 */
(function () {
  "use strict";

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const API = "https://api.github.com";
  const CFG_KEY = "blog_gh_config";
  const SESSION_KEY = "blog_admin_session";
  const CACHE_KEY = "blog_cache_v1";

  const DEFAULT_SITE = {
    title: "拾遗录",
    subtitle: "学习笔记、技术教程与生活随笔",
    author: "",
    description: "个人博客，记录学习笔记、技术教程与生活随笔。",
    footer: "记录、整理、分享",
    about: "欢迎来到我的博客。",
    passwordHash: "",
    passwordSalt: "",
    giscus: { enabled: false, repo: "", repoId: "", category: "", categoryId: "" },
    goatcounter: { enabled: false, site: "" }
  };

  const editorState = { id: null, mode: "md", mdDirty: false, wysDirty: false, busy: false };

  /* ---------------- 工具函数 ---------------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function randomSalt() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function b64decode(b64) {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }

  function sha256(str) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const textBytes = new TextEncoder().encode(str);
    const bitLenHi = Math.floor((textBytes.length * 8) / 0x100000000);
    const bitLenLo = (textBytes.length * 8) >>> 0;
    const paddedLen = (((textBytes.length + 8) >> 6) + 1) * 64;
    const bytes = new Uint8Array(paddedLen);
    bytes.set(textBytes);
    bytes[textBytes.length] = 0x80;
    const view = new DataView(bytes.buffer);
    view.setUint32(paddedLen - 8, bitLenHi);
    view.setUint32(paddedLen - 4, bitLenLo);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let off = 0; off < paddedLen; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map((x) => (x >>> 0).toString(16).padStart(8, "0"))
      .join("");
  }

  function hashPassword(pw, salt) {
    return sha256((salt || "") + ":" + pw);
  }

  async function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function fileToDataUrl(file, maxDim, quality) {
    if (!file || !file.type || !file.type.startsWith("image/")) return null;
    if (file.type === "image/gif" || file.type === "image/svg+xml") return readFileAsDataURL(file);
    const original = await readFileAsDataURL(file);
    const img = await loadImage(original);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale >= 1 && file.size < 400 * 1024) return original;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return file.type === "image/png"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", quality);
  }

  function insertAtCursor(ta, text) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* ---------------- GitHub API ---------------- */

  const Admin = {
    route(parts) {
      const sub = (parts[1] || "").toLowerCase();
      if (sub === "edit" && parts[2]) {
        this.renderEditor(parts[2]);
        return;
      }
      if (sub === "settings") {
        this.renderSettings();
        return;
      }
      if (sub === "logout") {
        this.logout();
        return;
      }
      this.renderGate();
    },

    getConfig() {
      try {
        return JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
      } catch (e) {
        return {};
      }
    },

    setConfig(cfg) {
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    },

    isSession() {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    },

    setSession(on) {
      if (on) sessionStorage.setItem(SESSION_KEY, "1");
      else sessionStorage.removeItem(SESSION_KEY);
    },

    logout() {
      this.setSession(false);
      showToast("已退出管理");
      location.hash = "#/admin";
    },

    async gh(path, opts) {
      opts = opts || {};
      const cfg = this.getConfig();
      if (!cfg.token || !cfg.owner || !cfg.repo) {
        throw new Error("还没有配置 GitHub 仓库连接，请先完成首次设置");
      }
      const headers = {
        Authorization: "Bearer " + cfg.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      };
      let res;
      try {
        res = await fetch(
          API +
            "/repos/" +
            encodeURIComponent(cfg.owner) +
            "/" +
            encodeURIComponent(cfg.repo) +
            "/contents/" +
            path,
          {
            method: opts.method || "GET",
            headers,
            body: opts.body ? JSON.stringify(opts.body) : undefined
          }
        );
      } catch (e) {
        throw new Error("无法连接 GitHub，请检查网络");
      }
      if (!res.ok) {
        let msg = "请求失败（" + res.status + "）";
        try {
          const j = await res.json();
          if (j && j.message) msg = j.message;
        } catch (e) {}
        if (res.status === 401) msg = "访问令牌无效或已过期，请在设置里重新填写";
        if (res.status === 403 && /rate limit/i.test(msg)) {
          msg = "GitHub 接口调用频率超限，请稍后再试（一小时后自动恢复）";
        }
        if (res.status === 404) msg = "文件不存在（" + path + "）";
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      if (res.status === 204) return null;
      return res.json();
    },

    async loadPostsFromRepo() {
      const j = await this.gh("content/posts.json");
      const posts = JSON.parse(b64decode(j.content));
      return Array.isArray(posts.posts) ? posts.posts : [];
    },

    async loadSiteFromRepo() {
      const j = await this.gh("content/site.json");
      return Object.assign({}, DEFAULT_SITE, JSON.parse(b64decode(j.content)));
    },

    async loadBodyFromRepo(id) {
      const j = await this.gh("content/posts/" + id + ".md");
      return b64decode(j.content);
    },

    async saveFile(path, content, message) {
      let sha = null;
      try {
        sha = (await this.gh(path)).sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      const body = { message, content: b64encode(content) };
      if (sha) body.sha = sha;
      await this.gh(path, { method: "PUT", body });
    },

    async saveBinary(path, b64, message) {
      let sha = null;
      try {
        sha = (await this.gh(path)).sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      const body = { message, content: b64 };
      if (sha) body.sha = sha;
      await this.gh(path, { method: "PUT", body });
    },

    async deleteFile(path, message) {
      let existing = null;
      try {
        existing = await this.gh(path);
      } catch (e) {
        if (e.status === 404) return;
        throw e;
      }
      await this.gh(path, { method: "DELETE", body: { message, sha: existing.sha } });
    },

    /* ---------------- 登录 / 首次设置 ---------------- */

    async renderGate() {
      const cfg = this.getConfig();
      let site = null;
      if (cfg.token && cfg.owner && cfg.repo) {
        try {
          site = await this.loadSiteFromRepo();
        } catch (e) {
          site = window.App && App.site ? App.site : null;
        }
      } else if (window.App && App.site) {
        site = App.site;
      }

      if (this.isSession()) {
        this.renderDashboard();
        return;
      }
      if (site && site.passwordHash && cfg.token && cfg.owner && cfg.repo) {
        this.renderLogin(site);
        return;
      }
      this.renderSetup(site);
    },

    renderLogin(site) {
      const title = (site && site.title) || "拾遗录";
      App.renderApp(
        '<div class="admin-shell"><div class="wrap">' +
          '<div class="gate-card"><h2>管理登录</h2>' +
          "<p>" + esc(title) + " · 请输入管理员密码</p>" +
          '<form id="loginForm">' +
          '<div class="field"><label for="loginPassword">密码</label>' +
          '<input type="password" id="loginPassword" autocomplete="current-password" required /></div>' +
          '<button type="submit" class="btn btn-primary" id="loginBtn">登录</button>' +
          "</form>" +
          '<p class="gate-link"><a href="#/admin/setup">需要重新配置连接？</a></p>' +
          "</div></div></div>"
      );
      const form = $("#loginForm");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("#loginBtn");
        const pw = $("#loginPassword").value;
        if (!site || !site.passwordHash || hashPassword(pw, site.passwordSalt) !== site.passwordHash) {
          showToast("密码错误");
          return;
        }
        btn.disabled = true;
        btn.textContent = "登录中…";
        this.setSession(true);
        showToast("欢迎回来");
        location.hash = "#/admin";
      });
      setTimeout(() => $("#loginPassword").focus(), 50);
    },

    renderSetup(site) {
      const cfg = this.getConfig();
      const hasPassword = !!(site && site.passwordHash);
      App.renderApp(
        '<div class="admin-shell"><div class="wrap">' +
          '<div class="gate-card"><h2>首次设置</h2>' +
          "<p>把博客与你的 GitHub 仓库连接起来。访问令牌只保存在当前浏览器的本地存储中，不会上传到其他任何地方。</p>" +
          '<form id="setupForm">' +
          '<div class="form-row">' +
          '<div class="field"><label for="sOwner">GitHub 用户名</label>' +
          '<input type="text" id="sOwner" value="' + esc(cfg.owner || "") + '" autocomplete="off" required /></div>' +
          '<div class="field"><label for="sRepo">仓库名</label>' +
          '<input type="text" id="sRepo" value="' + esc(cfg.repo || "") + '" autocomplete="off" required /></div>' +
          "</div>" +
          '<div class="field"><label for="sToken">访问令牌（Token）</label>' +
          '<input type="password" id="sToken" value="' + esc(cfg.token || "") + '" autocomplete="off" required />' +
          '<p class="field-hint">在 GitHub 设置中创建，权限选择「Contents: Read and write」，仅限本仓库。</p></div>' +
          (hasPassword
            ? '<div class="field"><label for="sCur">当前管理员密码</label>' +
              '<input type="password" id="sCur" autocomplete="current-password" required /></div>'
            : "") +
          '<div class="form-row">' +
          '<div class="field"><label for="sPw">' + (hasPassword ? "新密码（留空则不修改）" : "设置管理员密码") + "</label>" +
          '<input type="password" id="sPw" autocomplete="new-password"' + (hasPassword ? "" : " required") + " /></div>" +
          '<div class="field"><label for="sPw2">确认密码</label>' +
          '<input type="password" id="sPw2" autocomplete="new-password"' + (hasPassword ? "" : " required") + " /></div>" +
          "</div>" +
          '<button type="submit" class="btn btn-primary" id="setupBtn">保存并进入管理</button>' +
          "</form></div></div></div>"
      );
      const form = $("#setupForm");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("#setupBtn");
        const owner = $("#sOwner").value.trim();
        const repo = $("#sRepo").value.trim();
        const token = $("#sToken").value.trim();
        const cur = $("#sCur") ? $("#sCur").value : "";
        const pw = $("#sPw").value;
        const pw2 = $("#sPw2").value;
        if (!owner || !repo || !token) {
          showToast("请填写完整的仓库信息");
          return;
        }
        if (pw !== pw2) {
          showToast("两次输入的密码不一致");
          return;
        }
        btn.disabled = true;
        btn.textContent = "连接中…";
        try {
          this.setConfig({ owner, repo, token });
          let siteObj = null;
          try {
            siteObj = await this.loadSiteFromRepo();
          } catch (err) {
            siteObj = Object.assign({}, DEFAULT_SITE, window.App && App.site ? App.site : {});
          }
          if (siteObj.passwordHash) {
            if (!cur || hashPassword(cur, siteObj.passwordSalt) !== siteObj.passwordHash) {
              showToast("当前密码不正确");
              btn.disabled = false;
              btn.textContent = "保存并进入管理";
              return;
            }
          }
          if (pw) {
            siteObj.passwordSalt = randomSalt();
            siteObj.passwordHash = hashPassword(pw, siteObj.passwordSalt);
          }
          await this.saveFile("content/site.json", JSON.stringify(siteObj, null, 2), "更新站点设置");
          if (window.App) {
            App.site = siteObj;
            App.applyChrome();
            localStorage.removeItem(CACHE_KEY);
          }
          this.setSession(true);
          showToast("设置已保存");
          location.hash = "#/admin";
        } catch (err) {
          showToast("连接失败：" + err.message);
          btn.disabled = false;
          btn.textContent = "保存并进入管理";
        }
      });
    },

    /* ---------------- 管理首页 ---------------- */

    async renderDashboard() {
      App.renderApp(
        '<div class="admin-shell"><div class="wrap">' +
          '<div class="admin-head"><div><h1>文章管理</h1>' +
          '<p id="dashConn"></p></div>' +
          '<div class="admin-actions">' +
          '<a class="btn" href="#/admin/settings">站点设置</a>' +
          '<a class="btn btn-primary" href="#/admin/edit/new">新建文章</a>' +
          '<button type="button" class="btn" id="dashLogout">退出</button>' +
          "</div></div>" +
          '<div class="stat-grid" id="statGrid"></div>' +
          '<div class="admin-posts" id="dashPosts"></div>' +
          "</div></div>"
      );
      $("#dashLogout").addEventListener("click", () => this.logout());
      const cfg = this.getConfig();
      $("#dashConn").textContent = cfg.owner + "/" + cfg.repo;
      const box = $("#dashPosts");
      box.innerHTML =
        '<div class="skeleton"><div class="skeleton-line w85"></div><div class="skeleton-line w60"></div></div>';
      try {
        const posts = await this.loadPostsFromRepo();
        const published = posts.filter((p) => p.status === "published").length;
        const drafts = posts.filter((p) => p.status !== "published").length;
        const cats = new Set(posts.map((p) => p.category).filter(Boolean)).size;
        $("#statGrid").innerHTML =
          statBox(posts.length, "全部文章") + statBox(published, "已发布") + statBox(drafts, "草稿");
        if (!posts.length) {
          box.innerHTML =
            '<div class="empty-state"><h2>还没有文章</h2><p>点击右上角「新建文章」，写下第一篇吧。</p></div>';
          return;
        }
        posts
          .slice()
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .forEach((p) => {
            const row = document.createElement("div");
            row.className = "admin-post";
            const statusCls = p.status === "published" ? "badge-published" : "badge-draft";
            const statusText = p.status === "published" ? "已发布" : "草稿";
            row.innerHTML =
              '<div><p class="ap-title"><a href="#/admin/edit/' + esc(p.id) + '">' + esc(p.title) + "</a></p>" +
              '<p class="ap-meta">' + esc(p.category || "未分类") + " · " + esc(p.date) + "</p></div>" +
              '<div><span class="badge ' + statusCls + '">' + statusText + "</span></div>" +
              '<div class="ap-actions">' +
              '<a class="btn btn-sm btn-primary" href="#/admin/edit/' + esc(p.id) + '">编辑</a>' +
              '<a class="btn btn-sm" target="_blank" rel="noopener" href="#/post/' + encodeURIComponent(p.slug || p.id) + '">预览</a>' +
              '<button type="button" class="btn btn-sm btn-danger" data-del="' + esc(p.id) + '">删除</button>' +
              "</div>";
            box.appendChild(row);
          });
        $$("[data-del]", box).forEach((b) =>
          b.addEventListener("click", () => this.deletePost(b.dataset.del))
        );
      } catch (e) {
        box.innerHTML = '<div class="error-state"><h2>无法读取文章列表</h2><p>' + esc(e.message) + "</p></div>";
      }
    },

    async deletePost(id) {
      if (!confirm("确定删除这篇文章？删除后无法恢复。")) return;
      try {
        await this.deleteFile("content/posts/" + id + ".md", "删除文章: " + id);
        const posts = (await this.loadPostsFromRepo()).filter((p) => p.id !== id && p.slug !== id);
        await this.saveFile(
          "content/posts.json",
          JSON.stringify({ posts }, null, 2),
          "删除文章: " + id
        );
        localStorage.removeItem(CACHE_KEY);
        if (window.App) App.bodies = {};
        showToast("文章已删除");
        location.hash = "#/admin";
      } catch (e) {
        showToast("删除失败：" + e.message);
      }
    },

    /* ---------------- 编辑器 ---------------- */

    async renderEditor(id) {
      editorState.id = id === "new" ? null : id;
      editorState.mode = "md";
      editorState.mdDirty = false;
      editorState.wysDirty = false;

      let post = null;
      let body = "";
      let allPosts = [];

      App.renderApp(
        '<div class="admin-shell editor-shell"><div class="wrap">' +
          '<div class="editor-bar">' +
          '<span class="eb-status" id="ebStatus">' + (editorState.id ? "编辑文章" : "新建文章") + "</span>" +
          '<div class="eb-actions">' +
          '<button type="button" class="btn" id="ebImport">导入 MD</button>' +
          '<button type="button" class="btn" id="ebPreview">预览</button>' +
          '<button type="button" class="btn" id="ebDraft">保存草稿</button>' +
          '<button type="button" class="btn btn-primary" id="ebPublish">发布</button>' +
          "</div></div>" +
          '<div class="editor-grid">' +
          '<aside class="editor-side">' +
          '<div class="crawl-help">' +
          '<p class="crawl-help-title">网页抓取命令</p>' +
          '<p class="crawl-help-tip">在电脑终端运行，抓取后自动推成草稿：</p>' +
          '<div class="crawl-cmd">' +
          '<code id="crawlCmd">python D:\\blog\\crawler.py --draft https://网址</code>' +
          '<button type="button" class="btn btn-sm" id="copyCrawlCmd">复制</button>' +
          "</div>" +
          "</div>" +
          '<div class="field"><label for="postTitle">标题</label><input type="text" id="postTitle" placeholder="文章标题" /></div>' +
          '<div class="field"><label for="postCategory">分类</label><input type="text" id="postCategory" list="catList" placeholder="如：笔记 / 教程 / 随笔" /></div>' +
          '<datalist id="catList"></datalist>' +
          '<div class="field"><label for="postTags">标签</label><input type="text" id="postTags" placeholder="逗号分隔，如：数据结构, 笔记" /></div>' +
          '<div class="field"><label for="postDate">日期</label><input type="date" id="postDate" /></div>' +
          '<div class="field"><label for="postExcerpt">摘要（留空自动生成）</label><textarea id="postExcerpt" rows="3"></textarea></div>' +
          "</aside>" +
          '<div class="editor-main">' +
          '<div class="tabs">' +
          '<button type="button" class="active" data-tab="md">Markdown</button>' +
          '<button type="button" data-tab="wys">可视化</button>' +
          "</div>" +
          '<div class="tab-panel">' +
          '<div class="drop-hint" id="dropHint">支持上传本地图片、粘贴截图（Ctrl+V）或直接拖拽图片到此处</div>' +
          '<div class="md-split" id="mdPanel">' +
          '<textarea id="mdBody" placeholder="# 标题&#10;&#10;开始写作…" spellcheck="false"></textarea>' +
          '<div class="md-preview" id="mdPreview"></div>' +
          "</div>" +
          '<div id="wysPanel" style="display:none">' +
          '<div class="wys-toolbar" id="wysToolbar">' +
          '<button type="button" data-cmd="bold" title="加粗">B</button>' +
          '<button type="button" data-cmd="italic" title="斜体"><i>I</i></button>' +
          '<button type="button" data-cmd="strikeThrough" title="删除线">S</button>' +
          '<span class="sep"></span>' +
          '<button type="button" data-cmd="h2" title="二级标题">H2</button>' +
          '<button type="button" data-cmd="h3" title="三级标题">H3</button>' +
          '<button type="button" data-cmd="p" title="正文">正文</button>' +
          '<span class="sep"></span>' +
          '<button type="button" data-cmd="insertUnorderedList" title="无序列表">• 列表</button>' +
          '<button type="button" data-cmd="insertOrderedList" title="有序列表">1. 列表</button>' +
          '<button type="button" data-cmd="formatBlock-quote" title="引用">引用</button>' +
          '<span class="sep"></span>' +
          '<button type="button" data-cmd="createLink" title="链接">链接</button>' +
          '<button type="button" data-cmd="image" title="插入图片">图片</button>' +
          '<button type="button" data-cmd="code" title="代码块">&lt;/&gt;</button>' +
          '<button type="button" data-cmd="hr" title="分割线">—</button>' +
          "</div>" +
          '<div id="wysBody" contenteditable="true" spellcheck="false"></div>' +
          "</div>" +
          "</div>" +
          "</div></div></div></div>" +
          '<input type="file" id="editorImageInput" accept="image/*" multiple style="display:none" />'
          +
          '<input type="file" id="mdImportInput" accept=".md,.txt,.markdown,text/markdown,text/plain" style="display:none" />'
      );

      try {
        if (editorState.id) {
          allPosts = await this.loadPostsFromRepo();
          post = allPosts.find((p) => p.id === editorState.id || p.slug === editorState.id);
          if (!post) {
            showToast("文章不存在");
            location.hash = "#/admin";
            return;
          }
          try {
            body = await this.loadBodyFromRepo(post.id);
          } catch (e) {
            try {
              const res = await fetch("content/posts/" + post.id + ".md", { cache: "no-cache" });
              if (res.ok) body = await res.text();
            } catch (e2) {}
          }
        } else {
          allPosts = await this.loadPostsFromRepo().catch(() => []);
        }
      } catch (e) {
        showToast("读取失败：" + e.message);
      }

      const cats = Array.from(new Set(allPosts.map((p) => p.category).filter(Boolean))).sort();
      $("#catList").innerHTML = cats.map((c) => "<option value=\"" + esc(c) + '"></option>').join("");
      $("#postTitle").value = post ? post.title : "";
      $("#postCategory").value = post ? post.category || "" : "";
      $("#postTags").value = post && post.tags ? post.tags.join(", ") : "";
      $("#postDate").value = post ? post.date : today();
      $("#postExcerpt").value = post && post.excerpt ? post.excerpt : "";
      $("#mdBody").value = body;
      this.renderMdPreview();

      this.bindEditor();
    },

    bindEditor() {
      const mdTa = $("#mdBody");
      const wys = $("#wysBody");
      const mdPanel = $("#mdPanel");
      const wysPanel = $("#wysPanel");

      $$(".tabs button").forEach((b) =>
        b.addEventListener("click", () => {
          const mode = b.dataset.tab;
          $$(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
          if (mode === "md") {
            if (editorState.wysDirty) {
              mdTa.value = Markdown.htmlToMarkdown(wys.innerHTML);
              this.renderMdPreview();
              editorState.wysDirty = false;
            }
            mdPanel.style.display = "";
            wysPanel.style.display = "none";
          } else {
            if (editorState.mdDirty || mdTa.value) {
              wys.innerHTML = Markdown.render(mdTa.value || "").html;
              editorState.mdDirty = false;
            }
            mdPanel.style.display = "none";
            wysPanel.style.display = "";
          }
          editorState.mode = mode;
        })
      );

      let previewTimer = null;
      mdTa.addEventListener("input", () => {
        editorState.mdDirty = true;
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => this.renderMdPreview(), 260);
      });
      wys.addEventListener("input", () => {
        editorState.wysDirty = true;
      });

      const toolbar = $("#wysToolbar");
      toolbar.addEventListener("mousedown", (e) => e.preventDefault());
      toolbar.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cmd]");
        if (!btn) return;
        this.execCommand(btn.dataset.cmd);
      });

      wys.addEventListener("paste", (e) => {
        const items = Array.from(e.clipboardData && e.clipboardData.items ? e.clipboardData.items : []);
        const imgs = items.filter((it) => it.type && it.type.startsWith("image/"));
        if (!imgs.length) return;
        e.preventDefault();
        imgs.forEach(async (it) => {
          const file = it.getAsFile();
          if (!file) return;
          const url = await fileToDataUrl(file, 1800, 0.85);
          if (url) document.execCommand("insertImage", false, url);
        });
      });

      mdTa.addEventListener("paste", (e) => {
        const items = Array.from(e.clipboardData && e.clipboardData.items ? e.clipboardData.items : []);
        const imgs = items.filter((it) => it.type && it.type.startsWith("image/"));
        if (!imgs.length) return;
        e.preventDefault();
        imgs.forEach(async (it) => {
          const file = it.getAsFile();
          if (!file) return;
          const url = await fileToDataUrl(file, 1800, 0.85);
          if (url) insertAtCursor(mdTa, "\n![" + (file.name || "图片") + "](" + url + ")\n");
        });
      });

      const dropHint = $("#dropHint");
      ["dragenter", "dragover"].forEach((ev) =>
        dropHint.addEventListener(ev, (e) => {
          e.preventDefault();
          dropHint.classList.add("dragover");
        })
      );
      ["dragleave", "drop"].forEach((ev) =>
        dropHint.addEventListener(ev, (e) => {
          e.preventDefault();
          dropHint.classList.remove("dragover");
        })
      );
      dropHint.addEventListener("drop", (e) => {
        const files = Array.from(e.dataTransfer.files || []);
        this.handleImageFiles(files);
      });

      const fileInput = $("#editorImageInput");
      fileInput.addEventListener("change", () => {
        this.handleImageFiles(Array.from(fileInput.files || []));
        fileInput.value = "";
      });

      const importInput = $("#mdImportInput");
      $("#ebImport").addEventListener("click", () => importInput.click());
      importInput.addEventListener("change", () => {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          let text = String(reader.result || "").replace(/^\uFEFF/, "");
          const first = (text.split(/\r?\n/, 1)[0] || "").trim();
          if (first.startsWith("# ")) {
            if (!$("#postTitle").value.trim()) {
              $("#postTitle").value = first.replace(/^#\s+/, "").trim();
            }
            text = text.replace(/^#\s+.*(?:\r?\n|$)/, "");
          }
          $("#mdBody").value = text;
          editorState.mdDirty = true;
          this.renderMdPreview();
          const mdTab = $('.tabs button[data-tab="md"]');
          if (mdTab) mdTab.click();
          showToast("Markdown 已导入，请检查后保存");
        };
        reader.readAsText(file, "utf-8");
        importInput.value = "";
      });

      $("#copyCrawlCmd").addEventListener("click", async () => {
        const cmd = $("#crawlCmd").textContent;
        try {
          await navigator.clipboard.writeText(cmd);
        } catch (e) {
          const ta = document.createElement("textarea");
          ta.value = cmd;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        showToast("命令已复制");
      });

      $("#ebDraft").addEventListener("click", () => this.savePost(false));
      $("#ebPublish").addEventListener("click", () => this.savePost(true));
      $("#ebPreview").addEventListener("click", () => this.savePost(false, { preview: true }));
    },

    handleImageFiles(files) {
      const mdTa = $("#mdBody");
      const wys = $("#wysBody");
      files.forEach(async (file) => {
        const url = await fileToDataUrl(file, 1800, 0.85);
        if (!url) return;
        if (editorState.mode === "md") {
          insertAtCursor(mdTa, "\n![" + (file.name || "图片") + "](" + url + ")\n");
        } else {
          wys.focus();
          document.execCommand("insertImage", false, url);
          editorState.wysDirty = true;
        }
      });
    },

    execCommand(cmd) {
      const wys = $("#wysBody");
      if (!wys) return;
      wys.focus();
      if (cmd === "h2") document.execCommand("formatBlock", false, "h2");
      else if (cmd === "h3") document.execCommand("formatBlock", false, "h3");
      else if (cmd === "p") document.execCommand("formatBlock", false, "p");
      else if (cmd === "formatBlock-quote") document.execCommand("formatBlock", false, "blockquote");
      else if (cmd === "createLink") {
        const url = prompt("输入链接地址");
        if (url) document.execCommand("createLink", false, url);
      } else if (cmd === "image") $("#editorImageInput").click();
      else if (cmd === "code") {
        const code = prompt("粘贴代码内容");
        if (code != null) {
          document.execCommand(
            "insertHTML",
            false,
            "<pre><code>" + esc(code) + "</code></pre><p><br></p>"
          );
        }
      } else if (cmd === "hr") document.execCommand("insertHorizontalRule");
      else document.execCommand(cmd, false, null);
    },

    renderMdPreview() {
      const mdTa = $("#mdBody");
      const preview = $("#mdPreview");
      if (!mdTa || !preview) return;
      preview.innerHTML = Markdown.render(mdTa.value || "").html;
    },

    getEditorMarkdown() {
      if (editorState.mode === "md") return $("#mdBody").value;
      return Markdown.htmlToMarkdown($("#wysBody").innerHTML);
    },

    async uploadImages(md) {
      const re = /!\[[^\]]*\]\((data:image\/([a-z+.-]+);base64,([A-Za-z0-9+/=]+))\)/g;
      const matches = [];
      let m;
      while ((m = re.exec(md))) {
        matches.push({ full: m[1], ext: m[2].toLowerCase(), b64: m[3] });
      }
      if (!matches.length) return md;
      const extMap = { jpeg: "jpg", jpg: "jpg", png: "png", gif: "gif", webp: "webp", "svg+xml": "svg" };
      for (let i = 0; i < matches.length; i++) {
        const mt = matches[i];
        const name = "img-" + Date.now().toString(36) + "-" + i + "." + (extMap[mt.ext] || "png");
        await this.saveBinary("images/" + name, mt.b64, "上传图片: " + name);
        md = md.split(mt.full).join("images/" + name);
      }
      return md;
    },

    async savePost(publish, opts) {
      opts = opts || {};
      if (editorState.busy) return;
      const title = $("#postTitle").value.trim();
      if (!title) {
        showToast("请先填写文章标题");
        return;
      }
      const md = this.getEditorMarkdown().trim();
      if (!md) {
        showToast("文章内容不能为空");
        return;
      }

      const category = $("#postCategory").value.trim() || "随笔";
      const tags = $("#postTags")
        .value.split(/[,，、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const date = $("#postDate").value || today();
      const status = publish ? "published" : "draft";
      editorState.busy = true;
      this.setBusy(true);

      try {
        const bodyMd = await this.uploadImages(md);
        const clean = bodyMd
          .replace(/[#>*_`~[\]!()|-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const excerpt = ($("#postExcerpt").value.trim() || clean.slice(0, 110)).trim();
        const readingTime = Math.max(1, Math.round(clean.length / 350));
        const id = editorState.id || "post-" + Date.now().toString(36);

        const posts = await this.loadPostsFromRepo();
        let post = posts.find((p) => p.id === id || p.slug === id);
        if (!post) {
          post = { id, slug: id };
          posts.unshift(post);
        }
        Object.assign(post, {
          title,
          category,
          tags,
          date,
          status,
          excerpt,
          readingTime,
          updated: today()
        });

        await this.saveFile(
          "content/posts/" + id + ".md",
          bodyMd,
          (publish ? "发布" : "保存草稿") + ": " + title
        );
        await this.saveFile(
          "content/posts.json",
          JSON.stringify({ posts }, null, 2),
          "更新文章列表: " + title
        );

        editorState.id = id;
        localStorage.removeItem(CACHE_KEY);
        if (window.App) App.bodies = {};
        showToast(publish ? "文章已发布" : "草稿已保存");
        if (opts.preview) {
          window.open(location.href.split("#")[0] + "#/post/" + encodeURIComponent(id), "_blank");
        } else {
          location.hash = "#/admin";
        }
      } catch (e) {
        showToast("保存失败：" + e.message);
      } finally {
        editorState.busy = false;
        this.setBusy(false);
      }
    },

    setBusy(on) {
      const btns = ["#ebDraft", "#ebPublish", "#ebPreview"].map((s) => $(s)).filter(Boolean);
      btns.forEach((b) => (b.disabled = on));
      $("#ebStatus").textContent = on ? "正在保存到仓库…" : editorState.id ? "编辑文章" : "新建文章";
    },

    /* ---------------- 站点设置 ---------------- */

    async renderSettings() {
      App.renderApp(
        '<div class="admin-shell"><div class="wrap">' +
          '<div class="admin-head"><div><h1>站点设置</h1>' +
          "<p>修改后的内容会保存到仓库并立即生效</p></div>" +
          '<div class="admin-actions"><a class="btn" href="#/admin">返回管理</a>' +
          '<button type="button" class="btn btn-primary" id="settingsSave">保存设置</button></div></div>' +
          '<form id="settingsForm" class="settings-form">' +
          '<section class="settings-section"><h2>基本信息</h2>' +
          '<div class="form-row">' +
          '<div class="field"><label for="setTitle">博客名称</label><input type="text" id="setTitle" /></div>' +
          '<div class="field"><label for="setAuthor">作者名</label><input type="text" id="setAuthor" /></div>' +
          "</div>" +
          '<div class="field"><label for="setSubtitle">副标题</label><input type="text" id="setSubtitle" /></div>' +
          '<div class="field"><label for="setDesc">站点描述</label><input type="text" id="setDesc" /></div>' +
          '<div class="field"><label for="setFooter">页脚文字</label><input type="text" id="setFooter" /></div>' +
          '<div class="field"><label for="setAbout">关于页面（支持 Markdown）</label>' +
          '<textarea id="setAbout" rows="8"></textarea></div>' +
          "</section>" +
          '<section class="settings-section"><h2>文章评论（Giscus）</h2>' +
          '<div class="check-row"><input type="checkbox" id="setGiscusOn" /><label for="setGiscusOn">开启评论</label></div>' +
          '<div class="form-row">' +
          '<div class="field"><label for="setGiscusRepo">仓库（owner/repo）</label><input type="text" id="setGiscusRepo" placeholder="username/repo" /></div>' +
          '<div class="field"><label for="setGiscusRepoId">repoId</label><input type="text" id="setGiscusRepoId" /></div>' +
          "</div>" +
          '<div class="form-row">' +
          '<div class="field"><label for="setGiscusCat">分类名称</label><input type="text" id="setGiscusCat" placeholder="Announcements" /></div>' +
          '<div class="field"><label for="setGiscusCatId">categoryId</label><input type="text" id="setGiscusCatId" /></div>' +
          "</div>" +
          '<p class="field-hint">在 giscus.app 上按提示生成这四项配置，并确保仓库已开启 Discussions。</p>' +
          "</section>" +
          '<section class="settings-section"><h2>访问统计</h2>' +
          '<div class="check-row"><input type="checkbox" id="setStatsOn" /><label for="setStatsOn">开启统计</label></div>' +
          '<div class="field"><label for="setStatsSite">GoatCounter 站点 ID</label><input type="text" id="setStatsSite" placeholder="例如 myblog" /></div>' +
          '<p class="field-hint">到 goatcounter.com 免费注册一个站点，把 ID 填到这里。</p>' +
          "</section>" +
          '<section class="settings-section"><h2>连接与安全</h2>' +
          '<div class="form-row">' +
          '<div class="field"><label for="setOwner">GitHub 用户名</label><input type="text" id="setOwner" /></div>' +
          '<div class="field"><label for="setRepo">仓库名</label><input type="text" id="setRepo" /></div>' +
          "</div>" +
          '<div class="field"><label for="setToken">访问令牌</label><input type="password" id="setToken" placeholder="已保存则留空" />' +
          '<p class="field-hint">令牌仅保存在当前浏览器。换设备时需要在「管理」页重新完成首次设置。</p></div>' +
          '<div class="form-row">' +
          '<div class="field"><label for="setCurPw">当前密码</label><input type="password" id="setCurPw" autocomplete="current-password" /></div>' +
          '<div class="field"><label for="setNewPw">新密码（留空不修改）</label><input type="password" id="setNewPw" autocomplete="new-password" /></div>' +
          "</div>" +
          "</section>" +
          "</form></div></div>"
      );

      let site;
      try {
        site = await this.loadSiteFromRepo();
      } catch (e) {
        site = Object.assign({}, DEFAULT_SITE, window.App && App.site ? App.site : {});
      }
      const cfg = this.getConfig();

      $("#setTitle").value = site.title || "";
      $("#setAuthor").value = site.author || "";
      $("#setSubtitle").value = site.subtitle || "";
      $("#setDesc").value = site.description || "";
      $("#setFooter").value = site.footer || "";
      $("#setAbout").value = site.about || "";
      $("#setGiscusOn").checked = !!(site.giscus && site.giscus.enabled);
      $("#setGiscusRepo").value = (site.giscus && site.giscus.repo) || "";
      $("#setGiscusRepoId").value = (site.giscus && site.giscus.repoId) || "";
      $("#setGiscusCat").value = (site.giscus && site.giscus.category) || "";
      $("#setGiscusCatId").value = (site.giscus && site.giscus.categoryId) || "";
      $("#setStatsOn").checked = !!(site.goatcounter && site.goatcounter.enabled);
      $("#setStatsSite").value = (site.goatcounter && site.goatcounter.site) || "";
      $("#setOwner").value = cfg.owner || "";
      $("#setRepo").value = cfg.repo || "";

      $("#settingsSave").addEventListener("click", async () => {
        const btn = $("#settingsSave");
        btn.disabled = true;
        btn.textContent = "保存中…";
        try {
          const owner = $("#setOwner").value.trim();
          const repo = $("#setRepo").value.trim();
          const token = $("#setToken").value.trim();
          if (owner && repo && token) this.setConfig({ owner, repo, token });
          else if (owner && repo && !token && cfg.token) this.setConfig({ owner, repo, token: cfg.token });

          const newPw = $("#setNewPw").value;
          if (newPw) {
            const cur = $("#setCurPw").value;
            if (site.passwordHash) {
              if (!cur || hashPassword(cur, site.passwordSalt) !== site.passwordHash) {
                showToast("当前密码不正确");
                btn.disabled = false;
                btn.textContent = "保存设置";
                return;
              }
            }
            site.passwordSalt = randomSalt();
            site.passwordHash = hashPassword(newPw, site.passwordSalt);
          } else if (site.passwordHash && $("#setCurPw").value) {
            const cur = $("#setCurPw").value;
            if (hashPassword(cur, site.passwordSalt) !== site.passwordHash) {
              showToast("当前密码不正确");
              btn.disabled = false;
              btn.textContent = "保存设置";
              return;
            }
          }

          site.title = $("#setTitle").value.trim() || "拾遗录";
          site.author = $("#setAuthor").value.trim();
          site.subtitle = $("#setSubtitle").value.trim();
          site.description = $("#setDesc").value.trim();
          site.footer = $("#setFooter").value.trim();
          site.about = $("#setAbout").value;
          site.giscus = {
            enabled: $("#setGiscusOn").checked,
            repo: $("#setGiscusRepo").value.trim(),
            repoId: $("#setGiscusRepoId").value.trim(),
            category: $("#setGiscusCat").value.trim(),
            categoryId: $("#setGiscusCatId").value.trim()
          };
          site.goatcounter = {
            enabled: $("#setStatsOn").checked,
            site: $("#setStatsSite").value.trim()
          };

          await this.saveFile("content/site.json", JSON.stringify(site, null, 2), "更新站点设置");
          localStorage.removeItem(CACHE_KEY);
          if (window.App) {
            App.site = site;
            App.applyChrome();
          }
          showToast("设置已保存");
        } catch (e) {
          showToast("保存失败：" + e.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "保存设置";
        }
      });
    }
  };

  function statBox(num, label) {
    return '<div class="stat-box"><div class="stat-num">' + num + '</div><div class="stat-label">' + label + "</div></div>";
  }

  window.Admin = Admin;
})();
