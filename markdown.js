/* markdown.js
   轻量 Markdown 渲染器 + 代码高亮 + HTML 转 Markdown（用于可视化编辑器）
   依赖零、无第三方库，渲染前先转义 HTML 以保证安全。 */
(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function safeUrl(u) {
    const s = String(u || "").trim();
    if (/^(https?:|mailto:|#|\/|\.\/|\.\.\/|images\/)/i.test(s)) return s;
    if (/^data:image\//i.test(s)) return s;
    return "#";
  }

  /* ---------------- 代码高亮 ---------------- */

  const KEYWORDS = {
    py: "False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|self|print",
    js: "async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|let|new|of|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield|true|false|null|undefined",
    ts: "async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|of|private|protected|public|return|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield|true|false|null|undefined",
    bash: "if|then|else|elif|fi|for|while|do|done|case|esac|function|in|select|until|time|return|exit|export|local|readonly|set|shift|source|alias|echo|cd|mkdir|rm|cp|mv|sudo|apt|yum|brew|git|python|node|npm|wget|curl|tar|grep|sed|awk|cat|ls|chmod|chown",
    html: "html|head|body|title|meta|link|script|style|div|span|p|a|img|ul|ol|li|table|thead|tbody|tr|th|td|form|input|button|textarea|select|option|label|header|footer|main|nav|section|article|aside|h1|h2|h3|h4|h5|h6|br|hr|strong|em|code|pre|blockquote|iframe|video|audio",
    css: "html|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|header|footer|nav|main|section|article|aside|h1|h2|h3|h4|h5|h6|class|id|display|position|top|right|bottom|left|margin|padding|border|width|height|background|color|font|text|line|flex|grid|align|justify|content|overflow|z-index|opacity|transition|transform|animation|box-sizing|border-radius|box-shadow|cursor|float|clear|list-style|max-width|min-height|media|import|keyframes|hover|active|focus",
    java: "abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null",
    c: "auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|true|false|null|NULL|printf|scanf|malloc|free|sizeof",
    cpp: "alignas|alignof|auto|bool|break|case|catch|char|class|const|constexpr|continue|default|delete|do|double|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|namespace|new|nullptr|operator|private|protected|public|register|return|short|signed|sizeof|static|static_cast|struct|switch|template|this|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|while",
    sql: "select|from|where|insert|into|values|update|set|delete|create|table|alter|drop|index|view|join|inner|left|right|outer|on|group|by|order|having|limit|offset|union|all|distinct|as|and|or|not|in|between|like|is|null|count|sum|avg|min|max|primary|key|foreign|references|default|constraint|begin|commit|rollback|transaction",
    json: "true|false|null",
    yaml: "true|false|null|yes|no|on|off",
    diff: "diff|index|new|old|similarity|rename|copy|deleted|added"
  };

  const LANG_DEFS = {
    py: { str: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, com: /#[^\n]*/ },
    js: { str: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/, com: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    ts: { str: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/, com: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    bash: { str: /("(?:\\.|[^"\\])*"|'(?:[^'\\]|\\.)*')/, com: /#[^\n]*/ },
    html: { str: /("(?:\\.|[^"\\])*"|'(?:[^'\\]|\\.)*')/, com: /<!--[\s\S]*?-->/ },
    css: { str: /("(?:\\.|[^"\\])*"|'(?:[^'\\]|\\.)*')/, com: /\/\*[\s\S]*?\*\// },
    java: { str: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, com: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    c: { str: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, com: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    cpp: { str: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|R"([^)]*)\()/, com: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    sql: { str: /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/, com: /--[^\n]*|\/\*[\s\S]*?\*\// },
    json: { str: /"(?:\\.|[^"\\])*"/, com: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    yaml: { str: /("(?:\\.|[^"\\])*"|'(?:[^'\\]|\\.)*')/, com: /#[^\n]*/ },
    diff: { str: /(^\+.*$|^-.*$)/m, com: /^diff.*$/m }
  };

  function highlightCode(code, lang) {
    const key = String(lang || "").toLowerCase();
    const norm = {
      python: "py", py: "py",
      javascript: "js", js: "js", node: "js",
      typescript: "ts", ts: "ts",
      shell: "bash", sh: "bash", bash: "bash", zsh: "bash", powershell: "bash", ps1: "bash",
      html: "html", xml: "html", htm: "html",
      css: "css",
      java: "java",
      c: "c",
      cpp: "cpp", "c++": "cpp", cc: "cpp",
      sql: "sql",
      json: "json",
      yaml: "yaml", yml: "yaml"
    }[key];

    const def = LANG_DEFS[norm];
    if (!def) return escapeHtml(code);

    let out = escapeHtml(code);
    const tokens = [];
    let ti = 0;
    const stash = (match, cls) => {
      const tk = "\u0001T" + ti + "\u0001";
      tokens.push('<span class="' + cls + '">' + match + "</span>");
      ti++;
      return tk;
    };

    out = out.replace(def.str, (m) => stash(m, "tok-str"));
    out = out.replace(def.com, (m) => stash(m, "tok-com"));

    const kw = KEYWORDS[norm];
    if (kw) {
      out = out.replace(new RegExp("\\b(" + kw + ")\\b", "g"), (m) => stash(m, "tok-kw"));
    }
    out = out.replace(/\b(\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, (m) => stash(m, "tok-num"));
    out = out.replace(/\b([A-Za-z_$][\w$]*)(?=\s*\()/g, (m) => stash(m, "tok-fn"));
    out = out.replace(/([=+\-*/%<>!&|^~?:]+)/g, (m) => stash(m, "tok-op"));

    return out.replace(/\u0001T(\d+)\u0001/g, (_, i) => tokens[+i]);
  }

  /* ---------------- 块级解析 ---------------- */

  let headingCounters = {};

  function slugify(text) {
    const base =
      text
        .toLowerCase()
        .trim()
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "") || "sec";
    headingCounters[base] = (headingCounters[base] || 0) + 1;
    return headingCounters[base] === 1 ? base : base + "-" + headingCounters[base];
  }

  function render(src) {
    headingCounters = {};
    const toc = [];
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const codeBlocks = [];
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === "") {
        i++;
        continue;
      }

      const fence = line.match(/^ {0,3}(```+|~~~+)\s*([\w+.-]*)\s*$/);
      if (fence) {
        const buf = [];
        i++;
        while (i < lines.length && !/^ {0,3}(```+|~~~+)\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++;
        const token = "\u0000CODE" + codeBlocks.length + "\u0000";
        codeBlocks.push({ lang: fence[2], code: buf.join("\n") });
        blocks.push({ type: "html", html: token });
        continue;
      }

      if (/^ {0,3}>\s?/.test(line)) {
        const q = [];
        while (i < lines.length && /^ {0,3}>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^ {0,3}>\s?/, ""));
          i++;
        }
        blocks.push({ type: "quote", text: q.join("\n") });
        continue;
      }

      if (/^ {0,3}([-*_])\1{2,}\s*$/.test(line)) {
        blocks.push({ type: "html", html: "<hr />" });
        i++;
        continue;
      }

      const heading = line.match(/^ {0,3}(#{1,6})\s+(.*)$/);
      if (heading) {
        blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
        i++;
        continue;
      }

      if (line.trim().indexOf("|") === 0) {
        const rows = [];
        while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
          rows.push(lines[i]);
          i++;
        }
        blocks.push({ type: "table", rows });
        continue;
      }

      if (/^ {0,3}([-*+])\s+/.test(line) || /^ {0,3}\d+[.)]\s+/.test(line)) {
        const list = [];
        while (i < lines.length) {
          const l = lines[i];
          if (l.trim() === "") {
            const next = lines[i + 1];
            if (next && (/^ {0,3}([-*+])\s+/.test(next) || /^ {0,3}\d+[.)]\s+/.test(next))) {
              list.push(l);
              i++;
              continue;
            }
            break;
          }
          if (/^ {0,3}([-*+])\s+/.test(l) || /^ {0,3}\d+[.)]\s+/.test(l)) {
            list.push(l);
            i++;
            continue;
          }
          break;
        }
        blocks.push({ type: "list", lines: list });
        continue;
      }

      const para = [line];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === "") break;
        if (/^ {0,3}(#{1,6})\s/.test(l)) break;
        if (/^ {0,3}>\s?/.test(l)) break;
        if (/^ {0,3}([-*_])\1{2,}\s*$/.test(l)) break;
        if (/^ {0,3}```/.test(l)) break;
        if (/^ {0,3}([-*+])\s+/.test(l)) break;
        if (/^ {0,3}\d+[.)]\s+/.test(l)) break;
        para.push(l);
        i++;
      }
      blocks.push({ type: "para", text: para.join("\n") });
    }

    /* 内联解析 */
    function inline(text) {
      let s = escapeHtml(text);
      const saved = [];
      const stash = (html) => {
        const tk = "\u0002S" + saved.length + "\u0002";
        saved.push(html);
        return tk;
      };

      s = s.replace(/`([^`\n]+)`/g, (m, c) => stash("<code>" + c + "</code>"));
      s = s.replace(
        /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        (m, alt, src, title) => {
          const url = safeUrl(src);
          const t = title ? ' title="' + escapeHtml(title) + '"' : "";
          return stash('<img src="' + url + '" alt="' + escapeHtml(alt) + '"' + t + ' loading="lazy" />');
        }
      );
      s = s.replace(
        /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        (m, txt, src, title) => {
          const url = safeUrl(src);
          const t = title ? ' title="' + escapeHtml(title) + '"' : "";
          return stash('<a href="' + url + '"' + t + ">" + txt + "</a>");
        }
      );
      s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
      s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
      s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
      s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

      return s.replace(/\u0002S(\d+)\u0002/g, (m, idx) => saved[+idx]);
    }

    function listToHtml(lines) {
      const items = lines.map((l) => {
        const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) return null;
        const ordered = /^\d+/.test(m[2]);
        const indent = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
        return { indent, ordered, text: m[3] };
      });

      const clean = items.filter(Boolean);
      let pos = 0;

      function parse(indent) {
        let out = "";
        let tag = null;
        let firstLi = true;
        while (pos < clean.length) {
          const it = clean[pos];
          if (it.indent < indent) break;
          if (tag === null) {
            tag = it.ordered ? "ol" : "ul";
            out += "<" + tag + ">";
          }
          if (it.indent > indent) {
            out += parse(it.indent);
            continue;
          }
          if (!firstLi) out += "</li>";
          firstLi = false;
          out += "<li>" + inline(it.text);
          pos++;
        }
        if (tag) out += (firstLi ? "" : "</li>") + "</" + tag + ">";
        return out;
      }

      return parse(0);
    }

    let html = "";
    for (const b of blocks) {
      if (b.type === "heading") {
        const id = slugify(b.text);
        const text = inline(b.text);
        toc.push({ level: b.level, id, text: text.replace(/<[^>]+>/g, "") });
        html += "<h" + b.level + ' id="' + id + '">' + text + "</h" + b.level + ">";
      } else if (b.type === "para") {
        const text = b.text
          .split("\n")
          .map((l) => (l.trim().length ? inline(l) : "<br />"))
          .join("\n");
        html += "<p>" + text + "</p>";
      } else if (b.type === "quote") {
        html += "<blockquote>" + render(b.text).html + "</blockquote>";
      } else if (b.type === "list") {
        html += listToHtml(b.lines);
      } else if (b.type === "table") {
        const rows = b.rows.map((r) =>
          r
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim())
        );
        if (rows.length < 2) continue;
        const isSep = (r) => /^:?-{2,}:?$/.test(r.join(" ").replace(/\s+/g, ""));
        let head = rows[0];
        let body = rows;
        if (isSep(rows[1])) {
          body = rows.slice(2);
        } else {
          head = null;
        }
        html += "<table>";
        if (head) {
          html += "<thead><tr>" + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead>";
        }
        if (body.length) {
          html += "<tbody>";
          for (const r of body) {
            html += "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>";
          }
          html += "</tbody>";
        }
        html += "</table>";
      } else {
        html += b.html;
      }
    }

    html = html.replace(/\u0000CODE(\d+)\u0000/g, (m, idx) => {
      const cb = codeBlocks[+idx];
      const langLabel = cb.lang ? '<span class="code-lang">' + escapeHtml(cb.lang) + "</span>" : "";
      return (
        '<div class="code-block">' +
        '<button type="button" class="copy-btn" aria-label="复制代码">复制</button>' +
        langLabel +
        "<pre><code>" +
        highlightCode(cb.code, cb.lang) +
        "</code></pre></div>"
      );
    });

    return { html, toc };
  }

  /* ---------------- HTML 转 Markdown ---------------- */

  function htmlToMarkdown(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const out = blocksToMd(doc.body);
    return out.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function inlineToMd(node) {
    let out = "";
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        out += n.textContent;
        continue;
      }
      if (n.nodeType !== 1) continue;
      const t = n.tagName.toLowerCase();
      const inner = inlineToMd(n);
      if (t === "strong" || t === "b") out += "**" + inner + "**";
      else if (t === "em" || t === "i") out += "*" + inner + "*";
      else if (t === "s" || t === "del") out += "~~" + inner + "~~";
      else if (t === "code") out += "`" + n.textContent + "`";
      else if (t === "a") out += "[" + inner + "](" + (n.getAttribute("href") || "") + ")";
      else if (t === "img") {
        const alt = n.getAttribute("alt") || "";
        const src = n.getAttribute("src") || "";
        out += "![" + alt + "](" + src + ")";
      } else if (t === "br") out += "\n";
      else out += inner;
    }
    return out;
  }

  function listToMd(node, depth) {
    let out = "";
    const tag = node.tagName.toLowerCase();
    const marker = tag === "ol" ? "1. " : "- ";
    const pad = "  ".repeat(depth);
    for (const li of node.children) {
      if (li.tagName.toLowerCase() !== "li") continue;
      let line = "";
      for (const child of li.childNodes) {
        if (child.nodeType === 3) {
          line += child.textContent;
        } else if (child.nodeType === 1) {
          const t = child.tagName.toLowerCase();
          if (t === "ul" || t === "ol") {
            out += line.trim() ? pad + marker + line.trim() + "\n" : "";
            out += listToMd(child, depth + 1);
            line = "";
          } else {
            line += inlineToMd(child);
          }
        }
      }
      if (line.trim()) out += pad + marker + line.trim() + "\n";
    }
    return out;
  }

  function blocksToMd(parent) {
    let out = "";
    for (const node of parent.childNodes) {
      if (node.nodeType === 3) {
        const t = node.textContent;
        if (t.trim()) out += t;
        continue;
      }
      if (node.nodeType !== 1) continue;
      const t = node.tagName.toLowerCase();
      if (/^h[1-6]$/.test(t)) {
        out += "\n" + "#".repeat(+t[1]) + " " + inlineToMd(node) + "\n\n";
      } else if (t === "p") {
        out += inlineToMd(node) + "\n\n";
      } else if (t === "ul" || t === "ol") {
        out += "\n" + listToMd(node, 0) + "\n";
      } else if (t === "blockquote") {
        const inner = blocksToMd(node).trim();
        out += "\n" + inner.split("\n").map((l) => "> " + l).join("\n") + "\n\n";
      } else if (t === "pre") {
        const codeEl = node.querySelector("code");
        const code = codeEl ? codeEl.textContent : node.textContent;
        const cls = codeEl && codeEl.className ? String(codeEl.className) : "";
        const langMatch = cls.match(/lang-([\w+-]+)/);
        const lang = langMatch ? langMatch[1] : "";
        out += "\n```" + lang + "\n" + code.replace(/\n+$/, "") + "\n```\n\n";
      } else if (t === "hr") {
        out += "\n---\n\n";
      } else if (t === "img") {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        out += "\n![" + alt + "](" + src + ")\n\n";
      } else if (t === "div" || t === "section" || t === "article" || t === "main") {
        out += blocksToMd(node);
      } else if (t === "br") {
        out += "\n";
      } else {
        out += inlineToMd(node);
      }
    }
    return out;
  }

  root.Markdown = {
    render,
    htmlToMarkdown,
    highlightCode
  };
})();
