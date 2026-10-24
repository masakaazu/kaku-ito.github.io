/*
  用語集ビューア

  用語集の md ファイルを読み込み、「一覧・カード・クイズ」の3つの画面で表示する。
  ページ側は次のように書くだけでよい（ファイル名と同じ名前の .md を読む）。

    <main class="terms" data-topic="ap" data-field="20"></main>
    <script src="../../assets/js/study-sync.js"></script>
    <script src="../../assets/js/terms.js"></script>
    <script src="../../assets/js/site.js"></script>

  md の書き方（Googleドキュメントから md で書き出したものをそのまま使える）
    # タイトル
    - 出典などのメモ（最初の --- まで）
    ## 小分類            → 区切り
    ### まとめ表          → 表や太字の説明をそのまま表示
    ### テーマ名          → 用語のまとまり
    #### 用語（読み / English）⚠要確認
    - 意味：…
    - ポイント：…
    - 例：… ／ 注：… ／ ⚠要確認：…

  クイズの回答は recordAnswer("ap-20-用語名", 小分類, 正解か) で記録する。
*/
(() => {
  const main = document.querySelector("main.terms");
  if (!main) return;

  const topic = main.dataset.topic || "ap";
  const field = main.dataset.field || "";
  const src = main.dataset.src || location.pathname.split("/").pop().replace(/\.html$/, ".md");
  const pdf = main.dataset.pdf || "";

  /* ---------- 小さな道具 ---------- */

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Googleドキュメントの書き出しで付く「\#」「\&」などのエスケープを外す
  const unescape = (text) => text.replace(/\\([\\`*_{}[\]()#+\-.!&:<>|~])/g, "$1");

  // **太字** と [文字](URL) と <URL> だけを HTML にする
  const inline = (text) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/&lt;(https?:[^&\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(`terms:${src}:${key}`);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`terms:${src}:${key}`, JSON.stringify(value));
      } catch (e) {
        /* 保存できなくても動作は続ける */
      }
    },
  };

  /* ---------- md を読み取る ---------- */

  const LABELS = { 意味: "meaning", ポイント: "point", 例: "example", 注: "note", "⚠要確認": "caution" };

  const parseHeading = (raw) => {
    let text = raw.trim();
    const flags = [];
    text = text.replace(/⚠(要確認|重複)/g, (_, f) => {
      flags.push(f);
      return "";
    }).trim();
    const m = text.match(/^(.*?)（([^（）]*)）$/);
    let name = text;
    let reading = "";
    let english = "";
    if (m) {
      name = m[1].trim();
      const parts = m[2].split(" / ");
      if (parts.length >= 2) {
        reading = parts[0].trim();
        english = parts.slice(1).join(" / ").trim();
      } else if (/^[\x20-\x7E]+$/.test(parts[0])) {
        english = parts[0].trim();
      } else {
        reading = parts[0].trim();
      }
    }
    return { name, reading, english, flags };
  };

  const parse = (md) => {
    const lines = md.replace(/\r\n?/g, "\n").split("\n").map((l) => unescape(l.replace(/\s+$/, "")));
    const doc = { title: "", meta: [], sections: [] };
    let section = null;
    let group = null;
    let term = null;
    let summary = null;
    let inMeta = true;
    let tableHead = null; // 「| 用語 | 英語 | 解説 |」形式の表の見出し

    const ensureSection = () => {
      if (!section) {
        section = { title: "", summary: [], groups: [] };
        doc.sections.push(section);
      }
      return section;
    };
    const ensureGroup = () => {
      ensureSection();
      if (!group) {
        group = { title: "", terms: [], notes: [] };
        section.groups.push(group);
      }
      return group;
    };

    lines.forEach((line) => {
      if (!/^\|/.test(line)) tableHead = null;
      if (/^#\s/.test(line)) {
        doc.title = line.replace(/^#\s+/, "");
        return;
      }
      if (/^##\s/.test(line)) {
        inMeta = false;
        section = { title: line.replace(/^##\s+/, ""), summary: [], groups: [] };
        doc.sections.push(section);
        group = null;
        term = null;
        summary = /まとめ/.test(section.title) ? section.summary : null;
        return;
      }
      if (/^###\s/.test(line)) {
        inMeta = false;
        const title = line.replace(/^###\s+/, "");
        term = null;
        if (/まとめ/.test(title)) {
          summary = ensureSection().summary;
          group = null;
        } else {
          summary = null;
          group = { title, terms: [], notes: [] };
          ensureSection().groups.push(group);
        }
        return;
      }
      if (/^####\s/.test(line)) {
        inMeta = false;
        summary = null;
        term = { ...parseHeading(line.replace(/^####\s+/, "")), meaning: "", point: "", example: "", note: "", caution: "", extra: [] };
        term.section = ensureSection().title;
        ensureGroup().terms.push(term);
        return;
      }
      if (/^-{3,}$/.test(line)) {
        inMeta = false;
        summary = null;
        return;
      }
      if (inMeta) {
        if (/^\s*-\s+/.test(line)) doc.meta.push(line.replace(/^\s*-\s+/, ""));
        return;
      }
      if (summary) {
        summary.push(line);
        return;
      }
      // 「| 用語 | 英語 | 解説 |」の表。1行が1用語
      if (/^\|/.test(line)) {
        if (/^\|[\s:|-]+$/.test(line)) return;
        const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        if (!tableHead) {
          tableHead = cells;
          if (!cells.includes("用語")) ensureSection().summary.push(line);
          return;
        }
        if (!tableHead.includes("用語")) {
          ensureSection().summary.push(line);
          return;
        }
        const cell = (label) => cells[tableHead.indexOf(label)] || "";
        let rawName = cell("用語");
        const bare = /\s*⚠\s*$/.test(rawName);
        rawName = rawName.replace(/\s*⚠\s*$/, "");
        const head = parseHeading(rawName);
        if (bare) head.flags.push("要確認");
        const english = cell("英語");
        if (english && english !== head.name && !head.english) head.english = english;
        term = { ...head, meaning: cell("解説") || cell("意味"), point: cell("ポイント"), example: "", note: "", caution: "", extra: [] };
        term.section = ensureSection().title;
        ensureGroup().terms.push(term);
        term = null;
        return;
      }
      // 表や用語の間にある地の文は、テーマの補足として残す
      if (group && line.trim() && !/^\s*-\s+/.test(line) && (!term || term.nameOnly)) {
        group.notes.push(line.trim());
        return;
      }
      // 「### テーマ」の下に「- 用語名」だけが並ぶ形（解説なしの用語一覧）
      if ((!term || term.nameOnly) && group && /^\s*-\s+/.test(line)) {
        const body = line.replace(/^\s*-\s+/, "");
        if (!/^(意味|ポイント|例|注|⚠要確認)[：:]/.test(body)) {
          term = { ...parseHeading(body), meaning: "", point: "", example: "", note: "", caution: "", extra: [], nameOnly: true };
          term.section = section.title;
          group.terms.push(term);
          return;
        }
      }
      if (term && /^\s*-\s+/.test(line)) {
        const body = line.replace(/^\s*-\s+/, "");
        const m = body.match(/^(意味|ポイント|例|注|⚠要確認)[：:]\s*(.*)$/);
        if (m) {
          const key = LABELS[m[1]];
          term[key] = term[key] ? `${term[key]} ${m[2]}` : m[2];
        } else {
          term.extra.push(body);
        }
      }
    });

    doc.sections.forEach((s) => {
      s.groups = s.groups.filter((g) => g.terms.length);
    });
    doc.terms = doc.sections.flatMap((s) => s.groups.flatMap((g) => g.terms));
    // クイズ・カードには「意味」がある用語だけを使う（重複掲載などは一覧にだけ出す）
    doc.studyTerms = doc.terms.filter((t) => t.meaning && !t.flags.includes("重複"));
    return doc;
  };

  /* まとめ表の行（表・太字の段落）を HTML にする */
  const renderSummary = (lines) => {
    const html = [];
    let table = [];
    const flush = () => {
      if (!table.length) return;
      const rows = table
        .filter((row) => !/^\|[\s:|-]+$/.test(row))
        .map((row) =>
          row
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim().replace(/^\*\*(.*)\*\*$/, "$1"))
        );
      const [head, ...body] = rows;
      html.push(
        `<div class="terms-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      table = [];
    };
    lines.forEach((line) => {
      if (/^\|/.test(line)) {
        table.push(line);
        return;
      }
      flush();
      if (line.trim()) html.push(`<p>${inline(line.trim())}</p>`);
    });
    flush();
    return html.join("");
  };

  /* ---------- 画面 ---------- */

  const termId = (term) => `${topic}-${field}-${term.name}`;

  const termBody = (term) => `
    ${term.meaning ? `<p class="term-meaning">${inline(term.meaning)}</p>` : ""}
    ${term.point ? `<p class="term-line"><span class="term-label">ポイント</span>${inline(term.point)}</p>` : ""}
    ${term.example ? `<p class="term-line"><span class="term-label">例</span>${inline(term.example)}</p>` : ""}
    ${term.note ? `<p class="term-line"><span class="term-label">注</span>${inline(term.note)}</p>` : ""}
    ${term.extra.map((e) => `<p class="term-line">${inline(e)}</p>`).join("")}
    ${term.caution ? `<p class="term-line term-caution"><span class="term-label">要確認</span>${inline(term.caution)}</p>` : ""}`;

  const termHead = (term, tag = "h4") => `
    <${tag} class="term-name">${escapeHtml(term.name)}${term.flags
      .map((f) => `<span class="term-flag">⚠${escapeHtml(f)}</span>`)
      .join("")}</${tag}>
    ${term.reading || term.english ? `<p class="term-sub">${escapeHtml([term.reading, term.english].filter(Boolean).join(" ／ "))}</p>` : ""}`;

  const renderList = (doc) =>
    doc.sections
      .map(
        (s) => `
      <section class="terms-section">
        ${s.title ? `<h2>${escapeHtml(s.title)}</h2>` : ""}
        ${s.summary.some((l) => l.trim()) ? `<details class="terms-summary" open><summary>まとめ表</summary>${renderSummary(s.summary)}</details>` : ""}
        ${s.groups
          .map(
            (g) => `
          ${g.title ? `<h3>${escapeHtml(g.title)}</h3>` : ""}
          ${
            g.terms.every((t) => t.nameOnly)
              ? `<ul class="term-chips">${g.terms.map((t) => `<li>${escapeHtml(t.name)}</li>`).join("")}</ul>`
              : `<div class="term-list">${g.terms.map((t) => `<article class="term-card">${termHead(t)}${termBody(t)}</article>`).join("")}</div>`
          }
          ${(g.notes || []).map((n) => `<p class="terms-note">${inline(n)}</p>`).join("")}`
          )
          .join("")}
      </section>`
      )
      .join("");

  /* カード（1画面に1用語） */
  const cards = {
    order: [],
    index: 0,
    reveal: store.get("reveal", false),
    shown: false,
  };

  const pool = (doc, sectionTitle) => doc.studyTerms.filter((t) => !sectionTitle || t.section === sectionTitle);

  const renderCard = (doc) => {
    const box = main.querySelector("[data-cards]");
    const list = cards.order;
    if (!list.length) {
      box.innerHTML = `<p class="terms-empty">${doc.studyTerms.length ? "この範囲に用語がありません。" : "この用語集は用語名だけなので、カードは使えません。一覧で確認してください。"}</p>`;
      return;
    }
    const term = list[cards.index];
    const open = cards.reveal || cards.shown;
    box.innerHTML = `
      <div class="flash ${open ? "is-open" : ""}" tabindex="0" role="button" aria-label="答えを表示">
        <p class="flash-count">${cards.index + 1} / ${list.length}<span>${escapeHtml(term.section)}</span></p>
        ${termHead(term, "h3")}
        <div class="flash-body">${open ? termBody(term) : `<p class="flash-hint">タップして意味を表示</p>`}</div>
      </div>
      <div class="terms-controls">
        <button type="button" class="terms-button" data-move="-1">← 前へ</button>
        <button type="button" class="terms-button" data-move="1">次へ →</button>
      </div>`;
    box.querySelector(".flash").addEventListener("click", () => {
      cards.shown = !cards.shown;
      renderCard(doc);
    });
    box.querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", () => moveCard(doc, Number(b.dataset.move))));
  };

  const moveCard = (doc, step) => {
    const n = cards.order.length;
    if (!n) return;
    cards.index = (cards.index + step + n) % n;
    cards.shown = false;
    renderCard(doc);
  };

  const resetCards = (doc, { random = false } = {}) => {
    const list = pool(doc, main.querySelector("[data-card-range]").value);
    cards.order = random ? shuffle(list) : list;
    cards.index = 0;
    cards.shown = false;
    renderCard(doc);
  };

  /* クイズ（意味を読んで用語を選ぶ4択） */
  const quiz = { list: [], index: 0, correct: 0, answered: false, missed: [] };

  const maskName = (text, term) => {
    let out = text;
    [term.name, term.english].filter((w) => w && w.length > 1).forEach((w) => {
      out = out.split(w).join("＿＿");
    });
    return out;
  };

  const renderQuiz = (doc) => {
    const box = main.querySelector("[data-quiz]");
    if (!quiz.list.length) {
      box.innerHTML = `<p class="terms-empty">${doc.studyTerms.length ? "この範囲に用語がありません。" : "この用語集は用語名だけなので、クイズは使えません。"}</p>`;
      return;
    }
    if (quiz.index >= quiz.list.length) {
      const total = quiz.list.length;
      box.innerHTML = `
        <div class="quiz-result">
          <p class="quiz-score">${quiz.correct} / ${total}</p>
          <p>正答率 ${total ? Math.round((quiz.correct / total) * 100) : 0}%</p>
          ${
            quiz.missed.length
              ? `<p class="quiz-missed-title">間違えた用語</p><ul class="quiz-missed">${quiz.missed.map((t) => `<li>${escapeHtml(t.name)}</li>`).join("")}</ul>`
              : ""
          }
          <div class="terms-controls">
            <button type="button" class="terms-button is-primary" data-quiz-start>もう一度</button>
            ${quiz.missed.length ? `<button type="button" class="terms-button" data-quiz-retry>間違えた用語だけ</button>` : ""}
          </div>
        </div>`;
      box.querySelector("[data-quiz-start]").addEventListener("click", () => startQuiz(doc));
      const retry = box.querySelector("[data-quiz-retry]");
      if (retry) retry.addEventListener("click", () => startQuiz(doc, quiz.missed));
      return;
    }

    const q = quiz.list[quiz.index];
    const candidates = pool(doc, q.term.section).filter((t) => t !== q.term && t.name !== q.term.name);
    const others = shuffle(candidates.length >= 3 ? candidates : doc.studyTerms.filter((t) => t.name !== q.term.name)).slice(0, 3);
    const choices = shuffle([q.term, ...others]);

    box.innerHTML = `
      <div class="quiz-card">
        <p class="flash-count">第${quiz.index + 1}問 / ${quiz.list.length}<span>${escapeHtml(q.term.section)}</span></p>
        <p class="quiz-question">${inline(maskName(q.term.meaning, q.term))}</p>
        <p class="quiz-ask">この説明にあてはまる用語は？</p>
        <div class="quiz-choices">${choices
          .map((t, i) => `<button type="button" class="quiz-choice" data-choice="${i}">${escapeHtml(t.name)}</button>`)
          .join("")}</div>
        <div class="quiz-feedback" hidden></div>
      </div>`;

    box.querySelectorAll("[data-choice]").forEach((button) =>
      button.addEventListener("click", () => {
        if (quiz.answered) return;
        quiz.answered = true;
        const picked = choices[Number(button.dataset.choice)];
        const ok = picked === q.term;
        if (ok) quiz.correct += 1;
        else quiz.missed.push(q.term);

        box.querySelectorAll("[data-choice]").forEach((b) => {
          const t = choices[Number(b.dataset.choice)];
          b.disabled = true;
          if (t === q.term) b.classList.add("is-correct");
          else if (b === button) b.classList.add("is-wrong");
        });

        const feedback = box.querySelector(".quiz-feedback");
        feedback.hidden = false;
        feedback.innerHTML = `
          <p class="quiz-verdict ${ok ? "is-correct" : "is-wrong"}">${ok ? "正解" : "不正解"}</p>
          ${termHead(q.term)}${termBody(q.term)}
          <div class="terms-controls"><button type="button" class="terms-button is-primary" data-next>次へ →</button></div>`;
        feedback.querySelector("[data-next]").addEventListener("click", () => {
          quiz.index += 1;
          quiz.answered = false;
          renderQuiz(doc);
          box.scrollIntoView({ block: "start", behavior: "smooth" });
        });

        if (window.recordAnswer) {
          window.recordAnswer(termId(q.term), q.term.section || "未分類", ok);
        }
      })
    );
  };

  const startQuiz = (doc, only) => {
    const range = main.querySelector("[data-quiz-range]").value;
    const count = Number(main.querySelector("[data-quiz-count]").value);
    const base = only || pool(doc, range);
    quiz.list = shuffle(base)
      .slice(0, only ? base.length : count || base.length)
      .map((term) => ({ term }));
    quiz.index = 0;
    quiz.correct = 0;
    quiz.answered = false;
    quiz.missed = [];
    renderQuiz(doc);
  };

  /* ---------- 組み立て ---------- */

  const MODES = [
    ["list", "一覧"],
    ["cards", "カード"],
    ["quiz", "クイズ"],
  ];

  const setMode = (mode) => {
    if (!MODES.some(([m]) => m === mode)) mode = "list";
    main.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
    main.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== mode));
    store.set("mode", mode);
  };

  const build = (doc) => {
    const rangeOptions = `<option value="">すべて</option>${doc.sections
      .filter((s) => s.title)
      .map((s) => `<option value="${escapeHtml(s.title)}">${escapeHtml(s.title)}</option>`)
      .join("")}`;

    main.innerHTML = `
      <header class="terms-hero">
        <p class="terms-kicker">用語集${field ? `｜No.${String(field).padStart(2, "0")}` : ""}</p>
        <h1>${escapeHtml(doc.title.replace(/^応用情報技術者試験\s*用語集\s*/, "").replace(/^#\d+\s*/, "").replace(/\s*（[^（）]*シラバス[^（）]*）$/, "").replace(/\s*用語(集|まとめ|一覧)?\s*(（\d+語）)?$/, ""))}</h1>
        <p class="terms-stats">${doc.terms.filter((t) => !t.flags.includes("重複")).length}語${doc.terms.some((t) => t.flags.includes("要確認")) ? `・⚠要確認 ${doc.terms.filter((t) => t.flags.includes("要確認")).length}語` : ""}</p>
        ${pdf ? `<p><a class="terms-button" href="${escapeHtml(pdf)}" target="_blank" rel="noopener">図解スライド（PDF）を開く</a></p>` : ""}
        ${doc.meta.length ? `<details class="terms-meta"><summary>出典・書式</summary><ul>${doc.meta.map((m) => `<li>${inline(m)}</li>`).join("")}</ul></details>` : ""}
      </header>

      <div class="terms-tabs" role="tablist">
        ${MODES.map(([m, label]) => `<button type="button" role="tab" data-mode="${m}">${label}</button>`).join("")}
      </div>

      <div data-panel="list">${renderList(doc)}</div>

      <div data-panel="cards" hidden>
        <div class="terms-options">
          <label>範囲 <select data-card-range>${rangeOptions}</select></label>
          <label><input type="checkbox" data-card-reveal ${cards.reveal ? "checked" : ""}> 最初から意味を表示</label>
          <button type="button" class="terms-button" data-card-shuffle>シャッフル</button>
        </div>
        <div data-cards></div>
      </div>

      <div data-panel="quiz" hidden>
        <div class="terms-options">
          <label>範囲 <select data-quiz-range>${rangeOptions}</select></label>
          <label>問題数 <select data-quiz-count>
            <option value="10">10問</option>
            <option value="20">20問</option>
            <option value="0">全部</option>
          </select></label>
          <button type="button" class="terms-button is-primary" data-quiz-new>始める</button>
        </div>
        <div data-quiz></div>
      </div>`;

    main.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

    const cardRange = main.querySelector("[data-card-range]");
    cardRange.addEventListener("change", () => resetCards(doc));
    main.querySelector("[data-card-shuffle]").addEventListener("click", () => resetCards(doc, { random: true }));
    main.querySelector("[data-card-reveal]").addEventListener("change", (e) => {
      cards.reveal = e.target.checked;
      store.set("reveal", cards.reveal);
      renderCard(doc);
    });

    main.querySelector("[data-quiz-new]").addEventListener("click", () => startQuiz(doc));
    main.querySelector("[data-quiz-range]").addEventListener("change", () => startQuiz(doc));

    // カード画面ではキーボードの ← → とスペースで操作できる
    document.addEventListener("keydown", (e) => {
      if (main.querySelector('[data-panel="cards"]').hidden || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") moveCard(doc, 1);
      if (e.key === "ArrowLeft") moveCard(doc, -1);
      if (e.key === " ") {
        e.preventDefault();
        cards.shown = !cards.shown;
        renderCard(doc);
      }
    });

    // スマホでは左右にスワイプして移動
    let touchX = null;
    main.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
    main.addEventListener("touchend", (e) => {
      if (touchX === null || main.querySelector('[data-panel="cards"]').hidden) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 60) moveCard(doc, dx < 0 ? 1 : -1);
    });

    resetCards(doc);
    startQuiz(doc);
    setMode(store.get("mode", "list"));
  };

  main.innerHTML = `<p class="terms-empty">用語集を読み込んでいます…</p>`;
  fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status}`);
      return response.text();
    })
    .then((md) => build(parse(md)))
    .catch((error) => {
      console.error("[terms]", error);
      main.innerHTML = `<p class="terms-empty">用語集（${escapeHtml(src)}）を読み込めませんでした。</p>`;
    });
})();
