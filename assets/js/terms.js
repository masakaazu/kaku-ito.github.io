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
    - 語の意味：Robotic＝ロボットによる／Process＝業務の手順／Automation＝自動化（略語のとき）

  略語（見出しに English の正式名称があるもの）のカードは、
  1回目のタップで正式名称だけ、2回目のタップで用語の意味と語の意味を出す。

    ## 問題演習         → ここから下は手作りの4択問題（任意）
    ### 小分類名         → クイズの「範囲」に使う（上の ## と同じ名前にする）
    #### 問 問題ID
    - 問：…
    - ア：… ／ - イ：… ／ - ウ：… ／ - エ：…
    - 正解：イ
    - 解説：…

  クイズの回答は recordAnswer("ap-20-用語名", 小分類, 正解か) で記録する。
  手作りの問題は、見出しに書いた問題IDのまま記録する（日別復習から移した問題も記録を引き継げる）。
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

  const LABELS = { 意味: "meaning", ポイント: "point", 例: "example", 注: "note", "⚠要確認": "caution", 語の意味: "words" };

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
    let inQuestions = false; // 「## 問題演習」より下
    let qGroup = "";
    let question = null;
    doc.questions = [];

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
      if (/^##\s/.test(line) && /^##\s+問題演習/.test(line)) {
        inMeta = false;
        inQuestions = true;
        question = null;
        return;
      }
      if (inQuestions) {
        if (/^##\s/.test(line)) inQuestions = false;
        else {
          if (/^###\s/.test(line)) {
            qGroup = line.replace(/^###\s+/, "");
            question = null;
          } else if (/^####\s/.test(line)) {
            question = { id: line.replace(/^####\s+(問\s*)?/, "").trim(), section: qGroup, text: "", choices: [], answer: -1, explain: "", notes: [], source: "" };
            doc.questions.push(question);
          } else if (question && /^\s*-\s+/.test(line)) {
            const body = line.replace(/^\s*-\s+/, "");
            // 「アの意味：」のように、選択肢ごとの説明も書ける
            const note = body.match(/^(ア|イ|ウ|エ)の意味[：:]\s*(.*)$/);
            const m = body.match(/^(問|ア|イ|ウ|エ|正解|解説|出典)[：:]\s*(.*)$/);
            if (note) question.notes["アイウエ".indexOf(note[1])] = note[2];
            else if (m && m[1] === "問") question.text = m[2];
            else if (m && m[1] === "出典") question.source = m[2];
            else if (m && m[1] === "正解") question.answer = "アイウエ".indexOf(m[2].trim());
            else if (m && m[1] === "解説") question.explain = m[2];
            else if (m) question.choices.push(m[2]);
          }
          return;
        }
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
        term = { ...parseHeading(line.replace(/^####\s+/, "")), meaning: "", point: "", example: "", note: "", caution: "", words: "", extra: [] };
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
        if (!/^(意味|ポイント|例|注|⚠要確認|語の意味)[：:]/.test(body)) {
          term = { ...parseHeading(body), meaning: "", point: "", example: "", note: "", caution: "", extra: [], nameOnly: true };
          term.section = section.title;
          group.terms.push(term);
          return;
        }
      }
      if (term && /^\s*-\s+/.test(line)) {
        const body = line.replace(/^\s*-\s+/, "");
        const m = body.match(/^(意味|ポイント|例|注|⚠要確認|語の意味)[：:]\s*(.*)$/);
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
    doc.sections.forEach((s) => s.groups.forEach((g) => g.terms.forEach((t) => { t.group = g.title; })));
    doc.terms = doc.sections.flatMap((s) => s.groups.flatMap((g) => g.terms));
    // クイズ・カードには「意味」がある用語だけを使う（重複掲載などは一覧にだけ出す）
    doc.studyTerms = doc.terms.filter((t) => t.meaning && !t.flags.includes("重複"));
    doc.questions = doc.questions.filter((q) => q.id && q.text && q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length);
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

  // 回答記録のID。ほかの分野の用語集から出した用語は、その分野の番号で記録する
  const termId = (term) => `${topic}-${term.field || field}-${term.name}`;

  /* 略語かどうか（英字の見出しに、別の綴りの正式名称が付いている） */
  const isAbbr = (term) => term.english && term.english !== term.name && /^[A-Za-z0-9/.&+\- ]+$/.test(term.name) && /[A-Z]/.test(term.name);

  const wordsLine = (term) => (term.words ? `<p class="term-line"><span class="term-label">語の意味</span>${inline(term.words)}</p>` : "");

  const termBody = (term) => `
    ${term.meaning ? `<p class="term-meaning">${inline(term.meaning)}</p>` : ""}
    ${wordsLine(term)}
    ${term.point ? `<p class="term-line"><span class="term-label">ポイント</span>${inline(term.point)}</p>` : ""}
    ${term.example ? `<p class="term-line"><span class="term-label">例</span>${inline(term.example)}</p>` : ""}
    ${term.note ? `<p class="term-line"><span class="term-label">注</span>${inline(term.note)}</p>` : ""}
    ${term.extra.map((e) => `<p class="term-line">${inline(e)}</p>`).join("")}
    ${term.caution ? `<p class="term-line term-caution"><span class="term-label">要確認</span>${inline(term.caution)}</p>` : ""}`;

  const termHead = (term, tag = "h4", { sub = true } = {}) => `
    <${tag} class="term-name">${escapeHtml(term.name)}${term.flags
      .map((f) => `<span class="term-flag">⚠${escapeHtml(f)}</span>`)
      .join("")}</${tag}>
    ${sub && (term.reading || term.english) ? `<p class="term-sub">${escapeHtml([term.reading, term.english].filter(Boolean).join(" ／ "))}</p>` : ""}`;

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
    stage: 0, // 0＝用語だけ、1＝正式名称（略語のとき）、最後＝意味まで
  };

  // 意味を出したあとのタップで次のカードへ進むか（応用情報だけ）
  const tapToNext = topic === "ap";
  const lastStage = (term) => (isAbbr(term) ? 2 : 1);

  /* 前回間違えたままの用語（回答記録から読む。ログインしていなければ空） */
  const WRONG = "__wrong";
  const wrongIds = new Set();

  const pool = (doc, range) =>
    doc.studyTerms.filter((t) => (range === WRONG ? wrongIds.has(termId(t)) : !range || t.section === range));

  const questionPool = (doc, range) =>
    doc.questions.filter((q) => (range === WRONG ? wrongIds.has(q.id) : !range || q.section === range));

  /* クイズに出す範囲。kind は terms（用語の4択）／questions（問題演習）／mix（まぜる）
     docs は出題する分野の用語集（応用情報は複数の分野をまぜられる） */
  const quizPool = (docs, range, kind) =>
    docs.flatMap((doc) => [
      ...(kind === "questions" ? [] : pool(doc, range).map((term) => ({ term }))),
      ...(kind === "terms" ? [] : questionPool(doc, range).map((question) => ({ question }))),
    ]);

  /* ---------- 複数の分野をまぜたクイズ（応用情報だけ） ---------- */

  const multiField = topic === "ap" && !!field;
  const docsByField = new Map(); // 分野番号 → 読み込んだ用語集
  const quizFields = new Set(field ? [String(Number(field))] : []); // クイズに出す分野（最初はこのページの分野だけ）
  let statsRows = null; // 回答記録（間違えた問題を探すのに使う）

  // 用語・問題に分野の番号と名前を付けておく（記録のIDと、問題の上の表示に使う）
  const tagDoc = (doc, no, name) => {
    doc.field = String(Number(no));
    doc.fieldName = name;
    doc.studyTerms.forEach((t) => {
      t.field = doc.field;
    });
    doc.questions.forEach((q) => {
      q.field = doc.field;
    });
    return doc;
  };

  // 応用情報の用語集の一覧（catalog.js から。まだ読めていなければ空）
  const fieldCatalog = () => {
    const catalog = window.SITE_CATALOG;
    if (!catalog) return [];
    const names = new Map((catalog.fields || []).map((f) => [String(f.no), f.name]));
    const seen = new Set();
    return ((catalog.materials && catalog.materials[topic]) || [])
      .filter((m) => m.type === "terms" && m.fields && m.fields.length && /^terms\/\d+\.html$/.test(m.file))
      .map((m) => ({ no: String(m.fields[0]), name: names.get(String(m.fields[0])) || m.title, src: m.file.replace(/^terms\//, "").replace(/\.html$/, ".md") }))
      .filter((f) => !seen.has(f.no) && seen.add(f.no))
      .sort((a, b) => Number(a.no) - Number(b.no));
  };

  const loadFieldDoc = async (info) => {
    if (docsByField.has(info.no)) return docsByField.get(info.no);
    const response = await fetch(info.src, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${info.src} ${response.status}`);
    const doc = tagDoc(parse(await response.text()), info.no, info.name);
    docsByField.set(info.no, doc);
    collectWrong(doc);
    return doc;
  };

  // いま選んでいる分野のうち、読み込み済みの用語集（分野の番号順）
  const quizDocs = () =>
    [...quizFields]
      .sort((a, b) => Number(a) - Number(b))
      .map((no) => docsByField.get(no))
      .filter(Boolean);

  const isMixed = () => quizFields.size > 1 || (field && !quizFields.has(String(Number(field))));

  // 問題の上に出すラベル。複数の分野をまぜているときは分野名も付ける
  const quizLabel = (item, sectionText) => {
    const f = item.field && docsByField.get(item.field);
    return isMixed() && f ? `${f.fieldName}・${sectionText}` : sectionText;
  };

  const renderCard = (doc) => {
    const box = main.querySelector("[data-cards]");
    const list = cards.order;
    if (!list.length) {
      box.innerHTML = `<p class="terms-empty">${doc.studyTerms.length ? "この範囲に用語がありません。" : "この用語集は用語名だけなので、カードは使えません。一覧で確認してください。"}</p>`;
      return;
    }
    const term = list[cards.index];
    const last = lastStage(term);
    const stage = cards.reveal ? last : cards.stage;
    const open = stage >= last;
    const abbr = isAbbr(term);
    // 略語は 1回目のタップで正式名称だけ、2回目で意味と語の意味。それ以外は 1回で意味
    const fullName = abbr && stage >= 1 ? `<p class="flash-fullname">${escapeHtml(term.english)}</p>` : "";
    const hint = abbr ? (stage === 0 ? "タップして正式名称を表示" : "もう一度タップして意味を表示") : "タップして意味を表示";
    box.innerHTML = `
      <div class="flash ${open ? "is-open" : ""}" tabindex="0" role="button" aria-label="答えを表示">
        <p class="flash-count">${cards.index + 1} / ${list.length}<span>${escapeHtml(term.section)}</span></p>
        ${termHead(term, "h3", { sub: !abbr })}
        ${term.reading && abbr && stage >= 1 ? `<p class="term-sub">${escapeHtml(term.reading)}</p>` : ""}
        ${fullName}
        <div class="flash-body">${open ? termBody(term) : `<p class="flash-hint">${hint}</p>`}</div>
        ${open && tapToNext ? `<p class="flash-next">タップして次の用語へ →</p>` : ""}
      </div>
      <div class="terms-controls">
        <button type="button" class="terms-button" data-move="-1">← 前へ</button>
        <button type="button" class="terms-button" data-move="1">次へ →</button>
      </div>`;
    box.querySelector(".flash").addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      // 応用情報は、意味まで出たカードをもう一度タップすると次の用語へ進む
      if (tapToNext && open) return moveCard(doc, 1);
      cards.stage = cards.stage >= last ? 0 : cards.stage + 1;
      renderCard(doc);
    });
    box.querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", () => moveCard(doc, Number(b.dataset.move))));
  };

  const moveCard = (doc, step) => {
    const n = cards.order.length;
    if (!n) return;
    cards.index = (cards.index + step + n) % n;
    cards.stage = 0;
    renderCard(doc);
  };

  const resetCards = (doc, { random = false } = {}) => {
    const list = pool(doc, main.querySelector("[data-card-range]").value);
    cards.order = random ? shuffle(list) : list;
    cards.index = 0;
    cards.stage = 0;
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
      const docs = multiField ? quizDocs() : [doc];
      const usable = docs.some((d) => d.studyTerms.length || d.questions.length);
      box.innerHTML = `<p class="terms-empty">${!docs.length ? "分野を1つ以上選んでください。" : usable ? "この範囲に問題がありません。" : "選んだ用語集は用語名だけなので、クイズは使えません。"}</p>`;
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
              ? `<p class="quiz-missed-title">間違えた問題</p><ul class="quiz-missed">${quiz.missed.map((m) => `<li>${escapeHtml(m.term ? m.term.name : m.question.text)}</li>`).join("")}</ul>`
              : ""
          }
          <div class="terms-controls">
            <button type="button" class="terms-button is-primary" data-quiz-start>もう一度</button>
            ${quiz.missed.length ? `<button type="button" class="terms-button" data-quiz-retry>間違えた問題だけ</button>` : ""}
          </div>
        </div>`;
      box.querySelector("[data-quiz-start]").addEventListener("click", () => startQuiz(doc));
      const retry = box.querySelector("[data-quiz-retry]");
      if (retry) retry.addEventListener("click", () => startQuiz(doc, quiz.missed));
      return;
    }

    if (quiz.list[quiz.index].question) {
      renderQuestion(doc, box);
      return;
    }
    const q = quiz.list[quiz.index];
    // 誤りの選択肢は、その用語と同じ分野の用語集から選ぶ
    const others = pickDistractors(docsByField.get(q.term.field) || doc, q.term);
    const choices = shuffle([q.term, ...others]);

    box.innerHTML = `
      <div class="quiz-card">
        <p class="flash-count">第${quiz.index + 1}問 / ${quiz.list.length}<span>${escapeHtml(quizLabel(q.term, q.term.section))}</span></p>
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
        else quiz.missed.push(q);
        if (ok) wrongIds.delete(termId(q.term));
        else wrongIds.add(termId(q.term));
        updateWrongOption(doc);

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
          <p class="quiz-others-title">ほかの選択肢</p>
          <ul class="quiz-others">${choices
            .filter((t) => t !== q.term)
            .map((t) => `<li><b>${escapeHtml(t.name)}</b>：${inline(t.meaning)}</li>`)
            .join("")}</ul>
          <div class="terms-controls"><button type="button" class="terms-button is-primary" data-next>次へ →</button></div>`;
        feedback.querySelector("[data-next]").addEventListener("click", () => nextQuestion(doc, box));

        if (window.recordAnswer) {
          window.recordAnswer(termId(q.term), q.term.section || "未分類", ok);
        }
      })
    );
  };

  /* 誤りの選択肢は、まぎらわしいものを優先する。
     同じテーマ（###）＞名前が似ている＞同じ小分類（##）の順に点を付け、点が高いものから選ぶ */
  const nameKey = (t) => t.name.replace(/[（(].*$/, "");
  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const pickDistractors = (doc, term) => {
    const own = bigrams(nameKey(term));
    return doc.studyTerms
      .filter((t) => t !== term && t.name !== term.name)
      .map((t) => {
        let score = Math.random();
        if (t.section === term.section) score += 2;
        if (t.section === term.section && t.group && t.group === term.group) score += 3;
        let shared = 0;
        bigrams(nameKey(t)).forEach((b) => {
          if (own.has(b)) shared += 1;
        });
        score += Math.min(shared, 3) * 1.5;
        // 問題文（意味）に名前が出てくる用語は、正解でないとすぐ分かるので選ばない
        const key = nameKey(t);
        if (key.length > 1 && (term.meaning || "").includes(key)) score -= 20;
        return { t, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.t);
  };

  const nextQuestion = (doc, box) => {
    quiz.index += 1;
    quiz.answered = false;
    renderQuiz(doc);
    box.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  /* 手作りの4択問題（問題演習）。選択肢は書いた順に出す */
  const renderQuestion = (doc, box) => {
    const item = quiz.list[quiz.index];
    const q = item.question;
    const KANA = "アイウエオカ";
    box.innerHTML = `
      <div class="quiz-card">
        <p class="flash-count">第${quiz.index + 1}問 / ${quiz.list.length}<span>${escapeHtml(quizLabel(q, `問題演習${q.section ? `・${q.section}` : ""}`))}</span></p>
        <p class="quiz-question">${inline(q.text)}</p>
        <div class="quiz-choices">${q.choices
          .map((c, i) => `<button type="button" class="quiz-choice" data-choice="${i}">${KANA[i]}　${inline(c)}</button>`)
          .join("")}</div>
        <div class="quiz-feedback" hidden></div>
      </div>`;

    box.querySelectorAll("[data-choice]").forEach((button) =>
      button.addEventListener("click", () => {
        if (quiz.answered) return;
        quiz.answered = true;
        const ok = Number(button.dataset.choice) === q.answer;
        if (ok) quiz.correct += 1;
        else quiz.missed.push(item);
        if (ok) wrongIds.delete(q.id);
        else wrongIds.add(q.id);
        updateWrongOption(doc);

        box.querySelectorAll("[data-choice]").forEach((b) => {
          b.disabled = true;
          if (Number(b.dataset.choice) === q.answer) b.classList.add("is-correct");
          else if (b === button) b.classList.add("is-wrong");
        });

        const feedback = box.querySelector(".quiz-feedback");
        feedback.hidden = false;
        feedback.innerHTML = `
          <p class="quiz-verdict ${ok ? "is-correct" : "is-wrong"}">${ok ? "正解" : `不正解（正解は${KANA[q.answer]}）`}</p>
          ${q.explain ? `<p class="term-meaning">${inline(q.explain)}</p>` : ""}
          ${
            q.notes.some(Boolean)
              ? `<p class="quiz-others-title">選択肢の意味</p><ul class="quiz-others">${q.choices
                  .map((c, i) => (q.notes[i] ? `<li class="${i === q.answer ? "is-answer" : ""}"><b>${KANA[i]}</b>　${inline(q.notes[i])}</li>` : ""))
                  .join("")}</ul>`
              : ""
          }
          ${q.source ? `<p class="quiz-source">出典：${escapeHtml(q.source)}</p>` : ""}
          <div class="terms-controls"><button type="button" class="terms-button is-primary" data-next>次へ →</button></div>`;
        feedback.querySelector("[data-next]").addEventListener("click", () => nextQuestion(doc, box));

        if (window.recordAnswer) window.recordAnswer(q.id, q.section || "問題演習", ok);
      })
    );
  };

  const startQuiz = (doc, only) => {
    const range = main.querySelector("[data-quiz-range]").value;
    const count = Number(main.querySelector("[data-quiz-count]").value);
    const kindSelect = main.querySelector("[data-quiz-kind]");
    const kind = kindSelect ? kindSelect.value : "terms";
    const base = only || quizPool(multiField ? quizDocs() : [doc], range, kind);
    quiz.list = shuffle(base).slice(0, only ? base.length : count || base.length);
    quiz.index = 0;
    quiz.correct = 0;
    quiz.answered = false;
    quiz.missed = [];
    renderQuiz(doc);
  };

  /* 範囲の選択肢に「前に間違えた用語」を足す（1語以上あるときだけ） */
  const updateWrongOption = (doc) => {
    const wrongCount = (docs) => docs.reduce((n, d) => n + pool(d, WRONG).length + questionPool(d, WRONG).length, 0);
    main.querySelectorAll("[data-quiz-range], [data-card-range]").forEach((select) => {
      const count = wrongCount(select.matches("[data-quiz-range]") && multiField ? quizDocs() : [doc]);
      let option = select.querySelector(`option[value="${WRONG}"]`);
      if (!count) {
        if (option && select.value !== WRONG) option.remove();
        if (option && select.value === WRONG) option.textContent = "前に間違えた問題（0問）";
        return;
      }
      if (!option) {
        option = document.createElement("option");
        option.value = WRONG;
        select.insertBefore(option, select.options[1] || null);
      }
      option.textContent = `前に間違えた問題（${count}問）`;
    });
  };

  /* 回答記録から、この用語集で最後の回答が不正解の用語・問題を集める */
  const collectWrong = (doc) => {
    if (!statsRows) return;
    const prefix = `${topic}-${doc.field || field}-`;
    const questionIds = new Set(doc.questions.map((q) => q.id));
    statsRows.forEach((row) => {
      const id = row.question_id;
      if ((id.startsWith(prefix) || questionIds.has(id)) && row.last_answer_correct === false) wrongIds.add(id);
    });
  };

  /* 回答記録を読み、最後の回答が不正解の用語を集める */
  const loadWrong = async (doc) => {
    if (!window.StudySync) return;
    try {
      statsRows = await window.StudySync.fetchAllStats();
      collectWrong(doc);
      docsByField.forEach((d) => collectWrong(d));
    } catch (error) {
      console.error("[terms]", error);
      return;
    }
    updateWrongOption(doc);

    // 復習ページから ?mode=wrong で来たら、間違えた用語だけのクイズを始める
    if (new URLSearchParams(location.search).get("mode") === "wrong" && (pool(doc, WRONG).length || questionPool(doc, WRONG).length)) {
      main.querySelector("[data-quiz-range]").value = WRONG;
      if (main.querySelector("[data-quiz-kind]")) main.querySelector("[data-quiz-kind]").value = "mix";
      main.querySelector("[data-quiz-count]").value = "0";
      setMode("quiz");
      startQuiz(doc);
    }
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

  /* クイズの「分野」選び。チェックを変えるたびに、選んだ分野の用語集を読んでシャッフルし直す */
  const fieldSummary = () => {
    const names = [...quizFields].sort((a, b) => Number(a) - Number(b)).map((no) => {
      const info = fieldCatalog().find((f) => f.no === no);
      return info ? info.name : `分野${no}`;
    });
    if (!names.length) return "分野：未選択";
    if (names.length === 1) return `分野：${names[0]}だけ`;
    if (names.length === 2) return `分野：${names.join("・")}`;
    return `分野：${names.length}分野をまぜる`;
  };

  let fieldLoadSeq = 0;
  const applyFields = async (doc) => {
    const picker = main.querySelector("[data-quiz-fields]");
    if (!picker) return;
    picker.querySelector("summary").textContent = fieldSummary();
    picker.querySelectorAll("[data-field-check]").forEach((c) => (c.checked = quizFields.has(c.value)));
    const status = picker.querySelector("[data-fields-status]");
    const seq = (fieldLoadSeq += 1);
    const need = fieldCatalog().filter((f) => quizFields.has(f.no) && !docsByField.has(f.no));
    if (need.length) status.textContent = "用語集を読み込んでいます…";
    const failed = [];
    await Promise.all(
      need.map((info) =>
        loadFieldDoc(info).catch((error) => {
          console.error("[terms]", error);
          failed.push(info.name);
        })
      )
    );
    if (seq !== fieldLoadSeq) return; // 読み込み中に選び直したら、新しいほうだけ反映する
    status.textContent = failed.length ? `読み込めなかった分野：${failed.join("・")}` : "";
    refreshQuizRange(doc);
    startQuiz(doc);
  };

  // 複数の分野をまぜるときは、小分類の範囲は選べない（「すべて」と「前に間違えた問題」だけ）
  const refreshQuizRange = (doc) => {
    const select = main.querySelector("[data-quiz-range]");
    const mixed = isMixed();
    const keep = select.value;
    select.innerHTML = `<option value="">すべて</option>${
      mixed
        ? ""
        : doc.sections
            .filter((s) => s.title)
            .map((s) => `<option value="${escapeHtml(s.title)}">${escapeHtml(s.title)}</option>`)
            .join("")
    }`;
    if (keep === WRONG || [...select.options].some((o) => o.value === keep)) {
      if (keep === WRONG) {
        const option = document.createElement("option");
        option.value = WRONG;
        select.insertBefore(option, select.options[1] || null);
      }
      select.value = keep;
    }
    updateWrongOption(doc);
  };

  const fillFieldPicker = (doc) => {
    const picker = main.querySelector("[data-quiz-fields]");
    const list = picker && picker.querySelector("[data-fields-list]");
    if (!list || list.children.length) return;
    const fields = fieldCatalog();
    if (!fields.length) {
      list.innerHTML = `<p class="quiz-fields-status">分野の一覧を読み込めませんでした。ページを開き直してください。</p>`;
      return;
    }
    list.innerHTML = fields
      .map(
        (f) => `<label class="quiz-field"><input type="checkbox" data-field-check value="${escapeHtml(f.no)}" ${quizFields.has(f.no) ? "checked" : ""}>
          <span class="quiz-field-no">${String(f.no).padStart(2, "0")}</span>${escapeHtml(f.name)}</label>`
      )
      .join("");
    list.querySelectorAll("[data-field-check]").forEach((c) =>
      c.addEventListener("change", () => {
        if (c.checked) quizFields.add(c.value);
        else quizFields.delete(c.value);
        applyFields(doc);
      })
    );
    picker.querySelector("summary").textContent = fieldSummary();
  };

  const build = (doc) => {
    if (multiField) {
      const own = fieldCatalog().find((f) => f.no === String(Number(field)));
      tagDoc(doc, field, own ? own.name : doc.title);
      docsByField.set(doc.field, doc);
    }
    const rangeOptions = `<option value="">すべて</option>${doc.sections
      .filter((s) => s.title)
      .map((s) => `<option value="${escapeHtml(s.title)}">${escapeHtml(s.title)}</option>`)
      .join("")}`;

    main.innerHTML = `
      <header class="terms-hero">
        <p class="terms-kicker">用語集${field ? `・No.${String(field).padStart(2, "0")}` : ""}</p>
        <h1>${escapeHtml(doc.title.replace(/^(応用|基本)情報技術者試験\s*用語集\s*/, "").replace(/^#\d+\s*/, "").replace(/\s*（[^（）]*シラバス[^（）]*）$/, "").replace(/\s*用語(集|まとめ|一覧)?\s*(（\d+語）)?$/, "").replace(/\s*（\d+語）$/, ""))}</h1>
        <p class="terms-stats">${doc.terms.filter((t) => !t.flags.includes("重複")).length}語${doc.questions.length ? `・問題 ${doc.questions.length}問` : ""}${doc.terms.some((t) => t.flags.includes("要確認")) ? `・⚠要確認 ${doc.terms.filter((t) => t.flags.includes("要確認")).length}語` : ""}</p>
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
        ${
          multiField
            ? `<details class="quiz-fields" data-quiz-fields>
          <summary>分野：この分野だけ</summary>
          <p class="quiz-fields-help">チェックした分野の問題をまぜて、シャッフルで出します。</p>
          <div class="quiz-fields-actions">
            <button type="button" class="terms-button" data-fields-all>すべての分野</button>
            <button type="button" class="terms-button" data-fields-own>この分野だけ</button>
          </div>
          <div class="quiz-fields-list" data-fields-list></div>
          <p class="quiz-fields-status" data-fields-status></p>
        </details>`
            : ""
        }
        <div class="terms-options">
          <label>範囲 <select data-quiz-range>${rangeOptions}</select></label>
          ${
            doc.questions.length || multiField
              ? `<label>出題 <select data-quiz-kind>
            <option value="mix">用語と問題をまぜる</option>
            <option value="terms">用語の4択だけ</option>
            <option value="questions">問題演習だけ</option>
          </select></label>`
              : ""
          }
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
    if (main.querySelector("[data-quiz-kind]")) main.querySelector("[data-quiz-kind]").addEventListener("change", () => startQuiz(doc));

    const picker = main.querySelector("[data-quiz-fields]");
    if (picker) {
      // catalog.js は site.js があとから読み込むので、開いたときに分野の一覧を作る
      picker.addEventListener("toggle", () => picker.open && fillFieldPicker(doc));
      picker.querySelector("[data-fields-all]").addEventListener("click", () => {
        fillFieldPicker(doc);
        fieldCatalog().forEach((f) => quizFields.add(f.no));
        applyFields(doc);
      });
      picker.querySelector("[data-fields-own]").addEventListener("click", () => {
        quizFields.clear();
        quizFields.add(doc.field);
        applyFields(doc);
      });
      const fillWhenReady = (tries = 0) => {
        if (window.SITE_CATALOG) {
          fillFieldPicker(doc);
          const own = fieldCatalog().find((f) => f.no === doc.field);
          if (own) doc.fieldName = own.name;
          picker.querySelector("summary").textContent = fieldSummary();
        } else if (tries < 40) setTimeout(() => fillWhenReady(tries + 1), 250);
      };
      fillWhenReady();
    }

    // カード画面ではキーボードの ← → とスペースで操作できる
    document.addEventListener("keydown", (e) => {
      if (main.querySelector('[data-panel="cards"]').hidden || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") moveCard(doc, 1);
      if (e.key === "ArrowLeft") moveCard(doc, -1);
      if (e.key === " ") {
        e.preventDefault();
        main.querySelector(".flash")?.click();
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
    loadWrong(doc);
  };

  main.innerHTML = `<p class="terms-empty">用語集を読み込んでいます…</p>`;
  // 更新した用語集がすぐ反映されるよう、ブラウザの保存分を使う前に必ずサーバーに確認する
  fetch(src, { cache: "no-cache" })
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
