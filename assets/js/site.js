/*
  サイト共通スクリプト

  - ページ上部のナビバー（パンくず＋前後の教材への移動）を表示する
  - 一覧ページの data-site-list / data-site-text の場所に catalog.js の内容を描画する

  どの階層のページからでも次の1行で読み込める（../ の数だけ階層に合わせる）。
    <script src="../../assets/js/site.js"></script>
  catalog.js が未読込なら自動で読み込む。
*/
(() => {
  const script = document.currentScript;
  const root = new URL("../../", script.src).href;

  // 教材ページ（site.css を使わないページ）には、書体と質感をそろえる共通CSSを足す
  if (!document.querySelector('link[href$="assets/css/site.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = root + "assets/css/content.css";
    document.head.append(link);
  }

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const url = (path) => root + path;

  const formatDate = (iso, withYear = true) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const weekday = "日月火水木金土"[new Date(y, m - 1, d).getDay()];
    return `${withYear ? `${y}年` : ""}${m}月${d}日（${weekday}）`;
  };

  const shortDate = (iso) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${m}月${d}日`;
  };

  const currentPath = () => {
    const base = decodeURIComponent(root);
    let path = decodeURIComponent(location.href.split(/[?#]/)[0]);
    path = path.startsWith(base) ? path.slice(base.length) : "";
    return path === "" || path.endsWith("/") ? `${path}index.html` : path;
  };

  /* catalog.js から、全ページの「タイトル・親・前後関係」を組み立てる */
  const buildPages = (catalog) => {
    const pages = {};
    const sequences = {};
    const add = (path, crumb, parent, sequence) => {
      pages[path] = { path, crumb, parent };
      if (sequence) {
        (sequences[sequence] ||= []).push(path);
        pages[path].sequence = sequence;
      }
    };
    const { topics } = catalog;

    add("index.html", catalog.siteName, null);
    add("index.html#common", "共通教材", "index.html");

    add("fe/index.html", topics.fe.short, "index.html");
    add("fe/wbs/index.html", "学習WBS", "fe/index.html");
    add("fe/review/index.html", "復習教材", "fe/index.html");
    catalog.feReview.forEach((day) => {
      const dayPath = `fe/review/${day.date}/index.html`;
      add(dayPath, shortDate(day.date), "fe/review/index.html");
      day.items.forEach((item) => add(`fe/review/${day.date}/${item.file}`, item.title, dayPath, "fe-review"));
    });

    add("ap/index.html", topics.ap.short, "index.html");
    add("ap/notes/index.html", "知識ストック", "ap/index.html");
    catalog.apNotes.forEach((note) => add(`ap/notes/${note.file}`, note.title, "ap/notes/index.html", "ap-notes"));

    catalog.common.forEach((item) => add(`common/${item.file}`, item.title, "index.html#common"));

    return { pages, sequences };
  };

  const NAV_STYLE = `
    .site-nav, .site-nav * { all: unset; box-sizing: border-box; }
    .site-nav {
      position: relative; z-index: 900;
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px;
      padding: 10px max(16px, calc((100% - 920px) / 2));
      border-bottom: 1px solid rgba(232, 226, 214, 0.16);
      background: #1e1f21;
      color: rgba(232, 226, 214, 0.62);
      font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif;
      letter-spacing: 0.04em;
      text-align: left;
    }
    .site-nav.site-nav-bottom {
      margin-top: 40px;
      border-top: 1px solid rgba(232, 226, 214, 0.16);
      border-bottom: 0;
    }
    .site-nav ol { display: flex; flex-wrap: wrap; align-items: center; min-width: 0; flex: 1 1 320px; }
    .site-nav li { display: inline-flex; align-items: center; min-width: 0; }
    .site-nav li + li::before { content: "／"; margin: 0 8px; color: rgba(232, 226, 214, 0.3); }
    .site-nav a { color: rgba(232, 226, 214, 0.78); font-weight: 600; cursor: pointer; transition: color 0.2s; }
    .site-nav a:hover, .site-nav a:focus-visible { color: #e8e2d6; text-decoration: underline; text-underline-offset: 3px; }
    .site-nav a:focus-visible { outline: 1px solid #e8e2d6; outline-offset: 3px; }
    .site-nav [aria-current="page"] { color: #e8e2d6; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 28em; }
    .site-nav-seq { display: inline-flex; align-items: center; gap: 14px; margin-left: auto; white-space: nowrap; }
    .site-nav-count { color: rgba(232, 226, 214, 0.5); font-variant-numeric: tabular-nums; }
    .site-nav-off { color: rgba(232, 226, 214, 0.22); font-weight: 600; }
    @media (max-width: 600px) {
      .site-nav-seq { width: 100%; justify-content: space-between; margin-left: 0; }
      .site-nav [aria-current="page"] { max-width: 16em; }
    }
    @media print { .site-nav { display: none; } }
  `;

  const renderNav = ({ pages, sequences }, path) => {
    const page = pages[path];
    if (!page || !page.parent) return;

    const chain = [];
    for (let p = page; p; p = pages[p.parent]) chain.unshift(p);

    const crumbs = chain
      .map((p, i) =>
        i === chain.length - 1
          ? `<li aria-current="page">${escapeHtml(p.crumb)}</li>`
          : `<li><a href="${url(p.path)}">${escapeHtml(p.crumb)}</a></li>`
      )
      .join("");

    let seq = "";
    if (page.sequence) {
      const list = sequences[page.sequence];
      const i = list.indexOf(path);
      const link = (target, rel, label) =>
        target
          ? `<a href="${url(target)}" rel="${rel}" title="${escapeHtml(pages[target].crumb)}">${label}</a>`
          : `<span class="site-nav-off">${label}</span>`;
      seq = `<div class="site-nav-seq">${link(list[i - 1], "prev", "← 前へ")}<span class="site-nav-count">${i + 1} / ${list.length}</span>${link(list[i + 1], "next", "次へ →")}</div>`;
    }

    const style = document.createElement("style");
    style.textContent = NAV_STYLE;
    document.head.append(style);

    const nav = document.createElement("nav");
    nav.className = "site-nav";
    nav.setAttribute("aria-label", "サイト内の現在地");
    nav.innerHTML = `<ol>${crumbs}</ol>${seq}`;
    document.body.prepend(nav);

    // 前後移動がある教材は、読み終えた位置からも移動できるよう下部にも置く
    if (seq) {
      const bottom = nav.cloneNode(true);
      bottom.classList.add("site-nav-bottom");
      bottom.setAttribute("aria-label", "前後の教材へ移動");
      document.body.append(bottom);
    }
  };

  /* ---------- 一覧ページの描画 ---------- */

  const card = ({ href, icon, title, desc, arrow }) => `
    <a class="card" href="${href}">
      ${icon ? `<span class="card-icon">${escapeHtml(icon)}</span>` : ""}
      <h3>${escapeHtml(title)}</h3>
      ${desc ? `<p>${escapeHtml(desc)}</p>` : ""}
      <span class="arrow">${arrow}</span>
    </a>`;

  const lists = {
    "fe-review-days": (catalog) =>
      `<div class="list">${catalog.feReview
        .map(
          (day) => `
        <a class="list-item" href="${url(`fe/review/${day.date}/index.html`)}">
          <span class="list-date">${formatDate(day.date)}</span>
          <span class="list-title">${escapeHtml(day.summary)}</span>
          <span class="list-meta">${day.items.length}教材</span>
          <span class="list-arrow" aria-hidden="true">→</span>
        </a>`
        )
        .join("")}</div>`,

    "fe-review-day": (catalog, el) => {
      const day = catalog.feReview.find((d) => d.date === el.dataset.date);
      if (!day) return `<p class="empty">この日の教材は catalog.js に登録されていません。</p>`;
      return `<div class="grid grid-3">${day.items
        .map((item, i) =>
          card({
            href: url(`fe/review/${day.date}/${item.file}`),
            icon: `教材 ${i + 1}`,
            title: item.title,
            desc: item.desc,
            arrow: "教材を開く →",
          })
        )
        .join("")}</div>`;
    },

    "ap-notes": (catalog) =>
      `<div class="grid">${catalog.apNotes
        .map((note, i) =>
          card({
            href: url(`ap/notes/${note.file}`),
            icon: String(i + 1).padStart(2, "0"),
            title: note.title,
            desc: note.desc,
            arrow: "ノートを開く →",
          })
        )
        .join("")}</div>`,

    "ap-notes-latest": (catalog) =>
      `<div class="list">${catalog.apNotes
        .map((note, i) => ({ note, i }))
        .slice(-5)
        .reverse()
        .map(
          ({ note, i }) => `
        <a class="list-item" href="${url(`ap/notes/${note.file}`)}">
          <span class="list-date">No.${String(i + 1).padStart(2, "0")}</span>
          <span class="list-title">${escapeHtml(note.title)}</span>
          <span class="list-meta">${escapeHtml(note.desc)}</span>
          <span class="list-arrow" aria-hidden="true">→</span>
        </a>`
        )
        .join("")}</div>`,

    common: (catalog) =>
      `<div class="grid">${catalog.common
        .map((item) =>
          card({
            href: url(`common/${item.file}`),
            icon: item.icon,
            title: item.title,
            desc: item.desc,
            arrow: "教材を開く →",
          })
        )
        .join("")}</div>`,
  };

  const texts = {
    "fe-exam": (c) => formatDate(c.topics.fe.examDate) || "未定",
    "ap-exam": (c) => formatDate(c.topics.ap.examDate) || "未定",
    "fe-status": (c) => c.topics.fe.status,
    "ap-status": (c) => c.topics.ap.status,
    "fe-review-days": (c) => `${c.feReview.length}日分`,
    "fe-review-count": (c) => `${c.feReview.reduce((n, d) => n + d.items.length, 0)}教材`,
    "ap-notes-count": (c) => `${c.apNotes.length}件`,
    "common-count": (c) => `${c.common.length}件`,
    today: () => new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date()),
  };

  const renderPlaceholders = (catalog) => {
    document.querySelectorAll("[data-site-list]").forEach((el) => {
      const render = lists[el.dataset.siteList];
      if (render) el.innerHTML = render(catalog, el);
    });
    document.querySelectorAll("[data-site-text]").forEach((el) => {
      const render = texts[el.dataset.siteText];
      if (render) el.textContent = render(catalog);
    });
  };

  const init = () => {
    const catalog = window.SITE_CATALOG;
    if (!catalog) return;
    renderPlaceholders(catalog);
    renderNav(buildPages(catalog), currentPath());
  };

  const start = () => {
    if (window.SITE_CATALOG) {
      init();
      return;
    }
    const loader = document.createElement("script");
    loader.src = url("assets/js/catalog.js");
    loader.onload = init;
    document.head.append(loader);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
