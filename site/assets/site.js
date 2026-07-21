/* ConsentLoop site shell: theme, nav, code highlighting, tabs, copy. Zero deps. */
(() => {
  /* ---------- theme ---------- */
  const saved = localStorage.getItem("cl-site-theme");
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;

  window.toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cl-site-theme", next);
    dispatchEvent(new CustomEvent("cl-site-theme", { detail: next }));
  };

  /* ---------- nav ---------- */
  const DOCS = [
    {
      group: "Start here",
      items: [
        ["Getting started", "/docs/"],
        ["Configuration", "/docs/configuration"],
        ["Script & embed gating", "/docs/scripts"],
      ],
    },
    {
      group: "Guides",
      items: [
        ["JavaScript API", "/docs/api"],
        ["Google Consent Mode", "/docs/consent-mode"],
        ["Languages (i18n)", "/docs/i18n"],
        ["React", "/docs/react"],
        ["Headless / custom UI", "/docs/headless"],
      ],
    },
    {
      group: "Platform",
      items: [
        ["Performance", "/docs/performance"],
        ["AI integration", "/docs/ai"],
        ["Managed & regulations", "/docs/managed"],
      ],
    },
  ];

  const path = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
  const norm = (h) => h.replace(/\.html$/, "").replace(/\/index$/, "/");
  const isActive = (href) => norm(href) === path || norm(href) + "/" === path || norm(href) === path + "/";

  const logoSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/></svg>';
  const sunSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>';
  const ghSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8a10.2 10.2 0 0 0-3.22 19.88c.51.1.7-.22.7-.49v-1.7c-2.84.61-3.44-1.37-3.44-1.37-.46-1.18-1.13-1.49-1.13-1.49-.93-.63.07-.62.07-.62 1.03.07 1.57 1.05 1.57 1.05.91 1.57 2.39 1.11 2.98.85.09-.66.36-1.11.65-1.37-2.27-.26-4.65-1.13-4.65-5.04 0-1.11.4-2.02 1.05-2.74-.11-.26-.46-1.3.1-2.7 0 0 .86-.28 2.8 1.05a9.73 9.73 0 0 1 5.1 0c1.95-1.33 2.8-1.05 2.8-1.05.56 1.4.21 2.44.1 2.7.65.72 1.05 1.63 1.05 2.74 0 3.92-2.39 4.78-4.66 5.03.37.32.69.94.69 1.9v2.81c0 .27.19.6.7.49A10.2 10.2 0 0 0 12 1.8Z"/></svg>';

  function topbar() {
    const el = document.createElement("header");
    el.className = "topbar";
    const links = [
      ["Docs", "/docs/"],
      ["Playground", "/playground/"],
      ["Performance", "/docs/performance"],
      ["AI", "/docs/ai"],
    ];
    el.innerHTML = `
      <a class="brand" href="/"><span class="logo">${logoSvg}</span>ConsentLoop</a>
      <nav class="topnav">${links
        .map(([label, href]) => `<a href="${href}" ${isActive(href) || (href === "/docs/" && path.startsWith("/docs")) ? 'class="active"' : ""}>${label}</a>`)
        .join("")}</nav>
      <span class="spacer"></span>
      <div class="right">
        <span class="pill" id="version-pill">v0.1.0</span>
        <button class="iconbtn" title="Toggle theme" aria-label="Toggle theme" onclick="toggleTheme()">${sunSvg}</button>
        <a class="iconbtn" title="GitHub" aria-label="GitHub" href="https://github.com/kocsmy/ConsentLoop" target="_blank" rel="noopener">${ghSvg}</a>
      </div>`;
    document.body.prepend(el);
  }

  function sidebar() {
    const mount = document.querySelector("[data-sidebar]");
    if (!mount) return;
    mount.className = "sidebar";
    mount.innerHTML = DOCS.map(
      (g) => `
      <div class="group">
        <div class="group-title">${g.group}</div>
        ${g.items.map(([label, href]) => `<a href="${href}" ${isActive(href) ? 'class="active"' : ""}>${label}</a>`).join("")}
      </div>`
    ).join("");
  }

  function footer() {
    if (document.querySelector(".footer")) return;
    const el = document.createElement("footer");
    el.className = "footer";
    el.innerHTML = `
      <span>MIT © 2026 ConsentLoop</span>
      <a href="/docs/">Docs</a>
      <a href="/playground/">Playground</a>
      <a href="/llms.txt">llms.txt</a>
      <a href="https://github.com/kocsmy/ConsentLoop" target="_blank" rel="noopener">GitHub</a>
      <span class="muted">Built to win <a href="https://cookiebench.com" target="_blank" rel="noopener">cookiebench.com</a></span>`;
    document.body.appendChild(el);
  }

  /* ---------- tiny syntax highlighter ---------- */
  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function highlight(code, lang) {
    let s = escapeHtml(code);
    if (lang === "html") {
      // order matters: strings first (only escaped quotes exist in source), then tags;
      // never touch plain '"' so injected span markup stays intact
      s = s
        .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-c">$1</span>')
        .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-s">$1</span>')
        .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tok-t">$2</span>')
        .replace(/\s(defer|async|hidden|data-[\w-]+|type|src|id|class|title|loading)(?=[\s=&>])/g, ' <span class="tok-a">$1</span>');
    } else if (lang === "bash") {
      s = s.replace(/^(\$ )?/gm, '<span class="tok-c">$1</span>').replace(/(#.*)$/gm, '<span class="tok-c">$1</span>');
    } else {
      s = s
        .replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span class="tok-c">$1</span>')
        .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;[^&]*?&#39;|`[^`]*`)/g, '<span class="tok-s">$1</span>')
        .replace(/\b(import|from|export|const|let|var|function|return|await|async|new|if|else|true|false|null|undefined|typeof|default)\b/g, '<span class="tok-k">$1</span>')
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-n">$1</span>')
        .replace(/\.(\w+)(?=\()/g, '.<span class="tok-f">$1</span>');
    }
    return s;
  }

  function upgradeCode() {
    document.querySelectorAll("pre[data-lang]").forEach((pre) => {
      const lang = pre.dataset.lang;
      const raw = pre.textContent.replace(/^\n/, "").replace(/\s+$/, "");
      const wrap = document.createElement("div");
      wrap.className = "codeblock";
      if (pre.dataset.tab) wrap.dataset.tab = pre.dataset.tab; // keep tab label for upgradeTabs()
      wrap.innerHTML = `<pre data-lang="${lang}"><code>${highlight(raw, lang)}</code></pre><button class="copy">Copy</button>`;
      wrap.querySelector(".copy").addEventListener("click", (e) => {
        navigator.clipboard.writeText(raw).then(() => {
          e.target.textContent = "Copied ✓";
          e.target.classList.add("done");
          setTimeout(() => {
            e.target.textContent = "Copy";
            e.target.classList.remove("done");
          }, 1400);
        });
      });
      pre.replaceWith(wrap);
    });
  }

  /* tab groups: <div class="tabs" data-tabs><pre data-lang data-tab="Label">..</pre>...</div> */
  function upgradeTabs() {
    document.querySelectorAll("[data-tabs]").forEach((box) => {
      const blocks = [...box.querySelectorAll(".codeblock")];
      const labels = [...box.querySelectorAll("[data-tab]")].map((el) => el.dataset.tab);
      const bar = document.createElement("div");
      bar.className = "tabbar";
      box.prepend(bar);
      blocks.forEach((block, i) => {
        const btn = document.createElement("button");
        btn.textContent = labels[i] || `Tab ${i + 1}`;
        bar.appendChild(btn);
        btn.addEventListener("click", () => {
          blocks.forEach((b, j) => b.classList.toggle("active", i === j));
          [...bar.children].forEach((c, j) => c.classList.toggle("active", i === j));
        });
      });
      blocks[0]?.classList.add("active");
      bar.children[0]?.classList.add("active");
      box.classList.add("tabs");
    });
  }

  window.clSite = { highlight, escapeHtml };

  // favicon for pages that don't declare one
  if (!document.querySelector("link[rel~='icon']")) {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='7' fill='%2317171b'/%3E%3Cpath d='M18 12a6 6 0 1 1-1.76-4.24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round'/%3E%3Cpath d='M18 5.5v3.2h-3.2' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E";
    document.head.appendChild(icon);
  }

  addEventListener("DOMContentLoaded", () => {
    topbar();
    sidebar();
    upgradeCode();
    upgradeTabs();
    footer();
    const meta = window.CL_META;
    if (meta) {
      const pill = document.getElementById("version-pill");
      if (pill) pill.textContent = "v" + meta.version;
      document.querySelectorAll("[data-meta]").forEach((el) => {
        const key = el.dataset.meta;
        if (key === "gzip-loader") el.textContent = meta.gzip.loader + " KB";
        if (key === "gzip-full") el.textContent = meta.gzip.full + " KB";
      });
    }
  });
})();
