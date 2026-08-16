/* app.js
   前台浏览应用：首页、文章、归档、分类、搜索、评论、统计、深浅色主题。 */
(function () {
  "use strict";

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const CACHE_KEY = "blog_cache_v1";
  const THEME_KEY = "blog_theme";

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    }
  };

  const DEFAULT_SITE = {
    title: "拾遗录",
    subtitle: "学习笔记、技术教程与生活随笔",
    author: "",
    description: "个人博客，记录学习笔记、技术教程与生活随笔。",
    footer: "记录、整理、分享",
    about: "欢迎来到我的博客。",
    giscus: { enabled: false, repo: "", repoId: "", category: "", categoryId: "" },
    goatcounter: { enabled: false, site: "" }
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isAdminSession() {
    return !!(window.Admin && Admin.isSession && Admin.isSession());
  }

  async function fetchTextWithFallback(path) {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (res.ok) return await res.text();
      throw new Error("HTTP " + res.status);
    } catch (e) {
      const cfg = window.Admin && Admin.getConfig ? Admin.getConfig() : null;
      if (cfg && cfg.owner && cfg.repo) {
        const raw =
          "https://raw.githubusercontent.com/" +
          encodeURIComponent(cfg.owner) +
          "/" +
          encodeURIComponent(cfg.repo) +
          "/main/" +
          path;
        const res = await fetch(raw, { cache: "no-cache" });
        if (res.ok) return await res.text();
      }
      throw e;
    }
  }

  const App = {
    site: null,
    posts: [],
    bodies: {},
    loading: false,

    async init() {
      this.initTheme();
      this.bindChrome();
      this.bindGlobal();
      await this.loadData();
    },

    initTheme() {
      const saved = localStorage.getItem(THEME_KEY);
      const dark = saved
        ? saved === "dark"
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    },

    isDark() {
      return document.documentElement.dataset.theme === "dark";
    },

    toggleTheme() {
      const next = this.isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
      const frames = $$("iframe.giscus-frame");
      frames.forEach((f) => {
        try {
          f.contentWindow.postMessage(
            { giscus: { setConfig: { theme: next === "dark" ? "dark" : "light" } } },
            "https://giscus.app"
          );
        } catch (e) {}
      });
      showToast(next === "dark" ? "已切换到深色模式" : "已切换到浅色模式");
    },

    bindChrome() {
      $("#themeToggle").addEventListener("click", () => this.toggleTheme());

      const overlay = $("#searchOverlay");
      const input = $("#searchInput");
      const closeBtn = $("#searchClose");

      const openSearch = () => {
        overlay.hidden = false;
        input.value = "";
        $("#searchResults").innerHTML = "";
        setTimeout(() => input.focus(), 30);
        document.body.style.overflow = "hidden";
      };
      const closeSearch = () => {
        overlay.hidden = true;
        document.body.style.overflow = "";
      };

      $("#searchOverlay").addEventListener("click", (e) => {
        if (e.target === overlay) closeSearch();
      });
      closeBtn.addEventListener("click", closeSearch);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !overlay.hidden) {
          closeSearch();
          return;
        }
        if (e.key === "/" && !/input|textarea|select|\[contenteditable\]/i.test(document.activeElement.tagName)) {
          e.preventDefault();
          openSearch();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          if (overlay.hidden) openSearch();
        }
      });

      input.addEventListener("input", () => this.renderSearchResults(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const first = $("#searchResults a");
          if (first) location.hash = first.getAttribute("href");
        }
      });

      const lb = $("#lightbox");
      const lbImg = $("#lightboxImg");
      $("#lightboxClose").addEventListener("click", () => (lb.hidden = true));
      lb.addEventListener("click", (e) => {
        if (e.target === lb) lb.hidden = true;
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !lb.hidden) lb.hidden = true;
      });

      document.addEventListener("click", (e) => {
        const img = e.target.closest(".article-body img, .md-preview img, #wysBody img");
        if (img && img.closest("#lightbox") === null) {
          lbImg.src = img.currentSrc || img.src;
          lbImg.alt = img.alt || "";
          lb.hidden = false;
        }
        const copyBtn = e.target.closest(".copy-btn");
        if (copyBtn) {
          const block = copyBtn.closest(".code-block");
          const code = block ? block.querySelector("pre code").textContent : "";
          copyText(code).then(() => {
            copyBtn.textContent = "已复制";
            setTimeout(() => (copyBtn.textContent = "复制"), 1200);
          });
        }
      });
    },

    bindGlobal() {
      window.addEventListener("hashchange", () => {
        this.route();
      });
    },

    async loadData() {
      const cached = store.get(CACHE_KEY, null);
      if (cached && cached.site && cached.posts) {
        this.site = cached.site;
        this.posts = cached.posts;
        this.applyChrome();
        this.route();
      }
      try {
        const [siteText, postsText] = await Promise.all([
          fetchTextWithFallback("content/site.json"),
          fetchTextWithFallback("content/posts.json")
        ]);
        this.site = JSON.parse(siteText);
        const postsJson = JSON.parse(postsText);
        this.posts = Array.isArray(postsJson.posts) ? postsJson.posts : [];
        store.set(CACHE_KEY, { site: this.site, posts: this.posts, ts: Date.now() });
      } catch (e) {
        if (!cached) {
          this.site = DEFAULT_SITE;
          this.posts = [];
        }
      }
      this.applyChrome();
      this.initStats();
      this.route();
    },

    applyChrome() {
      const site = this.site || DEFAULT_SITE;
      document.title = site.title || "拾遗录";
      $("#siteTitle").textContent = site.title || "拾遗录";
      $("#footerLeft").textContent = site.footer || site.title || "";
      $("#footerRight").textContent = "© " + new Date().getFullYear();
    },

    initStats() {
      const cfg = this.site && this.site.goatcounter;
      if (!cfg || !cfg.enabled || !cfg.site) return;
      if (document.querySelector('script[data-goatcounter]')) return;
      const s = document.createElement("script");
      s.setAttribute("data-goatcounter", "https://" + cfg.site + ".goatcounter.com/count");
      s.src = "https://gc.zgo.at/count.js";
      s.async = true;
      document.head.appendChild(s);
    },

    visiblePosts() {
      return this.posts
        .filter((p) => p.status === "published" || isAdminSession())
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    },

    route() {
      const hash = location.hash || "#/home";
      const parts = hash.replace(/^#\/?/, "").split("/").filter((x) => x !== "");
      const root = (parts[0] || "home").toLowerCase();
      this.setNavActive(root);
      const params = parts.slice(1).map(decodeURIComponent);

      try {
        if (root === "home" || root === "") this.renderHome();
        else if (root === "post") this.renderPost(params[0]);
        else if (root === "category") this.renderCategory(params[0]);
        else if (root === "tag") this.renderTag(params[0]);
        else if (root === "archive") this.renderArchive();
        else if (root === "about") this.renderAbout();
        else if (root === "search") this.renderSearchView();
        else if (root === "admin" && window.Admin) Admin.route(parts);
        else this.renderError("页面不存在");
      } catch (e) {
        console.error(e);
        this.renderError("页面加载出错，请稍后重试");
      }
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = "";
    },

    setNavActive(root) {
      $$(".nav a").forEach((a) => {
        const href = (a.getAttribute("href") || "").replace("#/", "").split("/")[0];
        a.classList.toggle("active", href === root);
      });
    },

    renderApp(html) {
      $("#app").innerHTML = html;
    },

    mastheadHtml() {
      const site = this.site || DEFAULT_SITE;
      const now = new Date();
      return (
        '<section class="masthead">' +
        '<p class="masthead-kicker">个人日志 · ' +
        now.getFullYear() +
        " 年 " +
        (now.getMonth() + 1) +
        " 月</p>" +
        "<h1>" + esc(site.title) + "</h1>" +
        "<p>" + esc(site.subtitle) + "</p>" +
        "</section>"
      );
    },

    chipsHtml(activeCat) {
      const cats = Array.from(
        new Set(this.posts.filter((p) => p.status === "published").map((p) => p.category).filter(Boolean))
      ).sort();
      let html =
        '<ul class="chips"><li><button data-cat=""' +
        (activeCat ? "" : ' class="active"') +
        ">全部</button></li>";
      cats.forEach((c) => {
        html +=
          "<li><button data-cat=\"" + esc(c) + '"' +
          (activeCat === c ? ' class="active"' : "") +
          ">" + esc(c) + "</button></li>";
      });
      html += "</ul>";
      return html;
    },

    postItemHtml(p, index) {
      const num = String(index + 1).padStart(2, "0");
      const draft = p.status !== "published" ? '<span class="badge badge-draft">草稿</span>' : "";
      return (
        '<article class="post-item">' +
        '<div class="post-index">' + num + "</div>" +
        '<div class="post-main">' +
        '<p class="post-kicker">' + esc(p.category || "随笔") + draft + "</p>" +
        '<h2 class="post-title"><a href="#/post/' + encodeURIComponent(p.slug || p.id) + '">' + esc(p.title) + "</a></h2>" +
        (p.excerpt ? '<p class="post-excerpt">' + esc(p.excerpt) + "</p>" : "") +
        '<div class="post-meta">' +
        "<span>" + fmtDate(p.date) + "</span>" +
        '<span class="dot"></span>' +
        "<span>约 " + (p.readingTime || 1) + " 分钟</span>" +
        (p.tags && p.tags.length
          ? '<span class="dot"></span><span>' +
            p.tags
              .map((t) => '<a href="#/tag/' + encodeURIComponent(t) + '">' + esc(t) + "</a>")
              .join(" · ") +
            "</span>"
          : "") +
        "</div>" +
        "</div>" +
        "</article>"
      );
    },

    renderHome() {
      const posts = this.visiblePosts();
      const chips = this.chipsHtml("");
      const list =
        posts.length === 0
          ? emptyStateHtml("还没有文章", '点击右上角「管理」，完成设置后写下第一篇吧。')
          : '<div class="post-list">' + posts.map((p, i) => this.postItemHtml(p, i)).join("") + "</div>";
      this.renderApp(this.mastheadHtml() + chips + list);
      $$(".chips button").forEach((b) =>
        b.addEventListener("click", () => {
          const cat = b.dataset.cat;
          location.hash = cat ? "#/category/" + encodeURIComponent(cat) : "#/home";
        })
      );
    },

    renderPostList(items, title, sub) {
      if (!items.length) {
        this.renderApp(
          '<div class="page-head"><h1>' + esc(title) + "</h1></div>" + emptyStateHtml("这里还没有文章", sub || "")
        );
        return;
      }
      this.renderApp(
        '<div class="page-head"><h1>' + esc(title) + "</h1><p>" + esc(sub || "") + "</p></div>" +
          '<div class="post-list">' + items.map((p, i) => this.postItemHtml(p, i)).join("") + "</div>"
      );
    },

    renderCategory(cat) {
      const posts = this.visiblePosts().filter((p) => p.category === cat);
      this.renderPostList(posts, cat || "分类", "该分类下的全部文章");
    },

    renderTag(tag) {
      const posts = this.visiblePosts().filter((p) => p.tags && p.tags.includes(tag));
      this.renderPostList(posts, tag || "标签", "带有该标签的全部文章");
    },

    renderArchive() {
      const posts = this.visiblePosts();
      if (!posts.length) {
        this.renderApp('<div class="page-head"><h1>归档</h1></div>' + emptyStateHtml("还没有文章", ""));
        return;
      }
      const years = {};
      posts.forEach((p) => {
        const y = String(p.date).slice(0, 4);
        (years[y] = years[y] || []).push(p);
      });
      let html = '<div class="page-head"><h1>归档</h1><p>共 ' + posts.length + " 篇文章</p></div>";
      Object.keys(years)
        .sort()
        .reverse()
        .forEach((y) => {
          html += '<section class="archive-year"><h2>' + y + "</h2>";
          years[y].forEach((p) => {
            html +=
              '<div class="archive-item"><a href="#/post/' + encodeURIComponent(p.slug || p.id) + '">' +
              esc(p.title) +
              "</a><time>" + esc(String(p.date).slice(5)) + "</time></div>";
          });
          html += "</section>";
        });
      this.renderApp(html);
    },

    renderAbout() {
      const site = this.site || DEFAULT_SITE;
      const aboutMd = site.about || "";
      const rendered = Markdown.render(aboutMd);
      this.renderApp(
        '<div class="page-head"><h1>关于</h1></div>' +
          '<div class="article-body about-body">' + rendered.html + "</div>"
      );
    },

    async renderPost(id) {
      const post = this.posts.find((p) => p.slug === id || p.id === id);
      if (!post) {
        this.renderError("没有找到这篇文章");
        return;
      }
      if (post.status !== "published" && !isAdminSession()) {
        this.renderError("这篇文章还没有发布");
        return;
      }

      this.renderApp(
        '<article class="article">' +
          '<a class="article-back" href="#/home">← 返回首页</a>' +
          '<div class="article-head">' +
          '<p class="article-kicker">' + esc(post.category || "随笔") + "</p>" +
          "<h1>" + esc(post.title) + "</h1>" +
          '<div class="article-meta">' +
          "<span>" + fmtDate(post.date) + "</span>" +
          '<span class="dot"></span>' +
          "<span>约 " + (post.readingTime || 1) + " 分钟</span>" +
          (post.updated && post.updated !== post.date
            ? '<span class="dot"></span><span>更新于 ' + fmtDate(post.updated) + "</span>"
            : "") +
          "</div>" +
          "</div>" +
          '<div class="article-body">' + skeletonParagraph() + "</div>" +
          "</article>"
      );

      let body = this.bodies[id];
      if (body === undefined) {
        try {
          body = await fetchTextWithFallback("content/posts/" + id + ".md");
          this.bodies[id] = body;
        } catch (e) {
          body = "";
        }
      }

      const rendered = Markdown.render(body);
      const tocHtml =
        rendered.toc.length > 1
          ? '<nav class="toc"><p class="toc-title">目录</p><ol>' +
            rendered.toc
              .map(
                (t) =>
                  '<li class="toc-' + t.level + '"><a href="#' + t.id + '">' + esc(t.text) + "</a></li>"
              )
              .join("") +
            "</ol></nav>"
          : "";

      const sorted = this.visiblePosts();
      const idx = sorted.findIndex((p) => (p.slug || p.id) === id);
      const prev = idx > 0 ? sorted[idx - 1] : null;
      const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
      const navHtml =
        prev || next
          ? '<nav class="article-nav">' +
            (prev
              ? '<a href="#/post/' + encodeURIComponent(prev.slug || prev.id) + '"><span class="nav-label">上一篇</span>' + esc(prev.title) + "</a>"
              : "<span></span>") +
            (next
              ? '<a class="next" href="#/post/' + encodeURIComponent(next.slug || next.id) + '"><span class="nav-label">下一篇</span>' + esc(next.title) + "</a>"
              : "") +
            "</nav>"
          : "";

      const comments =
        this.site && this.site.giscus && this.site.giscus.enabled && this.site.giscus.repo
          ? '<section class="comments" id="giscus-comments"></section>'
          : "";

      document.title = esc(post.title) + " · " + (this.site ? this.site.title : "拾遗录");

      const article = $("#app .article");
      article.innerHTML =
        '<a class="article-back" href="#/home">← 返回首页</a>' +
        '<div class="article-head">' +
        '<p class="article-kicker">' + esc(post.category || "随笔") + "</p>" +
        "<h1>" + esc(post.title) + "</h1>" +
        '<div class="article-meta">' +
        "<span>" + fmtDate(post.date) + "</span>" +
        '<span class="dot"></span>' +
        "<span>约 " + (post.readingTime || 1) + " 分钟</span>" +
        (post.updated && post.updated !== post.date
          ? '<span class="dot"></span><span>更新于 ' + fmtDate(post.updated) + "</span>"
          : "") +
        "</div>" +
        "</div>" +
        tocHtml +
        '<div class="article-body">' + rendered.html + "</div>" +
        '<div class="article-tags">' +
        (post.tags || []).map((t) => '<a href="#/tag/' + encodeURIComponent(t) + '">' + esc(t) + "</a>").join("") +
        "</div>" +
        navHtml +
        comments;

      if (comments) this.mountGiscus(post.slug || post.id);
    },

    mountGiscus(term) {
      const cfg = (this.site && this.site.giscus) || {};
      if (!cfg.enabled || !cfg.repo) return;
      const host = $("#giscus-comments");
      if (!host) return;
      const g = document.createElement("div");
      g.className = "giscus";
      host.appendChild(g);
      const s = document.createElement("script");
      s.src = "https://giscus.app/client.js";
      s.setAttribute("data-repo", cfg.repo);
      s.setAttribute("data-repo-id", cfg.repoId || "");
      s.setAttribute("data-category", cfg.category || "Announcements");
      s.setAttribute("data-category-id", cfg.categoryId || "");
      s.setAttribute("data-mapping", "specific");
      s.setAttribute("data-term", term);
      s.setAttribute("data-strict", "0");
      s.setAttribute("data-reactions-enabled", "1");
      s.setAttribute("data-emit-metadata", "0");
      s.setAttribute("data-input-position", "top");
      s.setAttribute("data-theme", this.isDark() ? "dark" : "light");
      s.setAttribute("data-lang", "zh-CN");
      s.setAttribute("data-loading", "lazy");
      s.async = true;
      host.appendChild(s);
    },

    searchablePosts() {
      return this.visiblePosts().filter((p) => p.status === "published" || isAdminSession());
    },

    queryPosts(q) {
      if (!q) return [];
      const ql = q.toLowerCase();
      const results = [];
      for (const p of this.searchablePosts()) {
        const hay = [
          p.title,
          p.category,
          p.excerpt,
          (p.tags || []).join(" "),
          this.bodies[p.id] ? this.bodies[p.id] : ""
        ].join("\n");
        if (hay.toLowerCase().indexOf(ql) !== -1) {
          let snippet = p.excerpt || "";
          const body = this.bodies[p.id] || "";
          if (body) {
            const idx = body.toLowerCase().indexOf(ql);
            if (idx !== -1) {
              snippet = body.slice(Math.max(0, idx - 30), idx + 80).replace(/\s+/g, " ");
            }
          }
          results.push({ post: p, snippet, match: p.title });
        }
      }
      return results;
    },

    renderSearchResults(q) {
      const box = $("#searchResults");
      if (!box) return;
      const ql = q.trim();
      if (!ql) {
        box.innerHTML = '<p class="search-empty">输入关键词开始搜索</p>';
        return;
      }
      const results = this.queryPosts(ql);
      if (!results.length) {
        box.innerHTML = '<p class="search-empty">没有找到与「' + esc(ql) + "」相关的文章</p>";
        return;
      }
      box.innerHTML = results
        .map((r) => {
          const p = r.post;
          return (
            '<a class="search-result" href="#/post/' + encodeURIComponent(p.slug || p.id) + '">' +
            '<p class="sr-title">' + esc(p.title) + "</p>" +
            '<p class="sr-meta">' + esc(p.category || "") + " · " + fmtDate(p.date) + "</p>" +
            (r.snippet ? '<p class="sr-snippet">' + esc(r.snippet.slice(0, 120)) + "</p>" : "") +
            "</a>"
          );
        })
        .join("");
    },

    async renderSearchView() {
      const q = "";
      this.renderApp(
        '<div class="page-head"><h1>搜索</h1><p>支持标题、分类、标签与正文内容</p></div>' +
          '<div class="search-view"><div class="field"><input id="searchViewInput" type="search" placeholder="输入关键词…" autocomplete="off" /></div>' +
          '<div id="searchViewResults" class="post-list"></div></div>'
      );
      const input = $("#searchViewInput");
      if (input) {
        input.focus();
        input.addEventListener("input", () => {
          const box = $("#searchViewResults");
          const ql = input.value.trim();
          if (!ql) {
            box.innerHTML = "";
            return;
          }
          const results = this.queryPosts(ql);
          box.innerHTML = results.length
            ? results.map((r, i) => this.postItemHtml(r.post, i)).join("")
            : emptyStateHtml("没有找到相关文章", "换个关键词试试");
        });
      }
    },

    renderError(msg) {
      this.renderApp(
        '<div class="error-state"><h2>' + esc(msg || "出错了") + "</h2>" +
          '<p>返回<a href="#/home">首页</a>继续浏览</p></div>'
      );
    }
  };

  function fmtDate(d) {
    if (!d) return "";
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(d);
    return m[1] + " 年 " + +m[2] + " 月 " + +m[3] + " 日";
  }

  function emptyStateHtml(title, sub) {
    return (
      '<div class="empty-state"><h2>' + esc(title) + "</h2>" +
      (sub ? "<p>" + esc(sub) + "</p>" : "") +
      '<a class="btn" href="#/admin">进入管理页</a></div>'
    );
  }

  function skeletonParagraph() {
    return (
      '<div class="skeleton"><div class="skeleton-line w85"></div>' +
      '<div class="skeleton-line"></div><div class="skeleton-line w60"></div>' +
      '<div class="skeleton-line w40"></div></div>'
    );
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    showToast("代码已复制");
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2600);
  }

  window.App = App;
  window.showToast = showToast;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => App.init());
  } else {
    App.init();
  }
})();
