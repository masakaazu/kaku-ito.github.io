/*
  午前の模擬試験（応用情報）

  各分野の用語集（terms/NN.md）の「## 問題演習」から、本番に近い配分で問題を選んで出す。
    - 本番の午前は 80問・150分。テクノロジ系 50問・マネジメント系 10問・ストラテジ系 20問
    - 分野ごとの問題数は FIELD_WEIGHT（過去問の出題数のおおよその割合）で決める
    - 問題が足りない分野の分は、同じ系の別の分野から、それでも足りなければ他の系から出す
  途中の状態は端末に保存するので、ページを閉じても続きから再開できる。
  採点したら、答えた問題を recordAnswer（回答記録）に送る。成績の履歴は端末に残す。
*/
(() => {
  const main = document.querySelector("main.exam");
  if (!main) return;

  const topic = main.dataset.topic || "ap";
  const KANA = "アイウエ";
  const FULL = { count: 80, minutes: 150, groups: { technology: 50, management: 10, strategy: 20 } };
  const PASS = 0.6;

  // 分野ごとの出題の重み（平成21年度〜令和7年度の午前で、おおよそ何問出るか）
  const FIELD_WEIGHT = {
    1: 4, 2: 3, 3: 4, 4: 4, 5: 3, 6: 2, 7: 1, 8: 1, 9: 5, 10: 5, 11: 10, 12: 5, 13: 3,
    14: 4, 15: 4, 16: 2,
    17: 3, 18: 3, 19: 4, 20: 1, 21: 3, 22: 4, 23: 2,
  };

  const KEY_CURRENT = `exam:${topic}:current`;
  const KEY_HISTORY = `exam:${topic}:history`;
  const KEY_OPTIONS = `exam:${topic}:options`;

  /* ---------- 小さな道具 ---------- */

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const unescape = (text) => text.replace(/\\([\\`*_{}[\]()#+\-.!&:<>|~])/g, "$1");
  const inline = (text) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const load = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  };
  const save = (key, value) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 保存できなくても試験は続けられる */
    }
  };

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const clock = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };
  const dateText = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  /* ---------- 問題を読む ---------- */

  // md の「## 問題演習」より下だけを読む（書式は terms.js と同じ）
  const parseQuestions = (md) => {
    const list = [];
    let inQuestions = false;
    let section = "";
    let q = null;
    md.replace(/\r\n?/g, "\n").split("\n").forEach((raw) => {
      const line = unescape(raw.replace(/\s+$/, ""));
      if (/^##\s/.test(line)) {
        inQuestions = /^##\s+問題演習/.test(line);
        q = null;
        return;
      }
      if (!inQuestions) return;
      if (/^###\s/.test(line)) {
        section = line.replace(/^###\s+/, "");
        q = null;
      } else if (/^####\s/.test(line)) {
        q = { id: line.replace(/^####\s+(問\s*)?/, "").trim(), section, text: "", choices: [], answer: -1, explain: "", notes: [], source: "" };
        list.push(q);
      } else if (q && /^\s*-\s+/.test(line)) {
        const body = line.replace(/^\s*-\s+/, "");
        const note = body.match(/^(ア|イ|ウ|エ)の意味[：:]\s*(.*)$/);
        const m = body.match(/^(問|ア|イ|ウ|エ|正解|解説|出典)[：:]\s*(.*)$/);
        if (note) q.notes[KANA.indexOf(note[1])] = note[2];
        else if (m && m[1] === "問") q.text = m[2];
        else if (m && m[1] === "出典") q.source = m[2];
        else if (m && m[1] === "正解") q.answer = KANA.indexOf(m[2].trim());
        else if (m && m[1] === "解説") q.explain = m[2];
        else if (m) q.choices.push(m[2]);
      }
    });
    return list.filter((x) => x.id && x.text && x.choices.length === 4 && x.answer >= 0);
  };

  const isPast = (q) => /^IPA/.test(q.source);

  let fields = []; // { no, name, group, questions }
  const byId = new Map();

  const fieldList = () => {
    const catalog = window.SITE_CATALOG;
    const files = new Map(
      ((catalog.materials && catalog.materials[topic]) || [])
        .filter((m) => m.type === "terms" && m.fields && /^terms\/\d+\.html$/.test(m.file))
        .map((m) => [m.fields[0], m.file.replace(/\.html$/, ".md")])
    );
    return catalog.fields.filter((f) => files.has(f.no)).map((f) => ({ no: f.no, name: f.name, group: f.group, src: files.get(f.no) }));
  };

  const loadAll = async () => {
    const list = fieldList();
    const failed = [];
    await Promise.all(
      list.map(async (f) => {
        try {
          const res = await fetch(f.src, { cache: "no-cache" });
          if (!res.ok) throw new Error(`${f.src} ${res.status}`);
          f.questions = parseQuestions(await res.text());
          f.questions.forEach((q) => {
            q.field = f.no;
            byId.set(q.id, q);
          });
        } catch (error) {
          console.error("[exam]", error);
          f.questions = [];
          failed.push(f.name);
        }
      })
    );
    fields = list;
    return failed;
  };

  /* ---------- 出題する問題を選ぶ ---------- */

  const pick = ({ count, pastOnly }) => {
    const scale = count / FULL.count;
    const usable = (f) => f.questions.filter((q) => !pastOnly || isPast(q));
    const chosen = [];
    const left = new Map(fields.map((f) => [f.no, shuffle(usable(f))]));
    const take = (no, n) => {
      const pool = left.get(no) || [];
      const got = pool.splice(0, n);
      chosen.push(...got);
      return got.length;
    };

    let shortTotal = 0;
    Object.entries(FULL.groups).forEach(([group, full]) => {
      const gFields = fields.filter((f) => f.group === group);
      let quota = Math.round(full * scale);
      // 重みに比例して割り当てる（端数は重みの大きい分野から）
      const weightSum = gFields.reduce((s, f) => s + (FIELD_WEIGHT[f.no] || 1), 0);
      const plan = gFields.map((f) => ({ no: f.no, raw: ((FIELD_WEIGHT[f.no] || 1) / weightSum) * quota }));
      plan.forEach((p) => (p.n = Math.floor(p.raw)));
      let rest = quota - plan.reduce((s, p) => s + p.n, 0);
      [...plan].sort((a, b) => b.raw - b.n - (a.raw - a.n)).forEach((p) => {
        if (rest > 0) {
          p.n += 1;
          rest -= 1;
        }
      });
      let short = 0;
      plan.forEach((p) => (short += p.n - take(p.no, p.n)));
      // 足りない分は、同じ系で問題が残っている分野から順に出す
      while (short > 0) {
        const more = gFields.filter((f) => left.get(f.no).length);
        if (!more.length) break;
        more.forEach((f) => {
          if (short > 0) short -= take(f.no, 1);
        });
      }
      shortTotal += short;
    });
    // それでも足りなければ、他の系から出す
    while (shortTotal > 0) {
      const more = fields.filter((f) => left.get(f.no).length);
      if (!more.length) break;
      more.forEach((f) => {
        if (shortTotal > 0) shortTotal -= take(f.no, 1);
      });
    }
    // 本番と同じように分野の番号順に並べる（分野の中はランダム）
    const order = new Map(fields.map((f, i) => [f.no, i]));
    return chosen.sort((a, b) => order.get(a.field) - order.get(b.field));
  };

  /* ---------- 状態 ---------- */

  let exam = load(KEY_CURRENT, null); // { ids, answers, flags, index, startedAt, endsAt, minutes, pastOnly }
  let timer = null;

  const saveExam = () => save(KEY_CURRENT, exam);
  const questionsOf = (e) => e.ids.map((id) => byId.get(id)).filter(Boolean);

  /* ---------- 画面：はじめ ---------- */

  const groupName = (id) => ((window.SITE_CATALOG.groups || []).find((g) => g.id === id) || {}).name || id;
  const fieldName = (no) => (fields.find((f) => f.no === no) || {}).name || `分野${no}`;

  const renderStart = (failed = []) => {
    stopTimer();
    const options = load(KEY_OPTIONS, { count: 80, pastOnly: true, timed: true });
    const history = load(KEY_HISTORY, []);
    const pastCount = fields.reduce((s, f) => s + f.questions.filter(isPast).length, 0);
    const allCount = fields.reduce((s, f) => s + f.questions.length, 0);
    const empty = fields.filter((f) => !f.questions.filter(isPast).length).map((f) => String(f.no).padStart(2, "0"));
    main.innerHTML = `
      <header class="terms-hero">
        <p class="terms-kicker">応用情報・午前</p>
        <h1>午前の模擬試験</h1>
        <p class="terms-lead">本番と同じ80問・150分。テクノロジ系50問・マネジメント系10問・ストラテジ系20問の配分で、各分野の問題演習から出します。</p>
        <p class="terms-stats">使える問題：過去問 ${pastCount}問・オリジナルを含めると ${allCount}問</p>
      </header>
      ${failed.length ? `<p class="exam-alert">読み込めなかった分野：${escapeHtml(failed.join("・"))}</p>` : ""}
      <section class="exam-panel">
        <h2>試験の設定</h2>
        <div class="exam-options">
          <label>問題数
            <select data-opt-count>
              ${[80, 40, 20].map((n) => `<option value="${n}" ${options.count === n ? "selected" : ""}>${n}問（${Math.round((FULL.minutes * n) / FULL.count)}分）</option>`).join("")}
            </select>
          </label>
          <label class="exam-check"><input type="checkbox" data-opt-past ${options.pastOnly ? "checked" : ""}>IPAの過去問だけ出す</label>
          <label class="exam-check"><input type="checkbox" data-opt-timed ${options.timed ? "checked" : ""}>時間を計る（時間切れで自動的に採点）</label>
        </div>
        ${empty.length ? `<p class="exam-note">分野 ${empty.join("・")} は過去問がまだないため、その分は同じ系の別の分野から出します。</p>` : ""}
        <div class="terms-controls"><button type="button" class="terms-button is-primary" data-start>試験を始める</button></div>
      </section>
      ${
        history.length
          ? `<section class="exam-panel">
        <h2>これまでの成績</h2>
        <div class="exam-table"><table>
          <thead><tr><th>日時</th><th>得点</th><th>テクノロジ</th><th>マネジメント</th><th>ストラテジ</th><th>時間</th></tr></thead>
          <tbody>${history
            .slice()
            .reverse()
            .slice(0, 20)
            .map(
              (h) => `<tr><td>${dateText(h.at)}</td><td class="${h.correct / h.total >= PASS ? "is-pass" : "is-fail"}"><b>${pct(h.correct, h.total)}%</b>（${h.correct}/${h.total}）</td>${["technology", "management", "strategy"]
                .map((g) => (h.groups[g] ? `<td>${pct(h.groups[g][0], h.groups[g][1])}%</td>` : "<td>—</td>"))
                .join("")}<td>${clock(h.usedMs)}</td></tr>`
            )
            .join("")}</tbody>
        </table></div>
        <p class="exam-note">成績の履歴はこの端末にだけ残ります。1問ずつの正誤は、ログインしていれば回答記録にも残ります。</p>
      </section>`
          : ""
      }`;

    main.querySelector("[data-start]").addEventListener("click", () => {
      const opts = {
        count: Number(main.querySelector("[data-opt-count]").value),
        pastOnly: main.querySelector("[data-opt-past]").checked,
        timed: main.querySelector("[data-opt-timed]").checked,
      };
      save(KEY_OPTIONS, opts);
      const list = pick(opts);
      if (!list.length) return;
      const minutes = Math.round((FULL.minutes * list.length) / FULL.count);
      const now = Date.now();
      exam = {
        ids: list.map((q) => q.id),
        answers: {},
        flags: {},
        index: 0,
        startedAt: now,
        endsAt: opts.timed ? now + minutes * 60000 : null,
        minutes,
        pastOnly: opts.pastOnly,
      };
      saveExam();
      renderExam();
      window.scrollTo({ top: 0 });
    });
  };

  /* ---------- 画面：試験中 ---------- */

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const tick = () => {
    const el = main.querySelector("[data-clock]");
    if (!el || !exam) return;
    if (exam.endsAt) {
      const left = exam.endsAt - Date.now();
      el.textContent = `残り ${clock(left)}`;
      el.classList.toggle("is-low", left < 10 * 60000);
      if (left <= 0) finish(true);
    } else {
      el.textContent = `経過 ${clock(Date.now() - exam.startedAt)}`;
    }
  };

  const renderExam = () => {
    const list = questionsOf(exam);
    if (!list.length) {
      exam = null;
      saveExam();
      renderStart();
      return;
    }
    exam.index = Math.min(Math.max(exam.index, 0), list.length - 1);
    const q = list[exam.index];
    const answered = Object.keys(exam.answers).length;
    const chosen = exam.answers[q.id];
    main.innerHTML = `
      <div class="exam-bar">
        <span class="exam-bar-count">第${exam.index + 1}問 / ${list.length}</span>
        <span class="exam-bar-done">回答 ${answered}</span>
        <span class="exam-bar-clock" data-clock></span>
      </div>
      <div class="quiz-card exam-card">
        <p class="flash-count">問${exam.index + 1}<span>${escapeHtml(fieldName(q.field))}</span></p>
        <p class="quiz-question">${inline(q.text)}</p>
        <div class="quiz-choices">${q.choices
          .map((c, i) => `<button type="button" class="quiz-choice ${chosen === i ? "is-selected" : ""}" data-choice="${i}" aria-pressed="${chosen === i}">${KANA[i]}　${inline(c)}</button>`)
          .join("")}</div>
        <label class="exam-check exam-flag"><input type="checkbox" data-flag ${exam.flags[q.id] ? "checked" : ""}>あとで見直す</label>
        <div class="terms-controls">
          <button type="button" class="terms-button" data-move="-1" ${exam.index === 0 ? "disabled" : ""}>← 前へ</button>
          <button type="button" class="terms-button ${exam.index < list.length - 1 ? "is-primary" : ""}" data-move="1" ${exam.index === list.length - 1 ? "disabled" : ""}>次へ →</button>
        </div>
      </div>
      <section class="exam-panel">
        <h2>問題の一覧</h2>
        <p class="exam-note">青＝答えた問題、橙の点＝あとで見直す問題。番号を押すとその問題へ移ります。</p>
        <div class="exam-grid">${list
          .map((x, i) => {
            const cls = [exam.answers[x.id] !== undefined ? "is-done" : "", exam.flags[x.id] ? "is-flag" : "", i === exam.index ? "is-here" : ""].join(" ");
            return `<button type="button" class="exam-cell ${cls}" data-go="${i}" aria-label="問${i + 1}">${i + 1}</button>`;
          })
          .join("")}</div>
        <div class="exam-finish" data-finish-box>
          <button type="button" class="terms-button is-primary" data-finish>採点する</button>
          <button type="button" class="terms-button" data-quit>やめる</button>
        </div>
      </section>`;

    main.querySelectorAll("[data-choice]").forEach((b) =>
      b.addEventListener("click", () => {
        const i = Number(b.dataset.choice);
        if (exam.answers[q.id] === i) delete exam.answers[q.id];
        else exam.answers[q.id] = i;
        saveExam();
        renderExam();
      })
    );
    main.querySelector("[data-flag]").addEventListener("change", (e) => {
      if (e.target.checked) exam.flags[q.id] = true;
      else delete exam.flags[q.id];
      saveExam();
      renderExam();
    });
    main.querySelectorAll("[data-move]").forEach((b) =>
      b.addEventListener("click", () => {
        exam.index += Number(b.dataset.move);
        saveExam();
        renderExam();
        main.querySelector(".exam-card").scrollIntoView({ block: "start" });
      })
    );
    main.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", () => {
        exam.index = Number(b.dataset.go);
        saveExam();
        renderExam();
        main.querySelector(".exam-card").scrollIntoView({ block: "start" });
      })
    );
    // 採点・中止は、ボタンの下に確認を出してから行う（ブラウザの確認ダイアログは使わない）
    const confirmBox = (text, label, action) => {
      const box = main.querySelector("[data-finish-box]");
      box.innerHTML = `<p class="exam-confirm">${text}</p>
        <button type="button" class="terms-button is-primary" data-yes>${label}</button>
        <button type="button" class="terms-button" data-no>戻る</button>`;
      box.querySelector("[data-yes]").addEventListener("click", action);
      box.querySelector("[data-no]").addEventListener("click", renderExam);
    };
    main.querySelector("[data-finish]").addEventListener("click", () => {
      const blank = list.length - answered;
      confirmBox(blank ? `まだ答えていない問題が${blank}問あります（不正解として数えます）。採点しますか。` : "採点しますか。", "採点する", () => finish(false));
    });
    main.querySelector("[data-quit]").addEventListener("click", () =>
      confirmBox("この試験をやめますか。答えは保存されず、成績にも残りません。", "やめる", () => {
        exam = null;
        saveExam();
        renderStart();
      })
    );

    if (!timer) timer = setInterval(tick, 1000);
    tick();
  };

  /* ---------- 画面：結果 ---------- */

  const finish = (timeUp) => {
    stopTimer();
    if (!exam) return;
    const list = questionsOf(exam);
    const now = Date.now();
    const usedMs = Math.min(now, exam.endsAt || now) - exam.startedAt;
    const result = { at: now, total: list.length, correct: 0, usedMs, timeUp, groups: {}, fields: {}, ids: exam.ids, answers: exam.answers };
    list.forEach((q) => {
      const ok = exam.answers[q.id] === q.answer;
      const f = fields.find((x) => x.no === q.field);
      const g = (result.groups[f.group] ||= [0, 0]);
      const fs = (result.fields[q.field] ||= [0, 0]);
      g[1] += 1;
      fs[1] += 1;
      if (ok) {
        result.correct += 1;
        g[0] += 1;
        fs[0] += 1;
      }
      // 答えた問題だけを回答記録に送る（答えなかった問題は記録しない）
      if (exam.answers[q.id] !== undefined && window.recordAnswer) window.recordAnswer(q.id, q.section || "問題演習", ok);
    });
    const history = load(KEY_HISTORY, []);
    history.push({ at: result.at, total: result.total, correct: result.correct, usedMs, groups: result.groups });
    save(KEY_HISTORY, history.slice(-50));
    exam = null;
    saveExam();
    renderResult(result, list);
    window.scrollTo({ top: 0 });
  };

  const bar = (a, b) => {
    const p = pct(a, b);
    return `<span class="exam-meter ${a / b >= PASS ? "" : "is-low"}"><span style="width:${p}%"></span></span>`;
  };

  const renderResult = (result, list) => {
    const rate = result.correct / result.total;
    const wrong = list.filter((q) => result.answers[q.id] !== q.answer);
    main.innerHTML = `
      <header class="terms-hero">
        <p class="terms-kicker">午前の模擬試験・結果${result.timeUp ? "（時間切れ）" : ""}</p>
        <h1 class="exam-score ${rate >= PASS ? "is-pass" : "is-fail"}">${pct(result.correct, result.total)}<small>%</small></h1>
        <p class="terms-lead">${result.correct} / ${result.total}問 正解。${rate >= PASS ? "合格ライン（60%）を超えています。" : `合格ライン（60%）まであと${Math.ceil(result.total * PASS) - result.correct}問。`}</p>
        <p class="terms-stats">かかった時間 ${clock(result.usedMs)}</p>
      </header>
      <section class="exam-panel">
        <h2>系ごとの正答率</h2>
        <div class="exam-table"><table><tbody>${["technology", "management", "strategy"]
          .filter((g) => result.groups[g])
          .map((g) => {
            const [a, b] = result.groups[g];
            return `<tr><th>${escapeHtml(groupName(g))}</th><td class="exam-num">${a}/${b}</td><td class="exam-num"><b>${pct(a, b)}%</b></td><td class="exam-bar-cell">${bar(a, b)}</td></tr>`;
          })
          .join("")}</tbody></table></div>
      </section>
      <section class="exam-panel">
        <h2>分野ごとの正答率</h2>
        <p class="exam-note">60%未満の分野は赤で示します。分野名を押すと、その分野の用語集を開きます。</p>
        <div class="exam-table"><table><tbody>${fields
          .filter((f) => result.fields[f.no])
          .map((f) => {
            const [a, b] = result.fields[f.no];
            return `<tr class="${a / b >= PASS ? "" : "is-fail"}"><th><a href="terms/${String(f.no).padStart(2, "0")}.html">${String(f.no).padStart(2, "0")} ${escapeHtml(f.name)}</a></th><td class="exam-num">${a}/${b}</td><td class="exam-num"><b>${pct(a, b)}%</b></td><td class="exam-bar-cell">${bar(a, b)}</td></tr>`;
          })
          .join("")}</tbody></table></div>
      </section>
      <section class="exam-panel">
        <h2>間違えた問題（${wrong.length}問）</h2>
        ${wrong.length ? `<p class="exam-note">ログインしていれば、ここで間違えた問題は各分野の「前に間違えた問題」にも入ります。</p>` : `<p class="exam-note">全問正解です。</p>`}
        <div class="exam-review">${wrong
          .map((q) => {
            const mine = result.answers[q.id];
            const n = list.indexOf(q) + 1;
            return `<details class="exam-item">
              <summary><span class="exam-item-no">問${n}</span>${escapeHtml(fieldName(q.field))}<span class="exam-item-ans">${mine === undefined ? "未回答" : `あなた ${KANA[mine]}`} → 正解 ${KANA[q.answer]}</span></summary>
              <p class="quiz-question">${inline(q.text)}</p>
              <ul class="exam-choices">${q.choices
                .map((c, i) => `<li class="${i === q.answer ? "is-answer" : i === mine ? "is-mine" : ""}"><b>${KANA[i]}</b>　${inline(c)}</li>`)
                .join("")}</ul>
              ${q.explain ? `<p class="term-meaning">${inline(q.explain)}</p>` : ""}
              ${
                q.notes.some(Boolean)
                  ? `<p class="quiz-others-title">選択肢の意味</p><ul class="quiz-others">${q.choices
                      .map((c, i) => (q.notes[i] ? `<li class="${i === q.answer ? "is-answer" : ""}"><b>${KANA[i]}</b>　${inline(q.notes[i])}</li>` : ""))
                      .join("")}</ul>`
                  : ""
              }
              ${q.source ? `<p class="quiz-source">出典：${escapeHtml(q.source)}</p>` : ""}
            </details>`;
          })
          .join("")}</div>
        <div class="terms-controls"><button type="button" class="terms-button is-primary" data-again>もう一度受ける</button></div>
      </section>`;
    main.querySelector("[data-again]").addEventListener("click", () => {
      renderStart();
      window.scrollTo({ top: 0 });
    });
  };

  /* ---------- 組み立て ---------- */

  const start = async () => {
    main.innerHTML = `<p class="terms-empty">問題を読み込んでいます…</p>`;
    const failed = await loadAll();
    // 途中の試験があれば続きから。時間切れになっていたら採点する
    if (exam && exam.ids && questionsOf(exam).length) {
      if (exam.endsAt && exam.endsAt <= Date.now()) finish(true);
      else renderExam();
    } else {
      exam = null;
      renderStart(failed);
    }
  };

  const waitCatalog = () => {
    if (window.SITE_CATALOG) return start();
    setTimeout(waitCatalog, 50);
  };
  waitCatalog();
})();
