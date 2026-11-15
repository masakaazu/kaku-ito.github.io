/*
  午後（科目B・記述式）の演習

  2つの画面を作る。
    - 1問の画面（ap/pm/2024r06a-1.html）：<main class="pm" data-topic="ap" data-q="2024r06a-1"></main>
      同じ名前の .json（2024r06a-1.json）を読んで、左に問題文・右に設問を並べる（スマホは切り替え）。
    - 一覧（ap/pm/index.html）：<main data-pm-index data-topic="ap"> の中の data-pm-mine / data-pm-grid / data-pm-review に描く。

  読み込み方（1問の画面）：
    <script src="../../assets/js/study-sync.js"></script>
    <script src="../../assets/js/catalog.js"></script>
    <script src="../../assets/js/pm.js"></script>
    <script src="../../assets/js/site.js"></script>

  保存（設計書 §4）
    - 記述の答え・選んだ記号・自己採点・前回の答え … localStorage "pm-answers" に先に書き、ログイン中は pm_answers 表へ送る
      （StudySync.fetchPmAnswers / savePmAnswers。新しいほうを残す。表が無いときはこの端末だけ）
      { "2024r06a-1": { "s1": { a: 答え, g: "good"|"fair"|"bad"|null, ga: 記録した日時, e: 秒, h: 前回まで, t: 更新日時 }, "_": 問い全体 } }
    - メモ … StudyNotes（キー "pm:2024r06a-1:s6-1"・問い全体は "pm:2024r06a-1"）。私の4問 … StudyNotes "pm:choice"（"2,9,10,11"）
    - 自己採点 … 「採点を記録する」で recordAnswer("appm-2024r06a-1-s6-1", "午後 問1 情報セキュリティ", ○なら true)
    - タイマー … この端末だけ（localStorage "pm-timer"）

  JSON の文字列の中の飾り（設計書 §3-4）：[u:1]…[/u] 下線①／[blank:a] 空欄／[ref:u1] 設問から下線への参照／
  [g:s1]…[/g] 設問 s1 の根拠／[ruby:漢字|よみ]／[sup:4]／**強調**。文字はすべてエスケープしてから飾りだけを変換する。
  同じ空欄が本文に2回以上出てもよい（id は pm-blank-a・pm-blank-a-2…。光らせる・飛ぶ・自分の答えの表示は全部に）。
  表の欄の中は "\n" で改行（「・」で始まる行はぶら下げ）。等幅（mono）でない欄は折り返す。10字以内の短い欄は折り返さない。
  箇条書きの項目が「①」「(1)」などの番号で始まるときは、その番号をそのまま使い、2行目以降を番号の後ろにそろえる。

  設問の part（questions[].parts[]）
    kind: "text"（字数つき記述）／"short"（語句・数値）／"choice"（記号を1つ）／"multi"（記号を全て選ぶ。答えは "ア，ウ"）
    label: 見出し（"(1)" "a" "(2) f"）。blank: その part が埋める本文の空欄（記号の part も同じ。古い形の label "a" だけも読む）
    choices: 解答群。設問（questions[]）に置けば設問の頭に、part に置けばその小問の中に出す
    multi の自己採点は自動：答えと全部同じなら ○、合っている記号が1つでもあれば △、無ければ ×
  用語の札は図解を読む画面（reader.js）と同じ作り。用語は ap/terms/NN.md から読む。色は theme.css の値だけを使う。
*/
(function () {
  "use strict";

  const mainQ = document.querySelector("main.pm[data-q]");
  const mainIndex = document.querySelector("[data-pm-index]");
  if (!mainQ && !mainIndex) return;

  const LOG = "[pm]";
  const notes = window.StudyNotes || null;
  const query = new URLSearchParams(location.search);
  const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  const GRADES = { good: "○", fair: "△", bad: "×" };
  const GRADE_NAMES = { good: "合っている", fair: "一部だけ合っている", bad: "外れている" };

  /* ---------- 小さな道具 ---------- */

  const escapeHtml = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inline = (s) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  const pad2 = (n) => String(n).padStart(2, "0");
  const nowIso = () => new Date().toISOString();
  // 字数：句読点も1字、全角・半角とも1字。改行は数えない
  const countChars = (s) => [...String(s || "").replace(/[\r\n]/g, "")].length;
  const clock = (ms) => {
    const sec = Math.floor(Math.abs(ms) / 1000);
    return `${Math.floor(sec / 60)}:${pad2(sec % 60)}`;
  };
  const shortDate = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}月${d.getDate()}日`;
  };
  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;

  const catalog = window.SITE_CATALOG || null;
  const topicOf = (main) => (main && main.dataset.topic) || "ap";
  const pmInfo = (topic) => (catalog && catalog.topics[topic] && catalog.topics[topic].pm) || { questions: [], exams: [] };

  // "2024r06a" → "R6秋"（catalog に無い回でも名前を作る）
  const examShort = (topic, id) => {
    const exam = pmInfo(topic).exams.find((e) => e.id === id);
    if (exam) return exam.short;
    const m = String(id).match(/r(\d{2})([ah])$/);
    return m ? `R${Number(m[1])}${m[2] === "a" ? "秋" : "春"}` : String(id);
  };
  // 設問の名前（"s6-1" → "設問6(1)"、"s3-a" → "設問3 a"）
  const partName = (id) => {
    const m = String(id).match(/^s(\d+)(?:-(.+))?$/);
    if (!m) return id;
    return `設問${m[1]}${m[2] ? (/^\d+$/.test(m[2]) ? `(${m[2]})` : ` ${m[2]}`) : ""}`;
  };

  /* ---------- 用語（reader.js と同じ読み方。md の見出し・意味・たとえ・ポイント） ---------- */

  const parseTerms = (md) => {
    const terms = [];
    let term = null;
    for (const raw of md.split(/\r?\n/)) {
      const line = raw.trim();
      if (/^##\s+問題演習/.test(line)) break;
      const head = line.match(/^####\s+(.+)$/);
      if (head) {
        const m = head[1].match(/^(.*?)（(.*)）$/);
        const name = (m ? m[1] : head[1]).trim();
        const sub = m ? m[2] : "";
        term = { name, sub, meaning: "", analogy: "", point: "" };
        const abbr = sub.match(/(?:^|\/)\s*([A-Za-z0-9][A-Za-z0-9./+-]{1,12})\s*[:：]/);
        term.keys = [name];
        if (abbr && abbr[1] !== name) term.keys.push(abbr[1]);
        terms.push(term);
        continue;
      }
      if (/^#{1,3}\s/.test(line)) {
        term = null;
        continue;
      }
      if (!term) continue;
      const item = line.match(/^-\s*(意味|たとえ|ポイント)[：:]\s*(.*)$/);
      if (item) term[{ 意味: "meaning", たとえ: "analogy", ポイント: "point" }[item[1]]] = item[2];
    }
    return terms.filter((t) => t.meaning);
  };

  const termPanel = (term) => `
    <div class="reader-term-panel">
      <p class="reader-term-name">${escapeHtml(term.name)}${term.sub ? `<span>${escapeHtml(term.sub)}</span>` : ""}</p>
      <p class="term-meaning">${inline(term.meaning)}</p>
      ${term.analogy ? `<p class="term-line term-analogy"><span class="term-label">たとえ</span>${inline(term.analogy)}</p>` : ""}
      ${term.point ? `<p class="term-line"><span class="term-label">ポイント</span>${inline(term.point)}</p>` : ""}
    </div>`;

  // 試験の言い回し（窃取・抜粋など）は、読みと意味だけ
  const wordPanel = (word) => `
    <div class="reader-term-panel">
      <p class="reader-term-name">${escapeHtml(word.w)}${word.r ? `<span>${escapeHtml(word.r)}</span>` : ""}</p>
      <p class="term-meaning">${inline(word.m)}</p>
    </div>`;

  /* ---------- 答えの保存（端末 → ログイン中は pm_answers） ---------- */

  const Store = (() => {
    const LS = "pm-answers";
    let data = {};
    try {
      data = JSON.parse(localStorage.getItem(LS)) || {};
    } catch (error) {
      data = {};
    }
    let cloud = false;
    const queue = new Set();
    let pushTimer = null;
    const listeners = [];

    const write = () => {
      try {
        localStorage.setItem(LS, JSON.stringify(data));
      } catch (error) {
        /* 保存できない環境では、開いている間だけ有効 */
      }
    };
    const emit = (state) => listeners.forEach((fn) => fn(state));
    const blank = () => ({ a: "", g: null, ga: null, e: null, h: [], t: "" });
    const toRow = (q, p) => {
      const r = data[q][p];
      return {
        question_key: q,
        part_id: p,
        answer: String(r.a || "").slice(0, 2000),
        grade: r.g || null,
        graded_at: r.ga || null,
        elapsed_sec: r.e == null ? null : Math.max(0, Math.round(r.e)),
        history: (r.h || []).slice(0, 10),
        updated_at: r.t,
      };
    };
    const fromRow = (row) => ({
      a: row.answer || "",
      g: row.grade || null,
      ga: row.graded_at ? new Date(row.graded_at).toISOString() : null,
      e: row.elapsed_sec == null ? null : row.elapsed_sec,
      h: Array.isArray(row.history) ? row.history : [],
      t: new Date(row.updated_at).toISOString(),
    });

    const flush = async () => {
      clearTimeout(pushTimer);
      pushTimer = null;
      if (!cloud || !queue.size || !window.StudySync) return;
      const keys = [...queue];
      queue.clear();
      const rows = keys.map((k) => {
        const [q, p] = k.split("\n");
        return toRow(q, p);
      });
      try {
        await window.StudySync.savePmAnswers(rows);
        emit("synced");
      } catch (error) {
        console.warn(LOG, "答えを同期できませんでした（この端末には保存してある）", error);
        keys.forEach((k) => queue.add(k));
        emit("local");
      }
    };
    const schedule = () => {
      if (cloud && !pushTimer) pushTimer = setTimeout(flush, 3000);
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });

    return {
      get: (q, p) => (data[q] && data[q][p]) || null,
      partsOf: (q) => data[q] || {},
      keys: () => Object.keys(data),
      set: (q, p, change) => {
        const cur = (data[q] ||= {})[p] || blank();
        data[q][p] = { ...cur, ...change, t: nowIso() };
        write();
        if (cloud) {
          queue.add(`${q}\n${p}`);
          schedule();
          emit("pending");
        } else emit("local");
      },
      flush,
      cloud: () => cloud,
      onChange: (fn) => listeners.push(fn),
      // クラウドと端末の答えを、新しいほうに合わせる。q を省くと全部。変わったら true
      pull: async (q) => {
        cloud = false;
        const sync = window.StudySync;
        if (!sync || !sync.fetchPmAnswers) return false;
        let rows;
        try {
          rows = await sync.fetchPmAnswers(q);
        } catch (error) {
          console.warn(LOG, "答えの同期は使えません（この端末にだけ保存します）", error);
          return false;
        }
        if (!rows) return false; // 未ログイン
        let changed = false;
        const remote = {};
        rows.forEach((row) => {
          const r = fromRow(row);
          remote[`${row.question_key}\n${row.part_id}`] = r.t;
          const local = data[row.question_key] && data[row.question_key][row.part_id];
          if (!local || r.t > local.t) {
            (data[row.question_key] ||= {})[row.part_id] = r;
            changed = true;
          }
        });
        Object.keys(data)
          .filter((key) => !q || key === q)
          .forEach((key) =>
            Object.keys(data[key]).forEach((p) => {
              const id = `${key}\n${p}`;
              if (data[key][p].t && (!remote[id] || data[key][p].t > remote[id])) queue.add(id);
            })
          );
        write();
        cloud = true;
        if (queue.size) flush();
        return changed;
      },
    };
  })();

  /* ---------- メモ（reader.js と同じ部品。terms.css の .memo） ---------- */

  const memoInner = (key, label) => {
    const body = notes ? notes.get(key) : "";
    return body
      ? `<p class="memo-text">${escapeHtml(body).replace(/\n/g, "<br>")}</p><button type="button" class="memo-edit" data-memo-edit>メモを直す</button>`
      : `<button type="button" class="memo-edit" data-memo-edit>${escapeHtml(label || "メモを書く")}</button>`;
  };
  const memoBlock = (key, label) =>
    notes ? `<div class="memo" data-memo-key="${escapeHtml(key)}" data-memo-label="${escapeHtml(label || "")}">${memoInner(key, label)}</div>` : "";

  const setupMemos = (root) => {
    if (!notes) return;
    const close = (box, save) => {
      const area = box.querySelector("textarea");
      if (area && save) notes.set(box.dataset.memoKey, area.value);
      box.innerHTML = memoInner(box.dataset.memoKey, box.dataset.memoLabel);
    };
    root.addEventListener("click", (e) => {
      const box = e.target.closest("[data-memo-key]");
      if (!box) return;
      if (e.target.closest("[data-memo-edit]")) {
        box.innerHTML = `
          <textarea class="memo-input" rows="3" placeholder="気づいたこと・覚え方・次に気をつけることなど">${escapeHtml(notes.get(box.dataset.memoKey))}</textarea>
          <div class="memo-actions">
            <button type="button" class="terms-button is-primary" data-memo-save>保存</button>
            <button type="button" class="terms-button" data-memo-cancel>やめる</button>
            <span class="memo-where">${notes.synced() ? "ほかの端末にも同期されます" : "この端末に保存されます"}</span>
          </div>`;
        const area = box.querySelector("textarea");
        area.focus();
        area.setSelectionRange(area.value.length, area.value.length);
      } else if (e.target.closest("[data-memo-save]")) close(box, true);
      else if (e.target.closest("[data-memo-cancel]")) close(box, false);
    });
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || !e.target.matches(".memo-input")) return;
      close(e.target.closest("[data-memo-key]"), true);
    });
    notes.onChange(() => {
      root.querySelectorAll("[data-memo-key]").forEach((box) => {
        if (!box.querySelector("textarea")) box.innerHTML = memoInner(box.dataset.memoKey, box.dataset.memoLabel);
      });
    });
  };

  /* ---------- 回答記録（quiz_results）を読む。未ログイン・失敗は [] ---------- */

  const fetchStats = async () => {
    const sync = window.StudySync;
    if (!sync || !sync.fetchAllStats) return [];
    try {
      const user = await sync.ready;
      return user ? await sync.fetchAllStats() : [];
    } catch (error) {
      console.warn(LOG, "回答記録を読めませんでした", error);
      return [];
    }
  };

  // ログインの状態が変わったら（最初の1回を含む）呼ぶ
  const onUser = (fn) => {
    const sync = window.StudySync;
    if (!sync) return;
    let last;
    const run = (user) => {
      const id = user ? user.id : null;
      if (id === last) return;
      last = id;
      fn(user);
    };
    sync.onChange(run);
    sync.ready.then(run);
  };

  /* =====================================================================
     1問の画面
     ===================================================================== */

  const buildQuestion = async (main) => {
    const topic = topicOf(main);
    const key = main.dataset.q;
    const mode = query.get("mode") || "";

    main.innerHTML = `<p class="pm-loading">読み込んでいます…</p>`;
    let Q;
    try {
      const res = await fetch(`${key}.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      Q = await res.json();
    } catch (error) {
      console.error(LOG, "問題を読めませんでした", error);
      main.innerHTML = `
        <div class="pm-missing">
          <p class="pm-kicker">午後の演習</p>
          <h1>この問題は、まだ読み込めません</h1>
          <p>中身のファイル（${escapeHtml(key)}.json）が無いか、壊れています。</p>
          <p><a class="terms-button" href="index.html">午後の演習の一覧へ</a></p>
        </div>`;
      return;
    }

    const questions = Q.questions || [];
    const allParts = questions.flatMap((q) => (q.parts || []).map((p) => ({ ...p, q })));
    const partById = new Map(allParts.map((p) => [p.id, p]));
    const figById = new Map((Q.figures || []).map((f) => [f.id, f]));
    const tblById = new Map((Q.tables || []).map((t) => [t.id, t]));
    const short = `${examShort(topic, Q.exam)} 問${Q.no}`;
    const category = `午後 問${Q.no} ${Q.area || ""}`.trim();
    const qid = (pid) => `appm-${key}-${pid}`;
    const pages = Q.pages || [];

    // 記号を選ぶ part（choice は1つ、multi は全て選ぶ）
    const isPick = (p) => p.kind === "choice" || p.kind === "multi";
    // その part が埋める本文の空欄（blank。古い形の記号の part は label "a" だけで空欄を表していた）
    const blankOf = (p) => p.blank || (isPick(p) && /^[a-z]$/.test(p.label || "") ? p.label : "");
    // multi の答え "ア，ウ" ⇔ ["ア", "ウ"]
    const choicesOf = (p) => p.choices || p.q.choices || {};
    const splitMarks = (s) => String(s || "").split(/[，,、・\s]+/).filter(Boolean);
    // 下線 → それを問う設問
    const asksOfU = {};
    questions.forEach((q) => {
      [q.text, ...(q.parts || []).map((p) => p.text)].forEach((t) => {
        String(t || "").replace(/\[ref:(u\d+)\]/g, (_, u) => {
          (asksOfU[u] ||= new Set()).add(q.no);
          return "";
        });
      });
    });

    const shortCaption = (cap) => String(cap || "").split(/[\s　]/)[0];
    const refLabel = (r) => {
      const u = r.match(/^u(\d+)$/);
      if (u) return `下線${CIRCLED[Number(u[1]) - 1] || u[1]}`;
      if (figById.has(r)) return shortCaption(figById.get(r).caption) || "図";
      if (tblById.has(r)) return shortCaption(tblById.get(r).caption) || "表";
      if (/^[a-z]$/.test(r)) return `空欄 ${r}`;
      return "本文";
    };
    const targetId = (r) => {
      if (/^u\d+$/.test(r)) return `pm-u${r.slice(1)}`;
      if (/^[a-z]$/.test(r)) return `pm-blank-${r}`;
      if (/^blank-[a-z]$/.test(r)) return `pm-${r}`;
      if (figById.has(r) || tblById.has(r)) return `pm-x-${r}`;
      return `pm-${r}`;
    };

    // 文字列の飾りを HTML にする。ctx は "body"（問題文）か "q"（設問・考え方）
    const blankSeen = {}; // 同じ空欄が本文に何回出たか（2回目からは id に -2, -3 を付ける）
    const deco = (text, ctx) => {
      let h = escapeHtml(text);
      h = h.replace(/\[ruby:([^|\]]+)\|([^\]]+)\]/g, "<ruby>$1<rt>$2</rt></ruby>");
      h = h.replace(/\[sup:([^\]]+)\]/g, "<sup>$1</sup>");
      h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      h = h.replace(/\[u:(\d+)\]/g, (_, n) =>
        ctx === "body"
          ? `<span class="pm-u" id="pm-u${n}" data-u="u${n}" tabindex="0" role="button" aria-label="下線${CIRCLED[n - 1] || n}"><span class="pm-u-no">${CIRCLED[n - 1] || n}</span><span class="pm-u-text">`
          : `<span class="pm-u-text">`
      );
      h = h.replace(/\[\/u\]/g, ctx === "body" ? "</span></span>" : "</span>");
      h = h.replace(/\[g:([^\]]+)\]/g, (_, ids) =>
        ctx === "body" ? `<span class="pm-g" data-g="${ids.split(",").map((x) => x.trim()).join(" ")}">` : "<span>"
      );
      h = h.replace(/\[\/g\]/g, "</span>");
      h = h.replace(/\[blank:([a-z]+)\]/g, (_, b) =>
        ctx === "body"
          ? `<span class="pm-blank" id="pm-blank-${b}${(blankSeen[b] = (blankSeen[b] || 0) + 1) > 1 ? `-${blankSeen[b]}` : ""}" data-blank="${b}"><span class="pm-blank-label">${b}</span><span class="pm-blank-fill" data-blank-fill="${b}"></span></span>`
          : `<button type="button" class="pm-blank is-q" data-goto="${b}" aria-label="空欄 ${b} を本文で見る"><span class="pm-blank-label">${b}</span></button>`
      );
      h = h.replace(/\[ref:([\w-]+)\]/g, (_, r) => `<button type="button" class="pm-ref" data-goto="${r}">${escapeHtml(refLabel(r))}</button>`);
      return h;
    };

    /* ----- 問題文 ----- */

    const figureHtml = (f) => `
      <figure class="pm-figure" id="pm-x-${escapeHtml(f.id)}">
        <button type="button" class="pm-fig-open" data-zoom="${escapeHtml(f.file)}" aria-label="${escapeHtml(f.caption || "図")}を拡大する">
          <img src="${escapeHtml(f.file)}" alt="${escapeHtml(f.alt || f.caption || "")}" loading="lazy">
        </button>
        ${f.caption ? `<figcaption>${deco(f.caption, "body")}</figcaption>` : ""}
      </figure>`;

    // 表の欄：等幅（is-mono）は折り返さない。10字以内の短い欄（項番・「T 中」など）も折り返さない。
    // ほかは折り返し、最小幅を持たせる（is-wrap）。"\n" で改行し、「・」で始まる行はぶら下げにする
    const cellHtml = (tag, c, isMono) => {
      const text = String(c == null ? "" : c);
      const lines = text.split("\n");
      const plainLen = [...text.replace(/\[(?:\/?[a-z]+)(?::[^\]]*)?\]/g, "")].length;
      const cls = isMono ? "is-mono" : lines.length === 1 && plainLen <= 10 ? "is-short" : "is-wrap";
      const inner =
        lines.length === 1
          ? deco(text, "body")
          : lines.map((x) => `<span class="pm-cell-line${/^・/.test(x) ? " is-bullet" : ""}">${deco(x, "body")}</span>`).join("");
      return `<${tag} class="${cls}">${inner}</${tag}>`;
    };
    const tableHtml = (t) => {
      const mono = new Set(t.mono || []);
      return `
      <div class="pm-table-block" id="pm-x-${escapeHtml(t.id)}">
        ${t.caption ? `<p class="pm-table-caption">${deco(t.caption, "body")}</p>` : ""}
        <div class="pm-table">
          <table>
            ${t.head ? `<thead><tr>${t.head.map((c, i) => cellHtml("th", c, mono.has(i))).join("")}</tr></thead>` : ""}
            <tbody>${(t.rows || [])
              .map((r, ri) => {
                const g = Object.entries(t.ground || {}).filter(([, rows]) => (rows || []).includes(ri)).map(([pid]) => pid);
                return `<tr${g.length ? ` class="pm-g" data-g="${escapeHtml(g.join(" "))}"` : ""}>${r.map((c, i) => cellHtml("td", c, mono.has(i))).join("")}</tr>`;
              })
              .join("")}</tbody>
          </table>
        </div>
        ${t.note ? `<p class="pm-table-note">${deco(t.note, "body")}</p>` : ""}
      </div>`;
    };

    // 箇条書き。項目は文字列か { text, p:[段落…], mark, list:[入れ子の項目…] }
    // 「・」は記号を付ける。番号の箇条書きは、原文の番号を本文に書いてあればそのまま、無ければ 1. 2. と振る
    const listHtml = (items, mark, cls, attrs) => {
      const numbered = (mark || "・") !== "・";
      const textOf = (t) => (typeof t === "string" ? t : (t && t.text) || "");
      const own = items.every((t) => /^\s*(?:[（(]?[0-9０-９]+[)）.．]|[①-⑳])/.test(textOf(t)));
      const circled = own && items.every((t) => /^\s*[①-⑳]/.test(textOf(t)));
      const tag = numbered && !own ? "ol" : "ul";
      const item = (t) => {
        if (typeof t === "string") return `<li>${deco(t, "body")}</li>`;
        return `<li>${deco(t.text || "", "body")}${(t.p || []).map((x) => `<p class="pm-li-p">${deco(x, "body")}</p>`).join("")}${
          t.list && t.list.length ? listHtml(t.list, t.mark, "pm-list is-sub", "") : ""
        }</li>`;
      };
      return `<${tag} class="${cls}${numbered ? (own ? " is-own" : " is-num") : ""}${numbered && circled ? " is-circled" : ""}"${attrs}>${items.map(item).join("")}</${tag}>`;
    };

    const blockHtml = (b) => {
      const id = escapeHtml(b.id || "");
      if (b.h != null) return `<h3 class="pm-block pm-h" id="pm-${id}">${deco(b.h, "body")}</h3>`;
      if (b.p != null) return `<p class="pm-block pm-p" id="pm-${id}">${deco(b.p, "body")}</p>`;
      if (b.note != null) return `<p class="pm-block pm-note" id="pm-${id}">${deco(b.note, "body")}</p>`;
      if (b.list) return listHtml(b.list, b.mark, `pm-block pm-list`, ` id="pm-${id}"`);
      if (b.fig) {
        const f = figById.get(b.fig);
        return `<div class="pm-block" id="pm-${id}">${f ? figureHtml(f) : ""}</div>`;
      }
      if (b.table) {
        const t = tblById.get(b.table);
        return `<div class="pm-block" id="pm-${id}">${t ? tableHtml(t) : ""}</div>`;
      }
      if (b.code) {
        return `<pre class="pm-block pm-code" id="pm-${id}"><code>${b.code
          .map((line, i) => `<span class="pm-code-line"><span class="pm-code-no" aria-hidden="true">${i + 1}</span>${escapeHtml(line)}</span>`)
          .join("\n")}</code></pre>`;
      }
      return "";
    };

    const pageRange = pages.length ? `p-${pad2(pages[0])}〜${pad2(pages[pages.length - 1])}` : "";
    const docHtml = `
      <header class="pm-head">
        <p class="pm-kicker">${escapeHtml(Q.examName || "")} 午後 問${escapeHtml(Q.no)}・${escapeHtml(Q.area || "")}${Q.required ? "（必須）" : ""}</p>
        <h1 class="pm-title"><span>問${escapeHtml(Q.no)}</span>${deco(Q.title || "", "body")}</h1>
        ${Q.theme ? `<p class="pm-theme">題材：${escapeHtml(Q.theme)}</p>` : ""}
      </header>
      <div class="pm-body">${(Q.body || []).map(blockHtml).join("")}</div>
      ${
        pages.length
          ? `<details class="pm-pages" data-pages>
        <summary>原本のページを見る（${pageRange}）</summary>
        <p class="pm-pages-note">問題冊子のページ（白黒）。開いたときだけ読み込む。</p>
        <div class="pm-pages-list" data-pages-list></div>
      </details>`
          : ""
      }
      ${
        Q.aim || (Q.overall && Q.overall.text)
          ? `<details class="pm-aim">
        <summary>IPA の出題趣旨と講評（問い全体）</summary>
        ${Q.aim ? `<p class="pm-ipa-label">出題趣旨</p>${String(Q.aim).split(/\n+/).map((x) => `<p>${deco(x, "q")}</p>`).join("")}` : ""}
        ${Q.overall && Q.overall.text ? `<p class="pm-ipa-label">採点講評${Q.overall.rate ? `<small>全体の正答率 ${escapeHtml(Q.overall.rate)}</small>` : ""}</p>${String(Q.overall.text).split(/\n+/).map((x) => `<p>${deco(x, "q")}</p>`).join("")}` : ""}
      </details>`
          : ""
      }
      <p class="pm-source">${escapeHtml(Q.source || "")}${Q.answerSource ? `<br>${escapeHtml(Q.answerSource)}` : ""}</p>`;

    /* ----- 設問 ----- */

    // 解答群（設問の頭、または小問の中）
    const choicesBlock = (choices) =>
      choices
        ? `<div class="pm-choices"><p class="pm-choices-label">解答群</p><dl>${Object.entries(choices)
            .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${deco(v, "q")}</dd></div>`)
            .join("")}</dl></div>`
        : "";

    // 記号のボタン。空欄を埋める part は空欄の名前を前に出す。multi は何個でも押せる
    const choiceButtons = (p, choices) => {
      const b = blankOf(p);
      const multi = p.kind === "multi";
      return `<div class="pm-choice-row${multi ? " is-multi" : ""}" role="${multi ? "group" : "radiogroup"}" aria-label="${escapeHtml(b ? `空欄 ${b}` : partName(p.id))}">
        ${b ? `<span class="pm-choice-label">${escapeHtml(b)}</span>` : ""}
        ${Object.keys(choices || {})
          .map((k) => `<button type="button" class="pm-choice" role="${multi ? "checkbox" : "radio"}" aria-checked="false" data-choice="${escapeHtml(k)}" title="${escapeHtml(choices[k])}">${escapeHtml(k)}</button>`)
          .join("")}
        ${multi ? `<span class="pm-choice-hint">当てはまるものを全て押す</span>` : ""}
      </div>`;
    };

    const inputHtml = (p) => {
      if (isPick(p)) return choiceButtons(p, choicesOf(p));
      const label = escapeHtml(`${partName(p.id)} の答え`);
      if (p.kind === "short")
        return `<div class="pm-field"><input type="text" class="pm-input is-short" data-input="${escapeHtml(p.id)}" aria-label="${label}" autocomplete="off" spellcheck="false"${/\[sup:/.test(p.text || "") ? ' placeholder="指数は ^ で（例：2^3）"' : ""}>${
          p.chars || p.limit ? `<span class="pm-count" data-count="${escapeHtml(p.id)}"></span>` : ""
        }</div>`;
      const rows = Math.max(2, Math.ceil((p.limit || 40) / 22));
      return `<div class="pm-field"><textarea class="pm-input" rows="${rows}" data-input="${escapeHtml(p.id)}" aria-label="${label}" spellcheck="false"></textarea><span class="pm-count" data-count="${escapeHtml(p.id)}"></span></div>`;
    };

    const thinkHtml = (p) => {
      const t = p.think;
      if (!t || typeof t !== "object") return "";
      const row = (label, html) => (html ? `<div class="pm-think-row"><p class="pm-think-label">${label}</p>${html}</div>` : "");
      const ground = (t.ground || [])
        .map(
          (g) => `<li>
            <blockquote>「${deco(g.quote || "", "q")}」</blockquote>
            ${g.why ? `<p>${deco(g.why, "q")}</p>` : ""}
            ${g.ref ? `<button type="button" class="pm-ground-go" data-ground="${escapeHtml(p.id)}" data-goto="${escapeHtml(g.ref)}" data-quote="${escapeHtml(g.quote || "")}">本文で見る${refLabel(g.ref) === "本文" ? "" : `（${escapeHtml(refLabel(g.ref))}）`}</button>` : ""}
          </li>`
        )
        .join("");
      return `
        <details class="pm-think" data-think="${escapeHtml(p.id)}">
          <summary>サイトの考え方</summary>
          <div class="pm-think-body">
            ${row("問われていること", t.ask ? `<p>${deco(t.ask, "q")}</p>` : "")}
            ${row("根拠（本文の原文）", ground ? `<ul class="pm-ground">${ground}</ul>` : "")}
            ${row("つなぎ", t.steps && t.steps.length ? `<ol class="pm-steps">${t.steps.map((s) => `<li>${deco(s, "q")}</li>`).join("")}</ol>` : "")}
            ${row("答えの組み立て", t.build ? `<p>${deco(t.build, "q")}</p>` : "")}
            ${row("つまずき", t.trap ? `<p>${deco(t.trap, "q")}</p>` : "")}
            ${row(
              "ほかの選択肢",
              t.others && Object.keys(t.others).length
                ? `<dl class="pm-others">${Object.entries(t.others).map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${deco(v, "q")}</dd></div>`).join("")}</dl>`
                : ""
            )}
            ${t.analogy ? `<p class="term-line term-analogy"><span class="term-label">たとえ</span>${deco(t.analogy, "q")}</p>` : ""}
          </div>
        </details>`;
    };

    let terms = []; // 用語集の md から（読み終わったら入る）
    const termIndex = (name) => terms.findIndex((t) => t.name === name || t.keys.includes(name));
    const chipsHtml = (names) => {
      const found = [...new Set(names)].map((n) => ({ n, i: termIndex(n) })).filter((x) => x.i >= 0);
      if (!found.length) return "";
      return `
        <div class="pm-terms" data-terms>
          <p class="reader-terms-label">この問いで使う用語（押すと意味が開く）</p>
          <div class="reader-chips">${found
            .map((x) => `<button type="button" class="reader-chip" data-chip="${x.i}" aria-expanded="false">${escapeHtml(terms[x.i].name)}${terms[x.i].analogy ? `<i aria-hidden="true"></i>` : ""}</button>`)
            .join("")}</div>
          <div class="reader-term-open" data-term-open></div>
        </div>`;
    };

    const answerHtml = (p) => {
      const answers = p.answers || [];
      const ipa = answers.length
        ? `<div class="pm-ipa">
            <p class="pm-ipa-label">IPA 解答例</p>
            <p class="pm-ipa-answer">${
              p.kind === "choice"
                ? answers.map((a) => `${escapeHtml(a)}（${escapeHtml(choicesOf(p)[a] || "")}）`).join("・")
                : p.kind === "multi"
                  ? `${escapeHtml(answers[0])}<span class="pm-ipa-marks">${splitMarks(answers[0]).map((a) => `${escapeHtml(a)}（${escapeHtml(choicesOf(p)[a] || "")}）`).join("・")}</span>`
                  : deco(answers[0], "q")
            }</p>
            ${answers.length > 1 && !isPick(p) ? answers.slice(1).map((a) => `<p class="pm-ipa-alt"><span>別解</span>${deco(a, "q")}</p>`).join("") : ""}
            ${p.note ? `<p class="pm-ipa-alt"><span>備考</span>${deco(p.note, "q")}</p>` : ""}
          </div>`
        : "";
      const points =
        !isPick(p) && p.points && p.points.length
          ? `<div class="pm-points">
            <p class="pm-site-label">採点の目安<small>（サイトの判断。IPA は部分点の基準を出していない）</small></p>
            <ol>${p.points.map((x) => `<li>${deco(x, "q")}</li>`).join("")}</ol>
            <p class="pm-hint">要素が全部合えば ○、一部なら △、外れていれば ×。</p>
          </div>`
          : "";
      const grade =
        isPick(p)
          ? `<p class="pm-grade is-auto" data-grade-auto="${escapeHtml(p.id)}"></p>`
          : `<div class="pm-grade" role="group" aria-label="${escapeHtml(partName(p.id))} の自己採点">
            <span class="pm-grade-label">自己採点</span>
            ${Object.keys(GRADES)
              .map((g) => `<button type="button" class="pm-grade-btn is-${g}" data-grade="${g}" aria-pressed="false" title="${GRADE_NAMES[g]}">${GRADES[g]}</button>`)
              .join("")}
            <span class="pm-grade-state" data-grade-state></span>
          </div>`;
      const commentText = p.comment || (p.q.parts.length === 1 && p.q.comment) || "";
      const comment = `<div class="pm-ipa is-comment">
          <p class="pm-ipa-label">IPA 採点講評${p.rate ? `<small>正答率 ${escapeHtml(p.rate)}</small>` : ""}</p>
          <p>${commentText ? deco(commentText, "q") : `講評ではこの設問に触れていない${Q.overall && Q.overall.rate ? `（問い全体の正答率は${escapeHtml(Q.overall.rate)}）` : ""}。`}</p>
        </div>`;
      const termNames = [...(p.terms || []), ...((p.think && p.think.terms) || [])];
      return `
        <div class="pm-answer" data-answer="${escapeHtml(p.id)}" hidden>
          ${ipa}${points}${grade}${comment}${thinkHtml(p)}
          <div data-chips-for="${escapeHtml(p.id)}" data-chip-names="${escapeHtml(JSON.stringify(termNames))}"></div>
          ${memoBlock(`pm:${key}:${p.id}`, "この設問にメモを書く")}
        </div>`;
    };

    const partHtml = (p) => `
      <div class="pm-part" id="pm-part-${escapeHtml(p.id)}" data-part="${escapeHtml(p.id)}">
        <p class="pm-review-badge" hidden>今日の見直し</p>
        ${p.text || (p.label && p.label !== blankOf(p)) ? `<p class="pm-part-text">${p.label ? `<span class="pm-part-label">${escapeHtml(p.label)}</span>` : ""}${deco(p.text || "", "q")}</p>` : ""}
        ${p.choices ? choicesBlock(p.choices) : ""}
        ${inputHtml(p)}
        <p class="pm-locked" data-locked hidden>記録済み。書き直すときは下の「もう一度解く」。</p>
        <details class="pm-prev" data-prev hidden><summary>前回の答え</summary><div data-prev-list></div></details>
        ${answerHtml(p)}
      </div>`;

    const questionHtml = (q) => {
      const refs = [];
      [q.text, ...(q.parts || []).map((p) => p.text)].forEach((t) =>
        String(t || "").replace(/\[ref:(u\d+)\]/g, (_, u) => {
          if (!refs.includes(u)) refs.push(u);
          return "";
        })
      );
      return `
      <article class="pm-q" id="pm-q${escapeHtml(q.no)}" data-qno="${escapeHtml(q.no)}">
        <h2 class="pm-q-title">設問${escapeHtml(q.no)}</h2>
        <p class="pm-q-text">${deco(q.text || "", "q")}</p>
        ${refs.length ? `<p class="pm-q-refs">${refs.map((u) => `<button type="button" class="pm-goto" data-goto="${u}">${escapeHtml(refLabel(u))}を見る</button>`).join("")}</p>` : ""}
        ${choicesBlock(q.choices)}
        ${(q.parts || []).map((p) => partHtml(partById.get(p.id))).join("")}
        <p class="pm-q-foot"><button type="button" class="terms-button" data-reveal="${escapeHtml(q.no)}">この設問の解答例を見る</button></p>
      </article>`;
    };

    const qsHtml = `
      <p class="pm-qs-lead">答えは入力が止まって1秒で保存する。「解答例を見る」で IPA の解答例・採点の目安・サイトの考え方が開く。</p>
      ${questions.map(questionHtml).join("")}
      <section class="pm-record" data-record-box>
        <h2 class="pm-q-title">採点を記録する</h2>
        <p class="pm-record-text" data-record-text></p>
        <p class="pm-record-actions">
          <button type="button" class="terms-button is-primary" data-record>採点を記録する</button>
          <button type="button" class="terms-button" data-retry hidden>もう一度解く</button>
        </p>
        <p class="pm-hint">自己採点を付けた設問だけを回答記録に送る（1回の記録で1設問1回）。○は正解、△・×は温室の「今日の水やり」に戻ってくる。</p>
      </section>
      <section class="pm-qmemo">
        <h2 class="pm-q-title">この問いのメモ</h2>
        ${memoBlock(`pm:${key}`, "この問い全体にメモを書く")}
      </section>`;

    main.innerHTML = `
      <div class="pm-bar" data-bar>
        <p class="pm-bar-title"><span class="pm-bar-short">${escapeHtml(short)}</span><span class="pm-bar-area">${escapeHtml(Q.area || "")}</span></p>
        <span class="pm-saved" data-saved aria-live="polite"></span>
        <div class="pm-timer" data-timer></div>
        <button type="button" class="terms-button pm-reveal-all" data-reveal-all><span class="pm-wide">全部の解答例を見る</span><span class="pm-narrow">解答例</span></button>
      </div>
      <div class="pm-split" data-pane="${mode === "review" ? "qs" : "doc"}">
        <section class="pm-doc" aria-label="問題文">${docHtml}</section>
        <section class="pm-qs" aria-label="設問">${qsHtml}</section>
      </div>
      <nav class="pm-switch" aria-label="問題文と設問の切り替え">
        <button type="button" data-show="doc">問題文</button>
        <button type="button" data-show="qs">設問 <small data-switch-count></small></button>
      </nav>
      <dialog class="pm-zoom" data-zoom-dialog>
        <form method="dialog"><button class="terms-button" value="close">閉じる</button></form>
        <img alt="">
      </dialog>`;

    document.title = `${short} ${Q.area || ""}｜午後の演習`;
    const doc = main.querySelector(".pm-doc");
    const qs = main.querySelector(".pm-qs");
    const split = main.querySelector(".pm-split");
    const bar = main.querySelector("[data-bar]");

    // 上の帯の高さ（2列のときの左右の高さに使う）
    const setBarHeight = () => main.style.setProperty("--pm-bar-h", `${bar.offsetHeight}px`);
    setBarHeight();
    window.addEventListener("resize", setBarHeight);

    /* ----- 保存の表示 ----- */

    const savedEl = main.querySelector("[data-saved]");
    let savedTimer = null;
    const showSaved = (state) => {
      savedEl.textContent = state === "synced" ? "同期しました" : state === "pending" ? "保存しました" : "この端末に保存しました";
      savedEl.classList.add("is-on");
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => savedEl.classList.remove("is-on"), 2500);
    };
    Store.onChange(showSaved);

    /* ----- タイマー（最初は止めておく。押したときだけ 30分をはかる） ----- */

    const Timer = (() => {
      const LS = "pm-timer";
      const limit = (Q.minutes || 30) * 60000;
      const read = () => {
        try {
          return JSON.parse(localStorage.getItem(LS)) || {};
        } catch (error) {
          return {};
        }
      };
      const save = (state) => {
        const all = read();
        if (state) all[key] = state;
        else delete all[key];
        try {
          localStorage.setItem(LS, JSON.stringify(all));
        } catch (error) {
          /* この端末に残せなくても、開いている間は動く */
        }
      };
      let state = read()[key] || null; // { run: 動かし始めた時刻(ms) か null, acc: それまでの経過(ms) }
      const el = main.querySelector("[data-timer]");
      let tick = null;
      const elapsed = () => (state ? state.acc + (state.run ? Date.now() - state.run : 0) : 0);
      const render = () => {
        if (!state) {
          el.innerHTML = `<button type="button" class="pm-timer-btn" data-timer-start>${Q.minutes || 30}分はかる</button>`;
          return;
        }
        const left = limit - elapsed();
        const text = left >= 0 ? `残り ${clock(left)}` : `${Q.minutes || 30}分たちました（+${clock(-left)}）`;
        el.innerHTML = `<span class="pm-timer-clock${left < 0 ? " is-over" : ""}" role="timer">${text}</span><button type="button" class="pm-timer-btn" data-timer-toggle>${state.run ? "止める" : "続ける"}</button>`;
      };
      const loop = () => {
        clearInterval(tick);
        tick = state && state.run ? setInterval(render, 1000) : null;
        render();
      };
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-timer-start]")) {
          state = { run: Date.now(), acc: 0 };
        } else if (e.target.closest("[data-timer-toggle]")) {
          state = state.run ? { run: null, acc: elapsed() } : { run: Date.now(), acc: state.acc };
        } else return;
        save(state);
        loop();
        setBarHeight();
      });
      loop();
      return {
        pause: () => {
          if (state && state.run) {
            state = { run: null, acc: elapsed() };
            save(state);
            loop();
          }
        },
        seconds: () => (state ? Math.round(elapsed() / 1000) : null),
        reset: () => {
          state = null;
          save(null);
          loop();
        },
      };
    })();

    /* ----- 答えの状態を画面に出す ----- */

    const rec = (pid) => Store.get(key, pid) || { a: "", g: null, ga: null, e: null, h: [] };

    const fillBlank = (p) => {
      const b = blankOf(p);
      if (!b) return;
      const a = rec(p.id).a;
      const shown = p.kind === "choice" && a ? choicesOf(p)[a] || a : a;
      doc.querySelectorAll(`[data-blank-fill="${b}"]`).forEach((el) => {
        el.textContent = shown;
        el.title = isPick(p) && a ? `${a}（自分の答え）` : a ? "自分の答え" : "";
        el.parentElement.classList.toggle("is-filled", Boolean(a));
      });
    };

    const renderCount = (p) => {
      const out = qs.querySelector(`[data-count="${p.id}"]`);
      if (!out) return;
      const input = qs.querySelector(`[data-input="${p.id}"]`);
      const n = countChars(input ? input.value : rec(p.id).a);
      const max = p.limit || p.chars || 0;
      if (!max) {
        out.textContent = n ? `${n}字` : "";
        return;
      }
      const over = n - max;
      out.textContent = `${n} / ${max}字${p.charType ? `（${p.charType}）` : ""}${over > 0 ? `　${over}字多い` : ""}`;
      out.classList.toggle("is-over", over > 0);
      out.classList.toggle("is-exact", Boolean(p.chars) && n === p.chars);
    };

    const prevHtml = (h) =>
      h
        .slice(0, 3)
        .map(
          (x) => `<div class="pm-prev-item">
            <p class="pm-prev-meta">${escapeHtml(shortDate(x.at))}${x.grade ? `<span class="pm-mark-grade is-${escapeHtml(x.grade)}">${GRADES[x.grade] || ""}</span>` : ""}</p>
            <p class="pm-prev-answer">${x.answer ? escapeHtml(x.answer) : "（空欄）"}</p>
          </div>`
        )
        .join("");

    const renderPart = (p) => {
      const box = qs.querySelector(`[data-part="${p.id}"]`);
      if (!box) return;
      const r = rec(p.id);
      const locked = Boolean(r.ga);
      const input = box.querySelector(`[data-input="${p.id}"]`);
      if (input) {
        if (document.activeElement !== input && input.value !== r.a) input.value = r.a || "";
        input.readOnly = locked;
      }
      const picked = p.kind === "multi" ? splitMarks(r.a) : [r.a];
      box.querySelectorAll("[data-choice]").forEach((b) => {
        b.setAttribute("aria-checked", String(picked.includes(b.dataset.choice)));
        b.disabled = locked;
      });
      box.querySelector("[data-locked]").hidden = !locked;
      box.classList.toggle("is-locked", locked);
      // 自己採点
      box.querySelectorAll("[data-grade]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.grade === r.g));
        b.disabled = locked;
      });
      const state = box.querySelector("[data-grade-state]");
      if (state) state.textContent = locked ? "記録済み" : r.g ? "まだ記録していない" : "";
      const auto = box.querySelector("[data-grade-auto]");
      if (auto) {
        auto.innerHTML = r.g
          ? `<span class="pm-mark-grade is-${r.g}">${GRADES[r.g]}</span>${r.g === "good" ? "正解" : `${r.g === "fair" ? "一部だけ正解" : "不正解"}（選んだのは ${escapeHtml(r.a)}）`}<span class="pm-grade-state">${locked ? "記録済み" : "まだ記録していない"}</span>`
          : revealed.has(p.id)
            ? `<span class="pm-grade-state">記号を選ぶと自動で ${p.kind === "multi" ? "○・△・×" : "○・×"} が付く（選ばないままなら記録しない）</span>`
            : "";
        auto.classList.toggle("is-empty", !auto.innerHTML);
      }
      // 前回の答え
      const prev = box.querySelector("[data-prev]");
      const h = r.h || [];
      prev.hidden = !h.length;
      if (h.length) prev.querySelector("[data-prev-list]").innerHTML = prevHtml(h);
      renderCount(p);
      fillBlank(p);
    };

    const answeredQ = (q) => (q.parts || []).every((p) => rec(p.id).a);
    const renderRecord = () => {
      const graded = allParts.filter((p) => rec(p.id).g);
      const pending = graded.filter((p) => !rec(p.id).ga);
      const recorded = allParts.filter((p) => rec(p.id).ga);
      const text = main.querySelector("[data-record-text]");
      const btn = main.querySelector("[data-record]");
      const retry = main.querySelector("[data-retry]");
      const all = rec("_");
      const last = (all.h || [])[0];
      const count = (list, g) => list.filter((p) => rec(p.id).g === g).length;
      if (pending.length) {
        text.textContent = `自己採点を付けた設問 ${graded.length} / ${allParts.length}。まだ記録していないもの ${pending.length}（○${count(pending, "good")}・△${count(pending, "fair")}・×${count(pending, "bad")}）。`;
      } else if (recorded.length) {
        text.textContent = `記録しました${last ? `（${shortDate(last.at)}・○${last.good}・△${last.fair}・×${last.bad}${last.sec ? `・${Math.round(last.sec / 60)}分` : ""}）` : ""}。解き直すときは「もう一度解く」。`;
      } else {
        text.textContent = `まだ自己採点を付けた設問はない（${allParts.length}設問）。解答例を開いて ○△× を付ける。`;
      }
      btn.disabled = !pending.length;
      retry.hidden = !recorded.length || pending.length > 0;
      const n = questions.filter(answeredQ).length;
      main.querySelector("[data-switch-count]").textContent = `${n}/${questions.length}`;
    };

    const renderAll = () => {
      allParts.forEach(renderPart);
      renderRecord();
    };

    /* ----- 入力 ----- */

    const timers = {};
    const saveAnswer = (pid, value) => {
      if (rec(pid).ga) return; // 記録済みは書き換えない
      Store.set(key, pid, { a: String(value).slice(0, 2000) });
      renderRecord();
    };
    qs.addEventListener("input", (e) => {
      const input = e.target.closest("[data-input]");
      if (!input) return;
      const p = partById.get(input.dataset.input);
      renderCount(p);
      // 本文の空欄には、打っている途中から薄く出す
      const b = blankOf(p);
      if (b) {
        doc.querySelectorAll(`[data-blank-fill="${b}"]`).forEach((el) => {
          el.textContent = input.value;
          el.parentElement.classList.toggle("is-filled", Boolean(input.value));
        });
      }
      clearTimeout(timers[p.id]);
      timers[p.id] = setTimeout(() => saveAnswer(p.id, input.value), 1000);
    });
    qs.addEventListener("focusout", (e) => {
      const input = e.target.closest && e.target.closest("[data-input]");
      if (!input || !timers[input.dataset.input]) return;
      clearTimeout(timers[input.dataset.input]);
      delete timers[input.dataset.input];
      if (input.value !== rec(input.dataset.input).a) saveAnswer(input.dataset.input, input.value);
    });

    const revealed = new Set();
    // 全て選ぶ記号：答え（別解があればそのどれか）と全部同じなら ○、合っている記号が1つでもあれば △、無ければ ×
    const gradeMulti = (p, a) => {
      const mine = new Set(splitMarks(a));
      let best = "bad";
      (p.answers || []).forEach((ans) => {
        const right = splitMarks(ans);
        const hit = right.filter((x) => mine.has(x)).length;
        if (hit === right.length && mine.size === right.length) best = "good";
        else if (hit && best === "bad") best = "fair";
      });
      return best;
    };
    const autoGrade = (p) => {
      const r = rec(p.id);
      if (!isPick(p) || r.ga) return;
      // 選んでいない記号の設問は採点しない（記録にも送らない）
      const g = !r.a ? null : p.kind === "multi" ? gradeMulti(p, r.a) : (p.answers || []).includes(r.a) ? "good" : "bad";
      if (r.g !== g) Store.set(key, p.id, { g });
    };
    const reveal = (q, scroll) => {
      Timer.pause();
      (q.parts || []).forEach((p) => {
        revealed.add(p.id);
        const box = qs.querySelector(`[data-answer="${p.id}"]`);
        if (box) box.hidden = false;
        autoGrade(p);
      });
      const btn = qs.querySelector(`[data-reveal="${q.no}"]`);
      if (btn) btn.closest(".pm-q-foot").hidden = true;
      renderAll();
      if (scroll) {
        const first = qs.querySelector(`[data-answer="${q.parts[0].id}"]`);
        if (first) first.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    /* ----- 問題文と設問の行き来 ----- */

    const scrolls = { doc: 0, qs: 0 };
    const showPane = (name) => {
      const current = split.dataset.pane;
      if (isMobile() && current !== name) scrolls[current] = window.scrollY;
      split.dataset.pane = name;
      main.querySelectorAll("[data-show]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.show === name)));
      if (isMobile() && current !== name) window.scrollTo(0, scrolls[name] || 0);
    };
    const flash = (el) => {
      el.classList.remove("is-flash");
      void el.offsetWidth;
      el.classList.add("is-flash");
      setTimeout(() => el.classList.remove("is-flash"), 2200);
    };
    const reveal_into = (el) => {
      // スマホは画面全体、2列は欄の中だけを動かす
      el.scrollIntoView({ block: "center", behavior: isMobile() ? "auto" : "smooth" });
    };
    const gotoDoc = (ref, quote, partId) => {
      let el = null;
      if (quote && partId) {
        el = [...doc.querySelectorAll(`.pm-g[data-g~="${CSS.escape(partId)}"]`)].find((g) => g.textContent.includes(quote.replace(/\[[^\]]*\]/g, "").slice(0, 12))) || null;
      }
      const bm = !el && String(ref || "").match(/^(?:blank-)?([a-z])$/);
      const els = bm ? [...doc.querySelectorAll(`[data-blank="${bm[1]}"]`)] : [];
      el = el || els[0] || document.getElementById(targetId(ref));
      if (!el) return;
      showPane("doc");
      requestAnimationFrame(() => {
        reveal_into(el);
        (els.length ? els : [el]).forEach(flash);
      });
    };
    const gotoQuestion = (no) => {
      const el = document.getElementById(`pm-q${no}`);
      if (!el) return;
      showPane("qs");
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "start", behavior: isMobile() ? "auto" : "smooth" });
        flash(el);
      });
    };
    const litFor = (pid, on) => {
      doc.querySelectorAll(`.pm-g[data-g~="${CSS.escape(pid)}"]`).forEach((g) => g.classList.toggle("is-lit", on));
    };

    /* ----- 用語の点線（本文に最初に出てくる所） ----- */

    const markTerms = () => {
      const entries = [];
      (Q.glossary || []).forEach((name) => {
        const i = termIndex(name);
        if (i < 0) return;
        terms[i].keys.forEach((k) => entries.push({ key: k, attr: "data-term", i }));
      });
      (Q.words || []).forEach((w, i) => entries.push({ key: w.w, attr: "data-word", i }));
      const done = new Set();
      entries
        .filter((x) => x.key && x.key.length >= 2)
        .sort((a, b) => b.key.length - a.key.length)
        .forEach((entry) => {
          const id = `${entry.attr}:${entry.i}`;
          if (done.has(id)) return;
          // 本文は原文どおり「SQL インジェクション」と空白が入ることがあるので、字の間の空白は無視して探す
          const ascii = /^[A-Za-z0-9./+-]+$/.test(entry.key);
          const body = [...entry.key.replace(/[ 　]/g, "")].map((c) => c.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")).join("[ 　]?");
          const re = new RegExp(ascii ? `(^|[^A-Za-z0-9])(${body})(?![A-Za-z0-9])` : `()(${body})`);
          const walker = document.createTreeWalker(doc.querySelector(".pm-body"), NodeFilter.SHOW_TEXT, {
            acceptNode: (n) =>
              n.parentElement.closest(".pm-term, button, rt, .pm-blank, .pm-code, .pm-u-no, .is-mono") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
          });
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const m = re.exec(n.nodeValue);
            if (!m) continue;
            const rest = n.splitText(m.index + m[1].length);
            rest.splitText(m[2].length);
            // button だと1つの箱になり、表の狭い欄や行末で折り返せないので、span を押せる形にする
            const btn = document.createElement("span");
            btn.setAttribute("role", "button");
            btn.tabIndex = 0;
            btn.className = `pm-term${entry.attr === "data-word" ? " is-word" : ""}`;
            btn.setAttribute(entry.attr, String(entry.i));
            btn.setAttribute("aria-expanded", "false");
            btn.textContent = rest.nodeValue;
            rest.replaceWith(btn);
            done.add(id);
            break;
          }
        });
    };

    const toggleTermPanel = (btn) => {
      const block = btn.closest(".pm-block, li, td, figcaption") || btn.parentElement;
      const holder = btn.closest(".pm-block") || block;
      let open = holder.nextElementSibling && holder.nextElementSibling.matches(".pm-term-open") ? holder.nextElementSibling : null;
      const wasOpen = btn.getAttribute("aria-expanded") === "true";
      doc.querySelectorAll(".pm-term[aria-expanded='true']").forEach((b) => b.setAttribute("aria-expanded", "false"));
      doc.querySelectorAll(".pm-term-open").forEach((x) => x.remove());
      if (wasOpen) return;
      open = document.createElement("div");
      open.className = "pm-term-open";
      open.innerHTML =
        btn.hasAttribute("data-word") ? wordPanel(Q.words[Number(btn.dataset.word)]) : termPanel(terms[Number(btn.dataset.term)]);
      holder.after(open);
      btn.setAttribute("aria-expanded", "true");
    };

    /* ----- 下線を押すと「設問N で問われる」 ----- */

    const toggleUnderline = (u) => {
      const id = u.dataset.u;
      const old = u.querySelector(".pm-u-pop");
      doc.querySelectorAll(".pm-u-pop").forEach((x) => x.remove());
      if (old) return;
      const nos = [...(asksOfU[id] || [])];
      if (!nos.length) return;
      const pop = document.createElement("span");
      pop.className = "pm-u-pop";
      pop.innerHTML = nos.map((no) => `<button type="button" class="pm-u-go" data-goto-q="${no}">設問${no} で問われる ›</button>`).join("");
      u.append(pop);
    };

    /* ----- クリック ----- */

    main.addEventListener("click", (e) => {
      const t = e.target;
      const show = t.closest("[data-show]");
      if (show) return showPane(show.dataset.show);
      const goQ = t.closest("[data-goto-q]");
      if (goQ) {
        e.stopPropagation();
        doc.querySelectorAll(".pm-u-pop").forEach((x) => x.remove());
        return gotoQuestion(goQ.dataset.gotoQ);
      }
      const ground = t.closest("[data-ground]");
      if (ground) {
        litFor(ground.dataset.ground, true);
        return gotoDoc(ground.dataset.goto, ground.dataset.quote, ground.dataset.ground);
      }
      const go = t.closest("[data-goto]");
      if (go) return gotoDoc(go.dataset.goto);
      const u = t.closest(".pm-u");
      if (u && doc.contains(u) && !t.closest(".pm-term")) return toggleUnderline(u);
      const term = t.closest(".pm-term");
      if (term) return toggleTermPanel(term);
      const zoom = t.closest("[data-zoom]");
      if (zoom) {
        const dialog = main.querySelector("[data-zoom-dialog]");
        const img = zoom.querySelector("img");
        dialog.querySelector("img").src = img.src;
        dialog.querySelector("img").alt = img.alt;
        if (dialog.showModal) dialog.showModal();
        return;
      }
      const choice = t.closest("[data-choice]");
      if (choice) {
        const pid = choice.closest("[data-part]").dataset.part;
        if (rec(pid).ga) return;
        const cur = rec(pid).a;
        const p = partById.get(pid);
        const k = choice.dataset.choice;
        let next;
        if (p.kind === "multi") {
          const set = new Set(splitMarks(cur));
          if (set.has(k)) set.delete(k);
          else set.add(k);
          next = Object.keys(choicesOf(p)).filter((x) => set.has(x)).join("，"); // 解答群の順に "ア，ウ"
        } else next = cur === k ? "" : k;
        Store.set(key, pid, { a: next });
        if (revealed.has(pid)) autoGrade(p);
        renderPart(p);
        renderRecord();
        return;
      }
      const grade = t.closest("[data-grade]");
      if (grade) {
        const pid = grade.closest("[data-part]").dataset.part;
        if (rec(pid).ga) return;
        // 書きかけの答えを先に保存する
        const input = qs.querySelector(`[data-input="${pid}"]`);
        const change = { g: rec(pid).g === grade.dataset.grade ? null : grade.dataset.grade };
        if (input && input.value !== rec(pid).a) change.a = input.value;
        Store.set(key, pid, change);
        renderPart(partById.get(pid));
        renderRecord();
        return;
      }
      const rv = t.closest("[data-reveal]");
      if (rv) return reveal(questions.find((q) => String(q.no) === rv.dataset.reveal), true);
      const all = t.closest("[data-reveal-all]");
      if (all) {
        // 解く前にうっかり押しても全部開かないよう、2回目の押下で開く（3秒たつと元に戻る）
        if (!all.classList.contains("is-armed")) {
          all.classList.add("is-armed");
          all.dataset.label = all.innerHTML;
          all.textContent = "もう一度押すと全部開く";
          clearTimeout(all._armTimer);
          all._armTimer = setTimeout(() => {
            all.classList.remove("is-armed");
            all.innerHTML = all.dataset.label;
          }, 3000);
          return;
        }
        clearTimeout(all._armTimer);
        all.classList.remove("is-armed");
        all.innerHTML = all.dataset.label;
        questions.forEach((q) => reveal(q, false));
        showPane("qs");
        return;
      }
      if (t.closest("[data-record]")) return recordAll();
      if (t.closest("[data-retry]")) return retryAll();
      const chip = t.closest("[data-chip]");
      if (chip) {
        const box = chip.closest("[data-terms]");
        const out = box.querySelector("[data-term-open]");
        const wasOpen = chip.getAttribute("aria-expanded") === "true";
        box.querySelectorAll("[data-chip]").forEach((c) => c.setAttribute("aria-expanded", "false"));
        if (wasOpen) out.innerHTML = "";
        else {
          chip.setAttribute("aria-expanded", "true");
          out.innerHTML = termPanel(terms[Number(chip.dataset.chip)]);
        }
      }
    });
    main.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".pm-term")) {
        e.preventDefault();
        toggleTermPanel(e.target);
      } else if ((e.key === "Enter" || e.key === " ") && e.target.matches(".pm-u")) {
        e.preventDefault();
        toggleUnderline(e.target);
      }
    });

    // 考え方を開くと、本文の根拠の所が光る（2列のときはそこへ動く）
    qs.addEventListener(
      "toggle",
      (e) => {
        const d = e.target;
        if (!d.matches || !d.matches("[data-think]")) return;
        litFor(d.dataset.think, d.open);
        if (d.open && !isMobile()) {
          const first = doc.querySelector(`.pm-g[data-g~="${CSS.escape(d.dataset.think)}"]`);
          if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      },
      true
    );

    // 原本のページは開いたときだけ読み込む
    const pagesBox = main.querySelector("[data-pages]");
    if (pagesBox) {
      pagesBox.addEventListener("toggle", () => {
        const list = pagesBox.querySelector("[data-pages-list]");
        if (!pagesBox.open || list.childElementCount) return;
        list.innerHTML = pages
          .map(
            (n) =>
              `<figure class="pm-page"><img src="img/${escapeHtml(Q.exam)}-p${pad2(n)}.webp" alt="問題冊子 p-${pad2(n)}" loading="lazy"><figcaption>p-${pad2(n)}</figcaption></figure>`
          )
          .join("");
      });
    }

    /* ----- 採点を記録する・もう一度解く ----- */

    const recordAll = () => {
      // 書きかけの答えを先に保存する
      qs.querySelectorAll("[data-input]").forEach((input) => {
        const pid = input.dataset.input;
        if (!rec(pid).ga && input.value !== rec(pid).a) Store.set(key, pid, { a: input.value });
      });
      const pending = allParts.filter((p) => rec(p.id).g && !rec(p.id).ga);
      if (!pending.length) return;
      const at = nowIso();
      const sec = Timer.seconds();
      const tally = { good: 0, fair: 0, bad: 0 };
      pending.forEach((p) => {
        const g = rec(p.id).g;
        tally[g] += 1;
        if (typeof window.recordAnswer === "function") window.recordAnswer(qid(p.id), category, g === "good");
        Store.set(key, p.id, { ga: at, e: sec });
      });
      const all = rec("_");
      Store.set(key, "_", {
        ga: at,
        e: sec,
        h: [{ at, sec, ...tally, total: pending.length }, ...(all.h || [])].slice(0, 10),
      });
      Timer.pause();
      Store.flush();
      renderAll();
    };

    const retryAll = () => {
      allParts.forEach((p) => moveToHistory(p.id));
      revealed.clear();
      qs.querySelectorAll("[data-answer]").forEach((x) => (x.hidden = true));
      qs.querySelectorAll(".pm-q-foot").forEach((x) => (x.hidden = false));
      qs.querySelectorAll("[data-think]").forEach((d) => (d.open = false));
      doc.querySelectorAll(".pm-g.is-lit").forEach((g) => g.classList.remove("is-lit"));
      Timer.reset();
      Store.flush();
      renderAll();
      const first = questions[0] && document.getElementById(`pm-q${questions[0].no}`);
      if (first) first.scrollIntoView({ block: "start" });
    };

    // 今の答えを「前回の答え」に移して、答え欄を空にする
    const moveToHistory = (pid) => {
      const r = rec(pid);
      if (!r.a && !r.g) return;
      const entry = { at: r.ga || r.t || nowIso(), answer: r.a || "", grade: r.g || null, sec: r.e == null ? null : r.e };
      Store.set(key, pid, { a: "", g: null, ga: null, h: [entry, ...(r.h || [])].slice(0, 10) });
    };

    /* ----- 見直し（?mode=review） ----- */

    const applyReview = async () => {
      const ids = new Set();
      // この端末：最後に記録した自己採点が △・×
      allParts.forEach((p) => {
        const r = rec(p.id);
        const last = r.ga ? r.g : !r.a && r.h && r.h[0] ? r.h[0].grade : null;
        if (last === "fair" || last === "bad") ids.add(p.id);
      });
      // 回答記録：間違えたまま・そろそろ忘れるころ（温室と同じ決まり）
      const rows = await fetchStats();
      const prefix = `appm-${key}-`;
      const sync = window.StudySync;
      rows.forEach((row) => {
        const id = String(row.question_id);
        if (!id.startsWith(prefix) || !sync || !sync.reviewState) return;
        const pid = id.slice(prefix.length);
        if (partById.has(pid) && sync.reviewState(row, Date.now())) ids.add(pid);
      });
      if (!ids.size) {
        const lead = qs.querySelector(".pm-qs-lead");
        if (lead) lead.textContent = "今日見直す設問はない。全部を解き直すなら、下の「もう一度解く」。";
        return;
      }
      let first = null;
      allParts.forEach((p) => {
        if (!ids.has(p.id)) return;
        const box = qs.querySelector(`[data-part="${p.id}"]`);
        box.classList.add("is-review");
        box.querySelector(".pm-review-badge").hidden = false;
        if (rec(p.id).ga) moveToHistory(p.id);
        const prev = box.querySelector("[data-prev]");
        if (prev) prev.open = false;
        first = first || box;
      });
      renderAll();
      if (first) {
        showPane("qs");
        requestAnimationFrame(() => first.scrollIntoView({ block: "start" }));
      }
    };

    /* ----- 起動 ----- */

    showPane(split.dataset.pane);
    renderAll();
    setupMemos(main);

    // 用語（読めなくても問題は解ける）
    try {
      const files = Q.termFiles || [];
      const texts = await Promise.all(
        files.map((n) =>
          fetch(`../terms/${pad2(n)}.md`, { cache: "no-cache" })
            .then((r) => (r.ok ? r.text() : ""))
            .catch(() => "")
        )
      );
      terms = texts.flatMap((t) => (t ? parseTerms(t) : []));
    } catch (error) {
      terms = [];
    }
    markTerms();
    qs.querySelectorAll("[data-chips-for]").forEach((el) => {
      let names = [];
      try {
        names = JSON.parse(el.dataset.chipNames || "[]");
      } catch (error) {
        names = [];
      }
      el.innerHTML = chipsHtml(names);
    });

    // ログインしたら、ほかの端末の答えを読み込む
    let reviewed = false;
    onUser(async () => {
      if (await Store.pull(key)) renderAll();
      if (mode === "review" && !reviewed) {
        reviewed = true;
        applyReview();
      }
    });
    if (mode === "review" && !window.StudySync) {
      reviewed = true;
      applyReview();
    }
  };

  /* =====================================================================
     一覧（ap/pm/index.html）
     ===================================================================== */

  const RECOMMENDED = [9, 10, 11, 2];
  const SPARE = [6];

  const buildIndex = (main) => {
    const topic = topicOf(main);
    const info = pmInfo(topic);
    const materials = ((catalog && catalog.materials[topic]) || []).filter((m) => m.type === "pm");
    const madeKey = new Map(materials.map((m) => [m.file.split("/").pop().replace(/\.html$/, ""), m]));
    const mineEl = main.querySelector("[data-pm-mine]");
    const gridEl = main.querySelector("[data-pm-grid]");
    const reviewEl = main.querySelector("[data-pm-review]");
    let fieldRates = {};
    let statsRows = [];
    let showAll = false;

    const choice = () =>
      ((notes && notes.get("pm:choice")) || "")
        .split(",")
        .map(Number)
        .filter((n) => n >= 2 && n <= 11);

    // 問のキーの状態：none（未着手）／half（解きかけ）／done（採点済み。rate は ○の割合）
    const statusOf = (key) => {
      const parts = Store.partsOf(key);
      const all = parts._;
      if (all && all.ga && all.h && all.h[0] && all.h[0].total) return { s: "done", rate: all.h[0].good / all.h[0].total };
      const any = Object.entries(parts).some(([p, r]) => p !== "_" && (r.a || r.g));
      return { s: any ? "half" : "none" };
    };

    const renderMine = () => {
      if (!mineEl) return;
      const mine = choice();
      const first = !mine.length;
      mineEl.innerHTML = `
        <div class="pm-mine">${info.questions
          .filter((q) => !q.required)
          .map((q) => {
            const on = mine.includes(q.no);
            const field = catalog && catalog.fields.find((f) => f.no === q.field);
            const rate = fieldRates[`${topic}:${q.field}`];
            const tag = first && RECOMMENDED.includes(q.no) ? "おすすめ" : first && SPARE.includes(q.no) ? "予備" : "";
            return `<button type="button" class="pm-mine-chip" data-mine="${q.no}" aria-pressed="${on}">
              <span class="pm-mine-no">問${q.no}${tag ? `<em>${tag}</em>` : ""}</span>
              <span class="pm-mine-name">${escapeHtml(q.name)}</span>
              <span class="pm-mine-rate">${field ? `${pad2(field.no)} ${escapeHtml(field.name)}` : ""}${rate != null ? `<b class="${rate < 60 ? "is-low" : ""}">${rate}%</b>` : ""}</span>
            </button>`;
          })
          .join("")}</div>
        <p class="pm-mine-status" data-mine-status>${
          mine.length
            ? `選んだ問：${mine.map((n) => `問${n}`).join("・")}（${mine.length} / 4）`
            : "押して4つまで選ぶ。おすすめは、問題文の中に答えの根拠がある読解型（問9・10・11・2）。予備に問6（SQL と E-R図の型がほぼ同じ）。午前の正答率が高い技術分野があれば入れ替える。"
        }</p>`;
    };

    const markHtml = (st) => {
      if (st.s === "done") {
        const pct = Math.round(st.rate * 100);
        return `<span class="pm-mark is-done ${pct >= 60 ? "is-good" : "is-warn"}" title="採点済み・○ ${pct}%"></span>`;
      }
      return `<span class="pm-mark is-${st.s}" title="${st.s === "half" ? "解きかけ" : "未着手"}"></span>`;
    };

    const renderGrid = () => {
      if (!gridEl) return;
      const mine = choice();
      const cols = mine.length ? mine : RECOMMENDED;
      const isMine = (no) => no === 1 || cols.includes(no);
      gridEl.innerHTML = `
        <div class="pm-grid-wrap${showAll ? " is-all" : ""}">
          <table class="pm-grid">
            <thead><tr><th scope="col" class="pm-grid-exam">回</th>${info.questions
              .map((q) => `<th scope="col" class="${isMine(q.no) ? "is-mine" : ""}">問${q.no}<small>${escapeHtml(q.name)}</small></th>`)
              .join("")}</tr></thead>
            <tbody>${info.exams
              .map(
                (exam) => `<tr><th scope="row" class="pm-grid-exam">${escapeHtml(exam.short)}<small>${escapeHtml(exam.name)}</small></th>${info.questions
                  .map((q) => {
                    const key = `${exam.id}-${q.no}`;
                    const theme = (exam.themes || [])[q.no - 1] || "";
                    const cls = isMine(q.no) ? "is-mine" : "";
                    if (madeKey.has(key)) {
                      const m = madeKey.get(key);
                      return `<td class="${cls}"><a class="pm-cell is-made" href="${escapeHtml(m.file.split("/").pop())}" title="${escapeHtml(m.title)}">${markHtml(statusOf(key))}<span>${escapeHtml(theme || m.title)}</span></a></td>`;
                    }
                    return `<td class="${cls}"><span class="pm-cell is-todo" title="まだ作っていない">${escapeHtml(theme)}</span></td>`;
                  })
                  .join("")}</tr>`
              )
              .join("")}</tbody>
          </table>
        </div>
        <p class="pm-grid-legend">
          <span>${markHtml({ s: "none" })}未着手</span><span>${markHtml({ s: "half" })}解きかけ</span>
          <span>${markHtml({ s: "done", rate: 1 })}採点済み（○が60%以上）</span><span>${markHtml({ s: "done", rate: 0 })}採点済み（60%未満）</span>
          <span class="pm-cell is-todo">薄い字</span>まだ作っていない問
        </p>
        <p class="pm-grid-toggle"><button type="button" class="button is-secondary" data-grid-all>${showAll ? "問1と私の4問だけにする" : "全部の問を表示"}</button></p>`;
    };

    const renderReview = () => {
      if (!reviewEl) return;
      const sync = window.StudySync;
      const now = Date.now();
      const list = [];
      madeKey.forEach((m, key) => {
        const ids = new Map(); // part → 理由
        Object.entries(Store.partsOf(key)).forEach(([p, r]) => {
          if (p === "_") return;
          const last = r.ga ? r.g : !r.a && r.h && r.h[0] ? r.h[0].grade : null;
          if (last === "fair" || last === "bad") ids.set(p, "wrong");
        });
        const prefix = `appm-${key}-`;
        statsRows.forEach((row) => {
          const id = String(row.question_id);
          if (!id.startsWith(prefix) || !sync || !sync.reviewState) return;
          const st = sync.reviewState(row, now);
          if (st && !ids.has(id.slice(prefix.length))) ids.set(id.slice(prefix.length), st);
        });
        if (ids.size) list.push({ key, m, ids });
      });
      if (!list.length) {
        reviewEl.innerHTML = `<p class="empty">いま見直す設問はない。自己採点で △・× を付けた設問と、そろそろ忘れるころの設問がここに出る。</p>`;
        return;
      }
      reviewEl.innerHTML = `<div class="list">${list
        .map(({ key, m, ids }) => {
          const names = [...ids.keys()].sort().map(partName);
          const wrong = [...ids.values()].filter((x) => x === "wrong").length;
          const due = ids.size - wrong;
          return `<a class="list-item is-water" href="${escapeHtml(m.file.split("/").pop())}?mode=review">
            <span class="list-main">
              <span class="list-date">${escapeHtml(examShort(topic, key.replace(/-\d+$/, "")))} 問${escapeHtml(key.split("-").pop())}</span>
              <span class="list-title">${escapeHtml(names.slice(0, 3).join("・"))}${names.length > 3 ? " ほか" : ""}を見直す</span>
              <span class="list-meta">${[wrong ? `△・×のまま ${wrong}` : "", due ? `そろそろ忘れるころ ${due}` : ""].filter(Boolean).join("・")}</span>
            </span>
            <span class="list-arrow" aria-hidden="true">›</span>
          </a>`;
        })
        .join("")}</div>`;
    };

    const renderAll = () => {
      renderMine();
      renderGrid();
      renderReview();
    };

    main.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-mine]");
      if (chip) {
        const no = Number(chip.dataset.mine);
        let mine = choice();
        if (mine.includes(no)) mine = mine.filter((n) => n !== no);
        else if (mine.length >= 4) {
          const status = main.querySelector("[data-mine-status]");
          if (status) status.textContent = "選べるのは4つまで。どれかを外してから選ぶ。";
          return;
        } else mine = [...mine, no].sort((a, b) => a - b);
        if (notes) notes.set("pm:choice", mine.join(","));
        renderMine();
        renderGrid();
        const again = main.querySelector(`[data-mine="${no}"]`);
        if (again) again.focus();
        return;
      }
      if (e.target.closest("[data-grid-all]")) {
        showAll = !showAll;
        renderGrid();
      }
    });

    renderAll();
    if (notes) notes.onChange(renderAll);
    onUser(async (user) => {
      await Store.pull();
      statsRows = user ? await fetchStats() : [];
      fieldRates = {};
      if (statsRows.length && window.SiteStats) {
        const { byField } = window.SiteStats.aggregate(statsRows);
        Object.entries(byField).forEach(([k, s]) => (fieldRates[k] = window.SiteStats.rateOf(s)));
      }
      renderAll();
    });
  };

  if (mainQ) buildQuestion(mainQ);
  if (mainIndex) buildIndex(mainIndex);
})();
