/*
  サイト共通スクリプト

  - ページ上部のナビバー（パンくず＋前後の教材への移動＋ログイン）を表示する
  - 一覧ページの data-site-list / data-site-text の場所に catalog.js の内容を描画する
  - ログイン中は、分野マップと教材カードに正答率を表示する
  - スマホのホーム画面に追加したときのアプリ情報（アイコン・オフライン対応）を設定する

  どの階層のページからでも次の1行で読み込める（../ の数だけ階層に合わせる）。
    <script src="../../assets/js/site.js"></script>
  catalog.js が未読込なら自動で読み込む。
*/
(() => {
  const script = document.currentScript;
  const root = new URL("../../", script.src).href;
  const url = (path) => root + path;

  /* ---------- <head> の準備 ---------- */

  const addHead = (tag, attrs) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    document.head.append(el);
    return el;
  };

  // 教材ページ（site.css を使わないページ）には、書体と質感をそろえる共通CSSを足す
  if (!document.querySelector('link[href$="assets/css/site.css"]')) {
    addHead("link", { rel: "stylesheet", href: url("assets/css/content.css") });
  }

  // ホーム画面に追加したときの名前・アイコン・全画面表示
  if (!document.querySelector('link[rel="manifest"]')) {
    addHead("link", { rel: "manifest", href: url("manifest.webmanifest") });
    addHead("link", { rel: "apple-touch-icon", href: url("assets/icons/apple-touch-icon.png") });
  }
  if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
    addHead("link", { rel: "icon", type: "image/png", href: url("assets/icons/icon-192.png") });
    addHead("meta", { name: "apple-mobile-web-app-title", content: "資格学習" });
    addHead("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    addHead("meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" });
  }

  // オフラインでも一度開いたページを見られるようにする（公開URLでのみ動く）
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(url("sw.js")).catch((error) => console.warn("[site] service worker", error));
    });
  }

  /* ---------- 小さな道具 ---------- */

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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

  const pad2 = (n) => String(n).padStart(2, "0");
  const stem = (file) => file.split("/").pop().replace(/\.html$/, "");
  const query = new URLSearchParams(location.search);

  const currentPath = () => {
    const base = decodeURIComponent(root);
    let path = decodeURIComponent(location.href.split(/[?#]/)[0]);
    path = path.startsWith(base) ? path.slice(base.length) : "";
    path = path === "" || path.endsWith("/") ? `${path}index.html` : path;
    // 中分類ページは ?f=番号 までを1ページとして扱う
    if (path.endsWith("/field.html") && query.get("f")) path += `?f=${Number(query.get("f"))}`;
    return path;
  };

  /* ---------- catalog.js の整理 ---------- */

  const prepare = (catalog) => {
    const fieldByNo = new Map(catalog.fields.map((f) => [f.no, f]));
    const typeOrder = Object.keys(catalog.types);
    const items = [];
    Object.entries(catalog.materials).forEach(([topic, list]) => {
      list.forEach((m, index) => {
        items.push({
          ...m,
          topic,
          index,
          path: `${topic}/${m.file}`,
          fields: m.fields || [],
          // 回答記録の問題IDの頭。用語集は「資格-中分類-」、それ以外は「ファイル名-」
          qid: m.qid || (m.type === "terms" && m.fields && m.fields.length ? `${topic}-${m.fields[0]}-` : `${stem(m.file)}-`),
          // 日別復習などから移した問題の元の問題ID（「-」で終わるものは頭が一致すればよい）
          ids: m.ids || [],
        });
      });
    });
    return { ...catalog, fieldByNo, typeOrder, items };
  };

  const itemsOf = (site, topic, filter = () => true) => site.items.filter((m) => m.topic === topic && filter(m));
  const fieldLabel = (field) => `${pad2(field.no)} ${field.name}`;
  const fieldPath = (topic, no) => `${topic}/field.html?f=${no}`;

  /* ---------- ページの親子関係（パンくず・前後移動） ---------- */

  const buildPages = (site) => {
    const pages = {};
    const sequences = {};
    const add = (path, crumb, parent, sequence) => {
      pages[path] = { path, crumb, parent };
      if (sequence) {
        (sequences[sequence] ||= []).push(path);
        pages[path].sequence = sequence;
      }
    };

    add("index.html", site.siteName, null);
    add("index.html#common", "共通教材", "index.html");
    add("login.html", "ログイン", "index.html");

    Object.entries(site.topics).forEach(([topic, info]) => {
      add(`${topic}/index.html`, info.short, "index.html");
      site.fields.forEach((field) => add(fieldPath(topic, field.no), fieldLabel(field), `${topic}/index.html`));
      add(`${topic}/notes/index.html`, "ノート一覧", `${topic}/index.html`);

      if (info.days) {
        add(`${topic}/review/index.html`, "日別復習", `${topic}/index.html`);
        Object.keys(info.days).forEach((date) => add(`${topic}/review/${date}/index.html`, shortDate(date), `${topic}/review/index.html`));
      }

      itemsOf(site, topic).forEach((m) => {
        let parent = `${topic}/index.html`;
        if (m.date) parent = `${topic}/review/${m.date}/index.html`;
        else if (m.type === "note") parent = `${topic}/notes/index.html`;
        else if (m.fields.length) parent = fieldPath(topic, m.fields[0]);
        add(m.path, m.title, parent, `${topic}-${m.type}`);
      });
    });

    site.common.forEach((item) => add(`common/${item.file}`, item.title, "index.html#common"));

    return { pages, sequences };
  };

  /*
    ナビバーの見た目。教材ページは各自のCSSを持つので、all: unset で影響を断ってから書く。
    色・書体などは theme.css の値を使う。
  */
  const NAV_STYLE = `
    .site-nav, .site-nav *, .site-pager, .site-pager * { all: unset; box-sizing: border-box; }
    .site-nav {
      position: relative; z-index: 900; display: block;
      padding: env(safe-area-inset-top) max(var(--theme-gutter, 20px), calc((100% - var(--theme-page-width, 980px)) / 2)) 0;
      background: var(--theme-nav-bg, rgba(255, 255, 255, 0.8));
      -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
      color: var(--theme-muted, #6e6e73);
      font: 400 13px/1.4 var(--theme-font-ui, -apple-system, sans-serif);
      letter-spacing: 0; text-align: left;
    }
    .site-nav-inner { display: flex; align-items: center; gap: 16px; min-height: 48px; }
    .site-nav ol { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; overflow: hidden; }
    .site-nav li { display: inline-flex; align-items: center; min-width: 0; white-space: nowrap; }
    .site-nav li + li::before { content: "›"; margin: 0 10px; color: var(--theme-faint, #86868b); }
    .site-nav a { color: var(--theme-muted, #6e6e73); cursor: pointer; transition: color var(--theme-transition, 0.3s); }
    .site-nav a:hover { color: var(--theme-heading, #1d1d1f); }
    .site-nav a:focus-visible, .site-pager a:focus-visible { outline: 2px solid var(--theme-accent, #0071e3); outline-offset: 3px; border-radius: 4px; }
    .site-nav li:first-child a { color: var(--theme-heading, #1d1d1f); font-weight: 600; }
    .site-nav [aria-current="page"] { color: var(--theme-heading, #1d1d1f); overflow: hidden; text-overflow: ellipsis; }
    .site-nav li:first-child[aria-current="page"] { font-weight: 600; }
    .site-nav-side { display: inline-flex; flex: none; align-items: center; gap: 18px; margin-left: auto; white-space: nowrap; }
    .site-nav-seq { display: inline-flex; align-items: center; gap: 4px; }
    .site-nav-seq a, .site-nav-seq span.site-nav-off { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; font-size: 17px; }
    .site-nav-seq a:hover { background: var(--theme-bg-alt, #f5f5f7); }
    .site-nav-off { color: var(--theme-line, #d2d2d7); }
    .site-nav-count { color: var(--theme-muted, #6e6e73); font-variant-numeric: tabular-nums; }
    .site-nav .site-nav-login { color: var(--theme-link, #0066cc); }
    .site-nav .site-nav-login:hover { color: var(--theme-link, #0066cc); text-decoration: underline; text-underline-offset: 3px; }
    .site-nav .site-nav-login.is-in { color: var(--theme-good, #248a3d); }
    .site-pager {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      width: min(var(--theme-reading-width, 720px), calc(100% - var(--theme-gutter, 20px) * 2));
      margin: 72px auto max(48px, env(safe-area-inset-bottom));
      font: 400 15px/1.45 var(--theme-font-ui, -apple-system, sans-serif); letter-spacing: 0;
    }
    .site-pager a {
      display: flex; flex-direction: column; gap: 4px; padding: 18px 20px;
      border-radius: var(--theme-radius, 14px); background: var(--theme-bg-alt, #f5f5f7);
      color: var(--theme-heading, #1d1d1f); cursor: pointer;
      transition: background-color var(--theme-transition, 0.3s);
    }
    .site-pager a:hover { background: var(--theme-surface-hover, #ebebf0); }
    .site-pager a[rel="next"] { grid-column: 2; text-align: right; }
    .site-pager small { color: var(--theme-muted, #6e6e73); font-size: 12px; }
    .site-pager a[rel="prev"] small::before { content: "‹ "; }
    .site-pager a[rel="next"] small::after { content: " ›"; }
    .site-pager span { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-weight: 600; }
    @media (max-width: 640px) {
      /* スマホでは、ひとつ上の階層へ戻るリンクだけを出す */
      .site-nav li { display: none; }
      .site-nav li.is-parent, .site-nav li:only-child { display: inline-flex; }
      .site-nav li.is-parent::before { content: "‹"; margin: 0 6px 0 0; font-size: 17px; color: var(--theme-link, #0066cc); }
      .site-nav li.is-parent a { color: var(--theme-link, #0066cc); font-weight: 400; overflow: hidden; text-overflow: ellipsis; }
      .site-nav-side { gap: 12px; }
      .site-pager { grid-template-columns: 1fr; }
      .site-pager a[rel="next"] { grid-column: 1; }
    }
    @media print { .site-nav, .site-pager { display: none; } }
  `;

  const loginLinks = [];
  const updateLoginLinks = (user) => {
    loginLinks.forEach((link) => {
      link.textContent = user ? "ログイン中" : "ログイン";
      link.classList.toggle("is-in", Boolean(user));
    });
  };

  const renderNav = ({ pages, sequences }, path) => {
    const page = pages[path];
    if (!page) return;

    const chain = [];
    for (let p = page; p; p = pages[p.parent]) chain.unshift(p);

    const crumbs = chain
      .map((p, i) => {
        if (i === chain.length - 1) return `<li aria-current="page">${escapeHtml(p.crumb)}</li>`;
        const parent = i === chain.length - 2 ? ' class="is-parent"' : "";
        return `<li${parent}><a href="${url(p.path)}">${escapeHtml(p.crumb)}</a></li>`;
      })
      .join("");

    let seq = "";
    let pager = "";
    if (page.sequence && sequences[page.sequence].length > 1) {
      const list = sequences[page.sequence];
      const i = list.indexOf(path);
      const prev = list[i - 1];
      const next = list[i + 1];
      const arrow = (target, rel, label, mark) =>
        target
          ? `<a href="${url(target)}" rel="${rel}" title="${escapeHtml(pages[target].crumb)}" aria-label="${label}">${mark}</a>`
          : `<span class="site-nav-off" aria-hidden="true">${mark}</span>`;
      seq = `<span class="site-nav-seq">${arrow(prev, "prev", "前の教材", "‹")}<span class="site-nav-count">${i + 1} / ${list.length}</span>${arrow(next, "next", "次の教材", "›")}</span>`;
      const block = (target, rel, label) =>
        target ? `<a href="${url(target)}" rel="${rel}"><small>${label}</small><span>${escapeHtml(pages[target].crumb)}</span></a>` : "";
      pager = block(prev, "prev", "前へ") + block(next, "next", "次へ");
    }

    const login = path === "login.html" ? "" : `<a class="site-nav-login" href="${url("login.html")}">ログイン</a>`;

    const style = document.createElement("style");
    style.textContent = NAV_STYLE;
    document.head.append(style);

    const nav = document.createElement("nav");
    nav.className = "site-nav";
    nav.setAttribute("aria-label", "サイト内の現在地");
    nav.innerHTML = `<div class="site-nav-inner"><ol>${crumbs}</ol><div class="site-nav-side">${seq}${login}</div></div>`;
    document.body.prepend(nav);
    loginLinks.push(...nav.querySelectorAll(".site-nav-login"));

    // 前後移動がある教材は、読み終えた位置からも移動できるよう下部にも置く
    if (pager) {
      const bottom = document.createElement("nav");
      bottom.className = "site-pager";
      bottom.setAttribute("aria-label", "前後の教材へ移動");
      bottom.innerHTML = pager;
      document.body.append(bottom);
    }

    // 回答記録のある教材ではログイン状態がすぐ分かる
    if (window.StudySync) {
      window.StudySync.onChange(updateLoginLinks);
      updateLoginLinks(window.StudySync.user());
    }
  };

  /* ---------- 一覧ページの描画 ---------- */

  // 大きなタイル（資格・共通教材など）
  const card = ({ href, icon, title, desc, arrow, extraClass = "" }) => `
    <a class="card ${extraClass}" href="${href}">
      <div class="card-head">
        ${icon ? `<span class="card-icon">${escapeHtml(icon)}</span>` : "<span></span>"}
      </div>
      <h3>${escapeHtml(title)}</h3>
      ${desc ? `<p>${escapeHtml(desc)}</p>` : ""}
      <span class="arrow">${arrow}</span>
    </a>`;

  // 一覧の1行（教材・日付など）
  const row = ({ href, label, title, desc, rateKey, extraClass = "" }) => `
    <a class="list-item ${extraClass}" href="${href}">
      <span class="list-main">
        ${label ? `<span class="list-date">${escapeHtml(label)}</span>` : ""}
        <span class="list-title">${escapeHtml(title)}</span>
        ${desc ? `<span class="list-meta">${escapeHtml(desc)}</span>` : ""}
      </span>
      ${rateKey ? `<span class="rate" data-rate-item="${escapeHtml(rateKey)}" hidden></span>` : ""}
      <span class="list-arrow" aria-hidden="true">›</span>
    </a>`;

  const materialRow = (site, m, label) =>
    row({
      href: url(m.path),
      label: label ?? site.types[m.type].label,
      title: m.title,
      desc: m.desc,
      rateKey: m.type === "note" ? "" : m.path,
    });

  const examText = (info) =>
    info.exams.map((e) => (info.exams.length > 1 ? `${e.label} ${formatDate(e.date)}` : formatDate(e.date))).join("／") || "未定";

  const typeCounts = (site, list) =>
    site.typeOrder
      .map((type) => ({ type, count: list.filter((m) => m.type === type).length }))
      .filter((t) => t.count > 0);

  const lists = {
    /* トップ：資格カード */
    topics: (site) =>
      `<div class="grid">${Object.entries(site.topics)
        .map(([topic, info]) => {
          const counts = typeCounts(site, itemsOf(site, topic))
            .map((t) => `${site.types[t.type].label} ${t.count}`)
            .join("・");
          return `
        <a class="card ${info.active ? "is-active" : ""}" href="${url(`${topic}/index.html`)}">
          <div class="card-head">
            <span class="card-icon">${escapeHtml(info.icon)}</span>
            <span class="status ${info.active ? "status-active" : "status-done"}">${escapeHtml(info.status)}</span>
          </div>
          <h3>${escapeHtml(info.name)}</h3>
          <p>${escapeHtml(examText(info))}<br>${escapeHtml(info.desc)}</p>
          <span class="card-foot">${escapeHtml(counts)}</span>
          <span class="arrow">${escapeHtml(info.short)}を開く</span>
        </a>`;
        })
        .join("")}</div>`,

    /* 資格ページ：間違えた問題（ログイン後に renderWrong が中身を入れる） */
    wrong: () => "",

    /* 資格ページ：分野マップ */
    "field-map": (site, el) => {
      const topic = el.dataset.topic;
      const items = itemsOf(site, topic);
      return site.groups
        .map((group) => {
          const fields = site.fields.filter((f) => f.group === group.id);
          const tiles = fields
            .map((field) => {
              const inField = items.filter((m) => m.fields.includes(field.no));
              const counts = typeCounts(site, inField);
              const body = `
            <span class="field-tile-head">
              <span class="field-no">${pad2(field.no)}</span>
              <span class="rate" data-rate-field="${topic}:${field.no}" hidden></span>
            </span>
            <span class="field-major">${escapeHtml(field.major)}</span>
            <span class="field-name">${escapeHtml(field.name)}</span>
            <span class="field-counts">${
              counts.length
                ? counts.map((t) => `<span>${escapeHtml(site.types[t.type].label)} ${t.count}</span>`).join("")
                : "<span>教材なし</span>"
            }</span>`;
              return inField.length
                ? `<a class="field-tile" href="${url(fieldPath(topic, field.no))}">${body}</a>`
                : `<div class="field-tile is-empty">${body}</div>`;
            })
            .join("");
          const filled = fields.filter((f) => items.some((m) => m.fields.includes(f.no))).length;
          return `
        <div class="field-group">
          <div class="field-group-title">
            <h3>${escapeHtml(group.name)}</h3>
            <span>${filled} / ${fields.length} 分野</span>
          </div>
          <div class="field-grid">${tiles}</div>
        </div>`;
        })
        .join("");
    },

    /* 中分類ページ：型ごとの教材 */
    field: (site, el) => {
      const topic = el.dataset.topic;
      const field = site.fieldByNo.get(Number(query.get("f")));
      if (!field) return `<p class="empty">分野が見つかりません。<a href="${url(`${topic}/index.html`)}">分野マップに戻る</a></p>`;
      const inField = itemsOf(site, topic, (m) => m.fields.includes(field.no));
      if (!inField.length) return `<p class="empty">この分野の教材はまだありません。</p>`;
      return site.typeOrder
        .map((type) => {
          const list = inField.filter((m) => m.type === type);
          if (!list.length) return "";
          return `
        <section class="section">
          <div class="section-title">
            <h2>${escapeHtml(site.types[type].label)}</h2>
            <span>${list.length}件</span>
          </div>
          <div class="list">${list.map((m) => materialRow(site, m, m.date ? shortDate(m.date) : "")).join("")}</div>
        </section>`;
        })
        .join("");
    },

    /* 型ごとの全件一覧（例：ノート一覧） */
    "type-list": (site, el) => {
      const list = itemsOf(site, el.dataset.topic, (m) => m.type === el.dataset.type);
      if (!list.length) return `<p class="empty">まだありません。</p>`;
      return `<div class="list">${list.map((m, i) => materialRow(site, m, pad2(i + 1))).join("")}</div>`;
    },

    /* 最近追加した教材（catalog.js の後ろから） */
    latest: (site, el) => {
      const list = itemsOf(site, el.dataset.topic).slice(-Number(el.dataset.count || 5)).reverse();
      if (!list.length) return `<p class="empty">まだありません。</p>`;
      return `<div class="list">${list
        .map((m) => {
          const field = site.fieldByNo.get(m.fields[0]);
          return materialRow(site, m, `${site.types[m.type].label}${field ? `・${field.name}` : ""}`);
        })
        .join("")}</div>`;
    },

    /* 日別復習：日付の一覧 */
    days: (site, el) => {
      const topic = el.dataset.topic;
      const days = site.topics[topic].days || {};
      return `<div class="list">${Object.entries(days)
        .map(([date, summary]) =>
          row({
            href: url(`${topic}/review/${date}/index.html`),
            label: `${formatDate(date)}・${itemsOf(site, topic, (m) => m.date === date).length}教材`,
            title: summary,
          })
        )
        .join("")}</div>`;
    },

    /* 日別復習：その日の教材 */
    day: (site, el) => {
      const list = itemsOf(site, el.dataset.topic, (m) => m.date === el.dataset.date);
      if (!list.length) return `<p class="empty">この日の教材は catalog.js に登録されていません。</p>`;
      return `<div class="list">${list.map((m, i) => materialRow(site, m, `教材 ${i + 1}`)).join("")}</div>`;
    },

    common: (site) =>
      `<div class="grid">${site.common
        .map((item) =>
          card({
            href: url(`common/${item.file}`),
            icon: item.icon,
            title: item.title,
            desc: item.desc,
            arrow: "教材を開く",
          })
        )
        .join("")}</div>`,
  };

  /* data-site-text="ap:exam" のように「資格:項目」で書く */
  const texts = {
    exam: (site, topic) => examText(site.topics[topic]),
    status: (site, topic) => site.topics[topic].status,
    name: (site, topic) => site.topics[topic].name,
    note: (site, topic) => `${itemsOf(site, topic, (m) => m.type === "note").length}件`,
    terms: (site, topic) => `${itemsOf(site, topic, (m) => m.type === "terms").length}件`,
    quiz: (site, topic) => `${itemsOf(site, topic, (m) => m.type === "quiz").length}件`,
    days: (site, topic) => `${Object.keys(site.topics[topic].days || {}).length}日分`,
    fields: (site, topic) => {
      const used = new Set(itemsOf(site, topic).flatMap((m) => m.fields));
      return `${used.size} / ${site.fields.length} 分野`;
    },
    "field-name": (site) => {
      const field = site.fieldByNo.get(Number(query.get("f")));
      return field ? field.name : "分野";
    },
    "field-label": (site) => {
      const field = site.fieldByNo.get(Number(query.get("f")));
      if (!field) return "";
      const group = site.groups.find((g) => g.id === field.group);
      return `${group.name}・${field.major}・No.${pad2(field.no)}`;
    },
    active: (site) => {
      const active = Object.values(site.topics).find((t) => t.active);
      return active ? active.name : "なし";
    },
    "active-exam": (site) => {
      const active = Object.values(site.topics).find((t) => t.active);
      return active ? examText(active) : "";
    },
    today: () => new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date()),
  };

  const renderPlaceholders = (site) => {
    document.querySelectorAll("[data-site-list]").forEach((el) => {
      const render = lists[el.dataset.siteList];
      if (render) el.innerHTML = render(site, el);
    });
    document.querySelectorAll("[data-site-text]").forEach((el) => {
      const [first, second] = el.dataset.siteText.split(":");
      const render = second ? texts[second] : texts[first];
      if (render) el.textContent = render(site, second ? first : null);
    });

    // data-site-href="active" … いま学習中の資格のページへのリンク
    document.querySelectorAll('[data-site-href="active"]').forEach((el) => {
      const active = Object.entries(site.topics).find(([, t]) => t.active);
      if (active) el.href = url(`${active[0]}/index.html`);
    });

    // 中分類ページは、ページタイトルを分野名にする
    const fieldEl = document.querySelector('[data-site-list="field"]');
    const field = site.fieldByNo.get(Number(query.get("f")));
    if (fieldEl && field) document.title = `${field.name}｜${site.topics[fieldEl.dataset.topic].name}`;
  };

  /* ---------- 正答率（ログイン中だけ） ---------- */

  const loadStudySync = () =>
    new Promise((resolve) => {
      if (window.StudySync) return resolve(window.StudySync);
      const tag = document.createElement("script");
      tag.src = url("assets/js/study-sync.js");
      tag.setAttribute("data-quiet", "");
      tag.onload = () => resolve(window.StudySync || null);
      tag.onerror = () => resolve(null);
      document.head.append(tag);
    });

  /*
    回答記録の問題IDから、教材と中分類を割り出して集計する。
    - "ap-20-PoC" のように「資格-中分類番号-」で始まるIDは、その中分類に入れる
    - それ以外は catalog.js の教材（ファイル名-）に当てはめ、
      その教材の中分類が1つだけなら中分類にも入れる（複数分野の教材は教材カードにだけ出す）
  */
  const aggregate = (site, rows) => {
    const byItem = {};
    const byField = {};
    const wrongByItem = {}; // 最後の回答が不正解の問題ID（教材ごと）
    const add = (bucket, key, row) => {
      const s = (bucket[key] ||= { correct: 0, wrong: 0 });
      s.correct += row.correct_count || 0;
      s.wrong += row.wrong_count || 0;
    };
    const prefixed = site.items.slice().sort((a, b) => b.qid.length - a.qid.length);

    rows.forEach((row) => {
      const id = String(row.question_id);
      const direct = id.match(/^([a-z]+)-(\d{1,2})-/);
      const item =
        site.items.find((m) => m.ids.some((x) => (x.endsWith("-") ? id.startsWith(x) : id === x))) ||
        prefixed.find((m) => id.startsWith(m.qid));
      if (item) add(byItem, item.path, row);
      if (item && row.last_answer_correct === false) (wrongByItem[item.path] ||= []).push(row);
      if (direct && site.topics[direct[1]]) add(byField, `${direct[1]}:${Number(direct[2])}`, row);
      else if (item && item.fields.length === 1) add(byField, `${item.topic}:${item.fields[0]}`, row);
    });
    return { byItem, byField, wrongByItem };
  };

  /*
    資格ページの「間違えた問題」。最後の回答が不正解のままの問題がある教材を並べる。
    用語集は ?mode=wrong で開くと、間違えた用語だけのクイズになる。
  */
  const renderWrong = (site, wrongByItem) => {
    document.querySelectorAll('[data-site-list="wrong"]').forEach((el) => {
      const topic = el.dataset.topic;
      const list = itemsOf(site, topic, (m) => wrongByItem[m.path])
        .map((m) => ({ m, rows: wrongByItem[m.path] }))
        .sort((a, b) => {
          const last = (x) => Math.max(...x.rows.map((r) => Date.parse(r.last_answered_at) || 0));
          return last(b) - last(a);
        });
      const section = el.closest("[data-wrong-section]");
      if (section) section.hidden = false;
      if (!list.length) {
        el.innerHTML = `<p class="empty">間違えたままの問題はありません。</p>`;
        return;
      }
      el.innerHTML = `<div class="list">${list
        .map(({ m, rows }) =>
          row({
            href: url(m.type === "terms" ? `${m.path}?mode=wrong` : m.path),
            label: site.types[m.type].label,
            title: m.title,
            desc: `間違えたまま ${rows.length}${m.type === "terms" ? "語（間違えた用語だけ解く）" : "問"}`,
            extraClass: "is-wrong",
          })
        )
        .join("")}</div>`;
    });
  };

  const showRate = (el, s) => {
    const total = s.correct + s.wrong;
    if (!total) return;
    const rate = Math.round((s.correct / total) * 100);
    el.textContent = `${rate}%`;
    el.title = `正答率 ${rate}%（${total}回答）`;
    el.classList.toggle("is-low", rate < 60);
    el.hidden = false;
  };

  const renderRates = async (site) => {
    if (!document.querySelector("[data-rate-item], [data-rate-field]") && !loginLinks.length) return;
    const sync = await loadStudySync();
    if (!sync) return;
    sync.onChange(updateLoginLinks);
    const user = await sync.ready;
    updateLoginLinks(user);
    if (!user) return;
    try {
      const { byItem, byField, wrongByItem } = aggregate(site, await sync.fetchAllStats());
      renderWrong(site, wrongByItem);
      document.querySelectorAll("[data-rate-item]").forEach((el) => byItem[el.dataset.rateItem] && showRate(el, byItem[el.dataset.rateItem]));
      document.querySelectorAll("[data-rate-field]").forEach((el) => byField[el.dataset.rateField] && showRate(el, byField[el.dataset.rateField]));
      document.querySelectorAll("[data-rate-note]").forEach((el) => (el.hidden = false));
    } catch (error) {
      console.warn("[site] 正答率を取得できませんでした", error);
    }
  };

  /* ---------- スクロールで静かに現れる（一覧ページだけ） ---------- */

  const revealOnScroll = () => {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = [...document.querySelectorAll("main > .hero > *, main > .section, main > [data-site-list] > .section, .field-group")];
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach((el, i) => {
      el.classList.add("reveal");
      // 大見出しまわりは少しずつずらして現す
      if (el.parentElement.classList.contains("hero")) el.style.transitionDelay = `${Math.min(i, 5) * 0.08}s`;
      observer.observe(el);
    });
  };

  /* ---------- 起動 ---------- */

  const init = () => {
    if (!window.SITE_CATALOG) return;
    const site = prepare(window.SITE_CATALOG);
    renderPlaceholders(site);
    renderNav(buildPages(site), currentPath());
    // 一覧ページは正答率を、教材ページはログイン表示だけを更新する
    if (document.querySelector('link[href$="assets/css/site.css"]')) {
      renderRates(site);
      revealOnScroll();
    }
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
