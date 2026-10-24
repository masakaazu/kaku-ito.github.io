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
    addHead("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
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
          qid: m.qid || `${stem(m.file)}-`,
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

  const NAV_STYLE = `
    .site-nav, .site-nav * { all: unset; box-sizing: border-box; }
    .site-nav {
      position: relative; z-index: 900;
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px;
      padding: 10px max(16px, calc((100% - var(--theme-page-width, 920px)) / 2));
      padding-top: max(10px, env(safe-area-inset-top));
      border-bottom: 1px solid var(--theme-line);
      background: var(--theme-bg);
      color: var(--theme-muted);
      font: 13px/1.5 var(--theme-font-ui);
      letter-spacing: 0.04em;
      text-align: left;
    }
    .site-nav.site-nav-bottom {
      margin-top: 40px;
      padding-top: 10px;
      padding-bottom: max(10px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--theme-line);
      border-bottom: 0;
    }
    .site-nav ol { display: flex; flex-wrap: wrap; align-items: center; min-width: 0; flex: 1 1 320px; }
    .site-nav li { display: inline-flex; align-items: center; min-width: 0; }
    .site-nav li + li::before { content: "／"; margin: 0 8px; color: var(--theme-faint); }
    .site-nav a { color: color-mix(in srgb, var(--theme-cream) 78%, transparent); font-weight: 600; cursor: pointer; transition: color var(--theme-transition); }
    .site-nav a:hover, .site-nav a:focus-visible { color: var(--theme-cream); text-decoration: underline; text-underline-offset: 3px; }
    .site-nav a:focus-visible { outline: 1px solid var(--theme-cream); outline-offset: 3px; }
    .site-nav [aria-current="page"] { color: var(--theme-cream); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 28em; }
    .site-nav-side { display: inline-flex; align-items: center; gap: 14px; margin-left: auto; white-space: nowrap; }
    .site-nav-count { color: var(--theme-muted); font-variant-numeric: tabular-nums; }
    .site-nav-off { color: color-mix(in srgb, var(--theme-cream) 22%, transparent); font-weight: 600; }
    .site-nav .site-nav-login { padding: 0 10px; border: 1px solid var(--theme-line); border-radius: var(--theme-radius-pill); font-size: 12px; text-decoration: none; }
    .site-nav .site-nav-login.is-in { border-color: var(--theme-good); color: var(--theme-good); }
    @media (max-width: 600px) {
      .site-nav-side { width: 100%; justify-content: space-between; margin-left: 0; }
      .site-nav [aria-current="page"] { max-width: 16em; }
    }
    @media print { .site-nav { display: none; } }
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
      seq = `${link(list[i - 1], "prev", "← 前へ")}<span class="site-nav-count">${i + 1} / ${list.length}</span>${link(list[i + 1], "next", "次へ →")}`;
    }

    const login = path === "login.html" ? "" : `<a class="site-nav-login" href="${url("login.html")}">ログイン</a>`;

    const style = document.createElement("style");
    style.textContent = NAV_STYLE;
    document.head.append(style);

    const nav = document.createElement("nav");
    nav.className = "site-nav";
    nav.setAttribute("aria-label", "サイト内の現在地");
    nav.innerHTML = `<ol>${crumbs}</ol><div class="site-nav-side">${seq}${login}</div>`;
    document.body.prepend(nav);
    loginLinks.push(...nav.querySelectorAll(".site-nav-login"));

    // 前後移動がある教材は、読み終えた位置からも移動できるよう下部にも置く
    if (seq) {
      const bottom = document.createElement("nav");
      bottom.className = "site-nav site-nav-bottom";
      bottom.setAttribute("aria-label", "前後の教材へ移動");
      bottom.innerHTML = `<ol>${crumbs}</ol><div class="site-nav-side">${seq}</div>`;
      document.body.append(bottom);
    }

    // 回答記録のある教材ではログイン状態がすぐ分かる
    if (window.StudySync) {
      window.StudySync.onChange(updateLoginLinks);
      updateLoginLinks(window.StudySync.user());
    }
  };

  /* ---------- 一覧ページの描画 ---------- */

  const card = ({ href, icon, title, desc, arrow, rateKey, extraClass = "" }) => `
    <a class="card ${extraClass}" href="${href}">
      <div class="card-head">
        ${icon ? `<span class="card-icon">${escapeHtml(icon)}</span>` : "<span></span>"}
        ${rateKey ? `<span class="rate" data-rate-item="${escapeHtml(rateKey)}" hidden></span>` : ""}
      </div>
      <h3>${escapeHtml(title)}</h3>
      ${desc ? `<p>${escapeHtml(desc)}</p>` : ""}
      <span class="arrow">${arrow}</span>
    </a>`;

  const materialCard = (site, m, iconText) =>
    card({
      href: url(m.path),
      icon: iconText || site.types[m.type].label,
      title: m.title,
      desc: m.desc,
      arrow: m.type === "note" ? "ノートを開く →" : "教材を開く →",
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
          <span class="arrow">${escapeHtml(info.short)}を開く →</span>
        </a>`;
        })
        .join("")}</div>`,

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
          <div class="grid grid-3">${list.map((m) => materialCard(site, m, m.date ? shortDate(m.date) : "")).join("")}</div>
        </section>`;
        })
        .join("");
    },

    /* 型ごとの全件一覧（例：ノート一覧） */
    "type-list": (site, el) => {
      const list = itemsOf(site, el.dataset.topic, (m) => m.type === el.dataset.type);
      if (!list.length) return `<p class="empty">まだありません。</p>`;
      return `<div class="grid">${list
        .map((m, i) => materialCard(site, m, pad2(i + 1)))
        .join("")}</div>`;
    },

    /* 最近追加した教材（catalog.js の後ろから） */
    latest: (site, el) => {
      const list = itemsOf(site, el.dataset.topic).slice(-Number(el.dataset.count || 5)).reverse();
      if (!list.length) return `<p class="empty">まだありません。</p>`;
      return `<div class="list">${list
        .map((m) => {
          const field = site.fieldByNo.get(m.fields[0]);
          return `
        <a class="list-item" href="${url(m.path)}">
          <span class="list-date">${escapeHtml(site.types[m.type].label)}${field ? `｜${escapeHtml(field.name)}` : ""}</span>
          <span class="list-title">${escapeHtml(m.title)}</span>
          <span class="list-meta">${escapeHtml(m.desc || "")}</span>
          <span class="list-arrow" aria-hidden="true">→</span>
        </a>`;
        })
        .join("")}</div>`;
    },

    /* 日別復習：日付の一覧 */
    days: (site, el) => {
      const topic = el.dataset.topic;
      const days = site.topics[topic].days || {};
      return `<div class="list">${Object.entries(days)
        .map(
          ([date, summary]) => `
        <a class="list-item" href="${url(`${topic}/review/${date}/index.html`)}">
          <span class="list-date">${formatDate(date)}</span>
          <span class="list-title">${escapeHtml(summary)}</span>
          <span class="list-meta">${itemsOf(site, topic, (m) => m.date === date).length}教材</span>
          <span class="list-arrow" aria-hidden="true">→</span>
        </a>`
        )
        .join("")}</div>`;
    },

    /* 日別復習：その日の教材 */
    day: (site, el) => {
      const list = itemsOf(site, el.dataset.topic, (m) => m.date === el.dataset.date);
      if (!list.length) return `<p class="empty">この日の教材は catalog.js に登録されていません。</p>`;
      return `<div class="grid grid-3">${list.map((m, i) => materialCard(site, m, `教材 ${i + 1}`)).join("")}</div>`;
    },

    common: (site) =>
      `<div class="grid">${site.common
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
      return `${group.name}｜${field.major}｜No.${pad2(field.no)}`;
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
    const add = (bucket, key, row) => {
      const s = (bucket[key] ||= { correct: 0, wrong: 0 });
      s.correct += row.correct_count || 0;
      s.wrong += row.wrong_count || 0;
    };
    const prefixed = site.items.slice().sort((a, b) => b.qid.length - a.qid.length);

    rows.forEach((row) => {
      const id = String(row.question_id);
      const direct = id.match(/^([a-z]+)-(\d{1,2})-/);
      const item = prefixed.find((m) => id.startsWith(m.qid));
      if (item) add(byItem, item.path, row);
      if (direct && site.topics[direct[1]]) add(byField, `${direct[1]}:${Number(direct[2])}`, row);
      else if (item && item.fields.length === 1) add(byField, `${item.topic}:${item.fields[0]}`, row);
    });
    return { byItem, byField };
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
      const { byItem, byField } = aggregate(site, await sync.fetchAllStats());
      document.querySelectorAll("[data-rate-item]").forEach((el) => byItem[el.dataset.rateItem] && showRate(el, byItem[el.dataset.rateItem]));
      document.querySelectorAll("[data-rate-field]").forEach((el) => byField[el.dataset.rateField] && showRate(el, byField[el.dataset.rateField]));
      document.querySelectorAll("[data-rate-note]").forEach((el) => (el.hidden = false));
    } catch (error) {
      console.warn("[site] 正答率を取得できませんでした", error);
    }
  };

  /* ---------- 起動 ---------- */

  const init = () => {
    if (!window.SITE_CATALOG) return;
    const site = prepare(window.SITE_CATALOG);
    renderPlaceholders(site);
    renderNav(buildPages(site), currentPath());
    // 一覧ページは正答率を、教材ページはログイン表示だけを更新する
    if (document.querySelector('link[href$="assets/css/site.css"]')) renderRates(site);
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
