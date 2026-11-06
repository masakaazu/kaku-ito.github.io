/*
  解説動画プレーヤー

  スライドの画像と台本（JSON）から、読み上げで進む解説動画を流す。
    <main class="video" data-script="11.json" data-terms="../terms/11.md"></main>

  台本の形
    { title, field, fieldName, intro,
      chapters: [ { title, quiz: "問題ID", slides: [ { page, image, lines: [ { t: 字幕, say: 読み上げ（省略時は t）, box: [x, y, w, h]（%） } ] } ] } ] }

  - 読み上げは端末の日本語の声（Web Speech API）を使う。声がない端末では、字幕を時間で進める
  - 話している場所を枠で光らせ、少しズームする（ズームは切り替えられる）
  - 章の終わりに、用語集の問題演習から確認問題を1問出し、回答記録に送る
  - 見ていた場所は端末に保存し、次に開いたときに続きから再生できる
*/
(() => {
  const main = document.querySelector("main.video");
  if (!main) return;

  const KANA = "アイウエ";
  const synth = window.speechSynthesis || null;
  const key = `video:${main.dataset.script}`;

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const load = (k, fallback) => {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  };
  const save = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      /* 保存できなくても再生は続ける */
    }
  };

  /* ---------- 台本を1列に並べる ---------- */

  let script = null;
  let steps = []; // { kind: "line", ch, slide, line } または { kind: "quiz", ch }
  const questions = new Map();

  const flatten = () => {
    steps = [];
    script.chapters.forEach((ch, ci) => {
      ch.slides.forEach((slide) => slide.lines.forEach((line) => steps.push({ kind: "line", ci, slide, line })));
      if (ch.quiz) steps.push({ kind: "quiz", ci, id: ch.quiz });
    });
  };

  // 用語集の md から、確認問題に使う問題だけを読む
  const loadQuestions = async (src, ids) => {
    try {
      const res = await fetch(src, { cache: "no-cache" });
      if (!res.ok) return;
      let q = null;
      (await res.text()).split("\n").forEach((raw) => {
        const line = raw.replace(/\s+$/, "");
        const head = line.match(/^####\s+(?:問\s*)?(\S+)/);
        if (head) {
          q = ids.includes(head[1]) ? { id: head[1], text: "", choices: [], answer: -1, explain: "", notes: [], source: "" } : null;
          if (q) questions.set(q.id, q);
          return;
        }
        if (!q || !/^\s*-\s+/.test(line)) return;
        const body = line.replace(/^\s*-\s+/, "");
        const note = body.match(/^(ア|イ|ウ|エ)の意味[：:]\s*(.*)$/);
        const m = body.match(/^(問|ア|イ|ウ|エ|正解|解説|出典)[：:]\s*(.*)$/);
        if (note) q.notes[KANA.indexOf(note[1])] = note[2];
        else if (m && m[1] === "問") q.text = m[2];
        else if (m && m[1] === "正解") q.answer = KANA.indexOf(m[2].trim());
        else if (m && m[1] === "解説") q.explain = m[2];
        else if (m && m[1] === "出典") q.source = m[2];
        else if (m) q.choices.push(m[2]);
      });
    } catch (e) {
      console.error("[video]", e);
    }
  };

  /* ---------- 状態 ---------- */

  const prefs = load("video:prefs", { rate: 1.1, zoom: true, voice: "" });
  const state = { index: Math.min(load(key, 0), 1e6), playing: false, token: 0, timer: null };

  /* ---------- 声 ---------- */

  let voices = [];
  const pickVoices = () => {
    if (!synth) return;
    voices = synth.getVoices().filter((v) => /^ja(-|_|$)/i.test(v.lang));
    const select = main.querySelector("[data-voice]");
    if (!select) return;
    select.innerHTML = voices.length
      ? voices.map((v) => `<option value="${escapeHtml(v.name)}" ${v.name === prefs.voice ? "selected" : ""}>${escapeHtml(v.name.replace(/^Microsoft |^Google /, ""))}</option>`).join("")
      : `<option value="">（日本語の声なし・字幕だけ）</option>`;
  };

  const speak = (text, done) => {
    const token = state.token;
    const finish = () => {
      if (token === state.token) done();
    };
    const voice = voices.find((v) => v.name === prefs.voice) || voices[0];
    if (!synth || !voice) {
      // 声がないときは、字幕の長さに合わせて進める（1秒に約7文字）
      state.timer = setTimeout(finish, Math.max(2500, (text.length / 7) * 1000) / prefs.rate);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.voice = voice;
    u.rate = prefs.rate;
    u.onend = finish;
    u.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") finish();
    };
    synth.speak(u);
  };

  const silence = () => {
    state.token += 1;
    clearTimeout(state.timer);
    if (synth) synth.cancel();
  };

  /* ---------- 画面 ---------- */

  const build = () => {
    main.innerHTML = `
      <header class="video-head">
        <p class="video-kicker">解説動画・${escapeHtml(String(script.field).padStart(2, "0"))} ${escapeHtml(script.fieldName)}</p>
        <h1>${escapeHtml(script.title)}</h1>
        <p class="video-lead">${escapeHtml(script.intro)}</p>
      </header>
      <div class="video-player" data-player>
        <div class="video-stage" data-stage>
          <div class="video-zoom" data-zoom>
            <img class="video-slide" data-img alt="">
            <div class="video-box" data-box hidden></div>
          </div>
          <button type="button" class="video-big-play" data-big-play aria-label="再生">▶</button>
          <div class="video-quiz" data-quiz hidden></div>
        </div>
        <p class="video-caption" data-caption aria-live="polite"></p>
        <div class="video-progress" data-progress role="slider" aria-label="再生位置" tabindex="0"><span data-progress-bar></span></div>
        <div class="video-controls">
          <button type="button" class="video-btn" data-prev aria-label="前の文へ">⏮</button>
          <button type="button" class="video-btn is-main" data-play aria-label="再生">▶</button>
          <button type="button" class="video-btn" data-next aria-label="次の文へ">⏭</button>
          <span class="video-time" data-time></span>
          <span class="video-spacer"></span>
          <label class="video-opt">速さ
            <select data-rate>${[0.8, 1.0, 1.1, 1.25, 1.5, 1.75].map((r) => `<option value="${r}" ${r === prefs.rate ? "selected" : ""}>${r}×</option>`).join("")}</select>
          </label>
          <label class="video-opt">声 <select data-voice></select></label>
          <label class="video-opt"><input type="checkbox" data-zoom-check ${prefs.zoom ? "checked" : ""}>ズーム</label>
          <button type="button" class="video-btn" data-full aria-label="全画面">⛶</button>
        </div>
      </div>
      <section class="video-chapters">
        <h2>章</h2>
        <ol data-chapters>${script.chapters
          .map((ch, ci) => `<li><button type="button" data-chapter="${ci}"><span>${escapeHtml(ch.title)}</span><small>${ch.slides.length}ページ${ch.quiz ? "・確認問題1問" : ""}</small></button></li>`)
          .join("")}</ol>
        <p class="video-note">読み上げは、この端末に入っている日本語の声を使います。声が出ないときは、端末の消音を切るか、声を選び直してください。キーボードでは、スペースで再生と一時停止、左右の矢印で前後の文へ移れます。</p>
        <p class="video-note"><a href="../terms/${String(script.field).padStart(2, "0")}.html">この分野の用語集（PDF・一覧・カード・クイズ）を開く</a></p>
      </section>`;

    const $ = (s) => main.querySelector(s);
    $("[data-play]").addEventListener("click", toggle);
    $("[data-big-play]").addEventListener("click", toggle);
    $("[data-prev]").addEventListener("click", () => jump(state.index - 1));
    $("[data-next]").addEventListener("click", () => jump(state.index + 1));
    $("[data-rate]").addEventListener("change", (e) => {
      prefs.rate = Number(e.target.value);
      save("video:prefs", prefs);
      if (state.playing) jump(state.index);
    });
    $("[data-voice]").addEventListener("change", (e) => {
      prefs.voice = e.target.value;
      save("video:prefs", prefs);
      if (state.playing) jump(state.index);
    });
    $("[data-zoom-check]").addEventListener("change", (e) => {
      prefs.zoom = e.target.checked;
      save("video:prefs", prefs);
      show();
    });
    // 全画面にできない端末（iPhoneのSafariなど）では、ボタンを出さない
    const player = $("[data-player]");
    if (!player.requestFullscreen && !player.webkitRequestFullscreen) $("[data-full]").hidden = true;
    $("[data-full]").addEventListener("click", () => {
      const el = $("[data-player]");
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    });
    main.querySelectorAll("[data-chapter]").forEach((b) =>
      b.addEventListener("click", () => {
        const ci = Number(b.dataset.chapter);
        jump(steps.findIndex((s) => s.ci === ci));
        if (!state.playing) play();
        $("[data-player]").scrollIntoView({ block: "start", behavior: "smooth" });
      })
    );
    const progress = $("[data-progress]");
    progress.addEventListener("click", (e) => {
      const r = progress.getBoundingClientRect();
      jump(Math.floor(((e.clientX - r.left) / r.width) * steps.length));
    });
    document.addEventListener("keydown", (e) => {
      if (/input|select|textarea/i.test(e.target.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") jump(state.index + 1);
      else if (e.key === "ArrowLeft") jump(state.index - 1);
    });
    pickVoices();
    if (synth) synth.onvoiceschanged = pickVoices;
  };

  // 枠に向けて少しズームする。枠がスライドからはみ出さない範囲で
  const zoomTo = (box) => {
    const z = main.querySelector("[data-zoom]");
    if (!prefs.zoom || !box) {
      z.style.transform = "";
      return;
    }
    const [x, y, w, h] = box;
    const scale = Math.max(1, Math.min(1.45, 70 / Math.max(w, h * 1.2)));
    const cx = x + w / 2;
    const cy = y + h / 2;
    const clamp = (v) => Math.max(-(scale - 1) * 50, Math.min((scale - 1) * 50, v));
    const tx = clamp((50 - cx) * scale);
    const ty = clamp((50 - cy) * scale);
    z.style.transform = `translate(${tx}%, ${ty}%) scale(${scale})`;
  };

  const chapterLength = () => steps.length;
  const lineTimes = () => steps.map((s) => (s.kind === "line" ? (s.line.say || s.line.t).length / 7.5 : 20));
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

  const show = () => {
    const step = steps[state.index];
    if (!step) return;
    const $ = (s) => main.querySelector(s);
    const img = $("[data-img]");
    const box = $("[data-box]");
    const quiz = $("[data-quiz]");
    if (step.kind === "line") {
      const src = step.slide.image;
      if (img.getAttribute("src") !== src) {
        img.classList.remove("is-in");
        img.src = src;
        img.alt = `${step.slide.page}ページ`;
        img.onload = () => img.classList.add("is-in");
      }
      const [x, y, w, h] = step.line.box;
      box.hidden = false;
      box.style.cssText = `left:${x - 0.8}%;top:${y - 1.2}%;width:${w + 1.6}%;height:${h + 2.4}%`;
      zoomTo(step.line.box);
      quiz.hidden = true;
      $("[data-caption]").textContent = step.line.t;
    } else {
      box.hidden = true;
      zoomTo(null);
      $("[data-caption]").textContent = `${script.chapters[step.ci].title}の確認問題`;
    }
    const times = lineTimes();
    const done = times.slice(0, state.index).reduce((a, b) => a + b, 0) / prefs.rate;
    const total = times.reduce((a, b) => a + b, 0) / prefs.rate;
    $("[data-progress-bar]").style.width = `${(state.index / Math.max(1, chapterLength() - 1)) * 100}%`;
    $("[data-time]").textContent = `${clock(done)} / ${clock(total)}`;
    main.querySelectorAll("[data-chapter]").forEach((b) => b.classList.toggle("is-here", Number(b.dataset.chapter) === step.ci));
    save(key, state.index);
  };

  const setPlaying = (on) => {
    state.playing = on;
    const b = main.querySelector("[data-play]");
    b.textContent = on ? "❚❚" : "▶";
    b.setAttribute("aria-label", on ? "一時停止" : "再生");
    main.querySelector("[data-big-play]").hidden = on;
  };

  const run = () => {
    const step = steps[state.index];
    if (!step) {
      setPlaying(false);
      main.querySelector("[data-caption]").textContent = "最後まで再生しました。章を選ぶと、もう一度見られます。";
      state.index = 0;
      save(key, 0);
      return;
    }
    show();
    if (step.kind === "quiz") return showQuiz(step);
    speak(step.line.say || step.line.t, () => {
      state.index += 1;
      // ページが変わるときは少し間を置く
      const next = steps[state.index];
      const pause = next && next.kind === "line" && next.slide !== step.slide ? 700 : 250;
      state.timer = setTimeout(() => state.playing && run(), pause);
    });
  };

  const play = () => {
    setPlaying(true);
    silence();
    run();
  };
  const pause = () => {
    setPlaying(false);
    silence();
  };
  const toggle = () => (state.playing ? pause() : play());

  const jump = (i) => {
    state.index = Math.max(0, Math.min(steps.length - 1, i));
    silence();
    if (state.playing) run();
    else show();
  };

  /* ---------- 章の確認問題 ---------- */

  const showQuiz = (step) => {
    const box = main.querySelector("[data-quiz]");
    const q = questions.get(step.id);
    if (!q || q.answer < 0) {
      state.index += 1;
      return run();
    }
    silence();
    box.hidden = false;
    box.innerHTML = `
      <div class="video-quiz-card">
        <p class="video-quiz-kicker">確認問題・${escapeHtml(script.chapters[step.ci].title)}</p>
        <p class="video-quiz-q">${escapeHtml(q.text)}</p>
        <div class="video-quiz-choices">${q.choices.map((c, i) => `<button type="button" data-a="${i}">${KANA[i]}　${escapeHtml(c)}</button>`).join("")}</div>
        <div data-feedback></div>
      </div>`;
    speak(`ここで確認問題です。${q.text}`, () => {});
    box.querySelectorAll("[data-a]").forEach((b) =>
      b.addEventListener("click", () => {
        if (box.querySelector(".is-correct")) return;
        silence();
        const a = Number(b.dataset.a);
        const ok = a === q.answer;
        box.querySelectorAll("[data-a]").forEach((x) => {
          x.disabled = true;
          if (Number(x.dataset.a) === q.answer) x.classList.add("is-correct");
          else if (x === b) x.classList.add("is-wrong");
        });
        if (window.recordAnswer) window.recordAnswer(q.id, "解説動画", ok);
        box.querySelector("[data-feedback]").innerHTML = `
          <p class="video-quiz-verdict ${ok ? "is-ok" : "is-ng"}">${ok ? "正解" : `不正解。正解は${KANA[q.answer]}`}</p>
          <p class="video-quiz-explain">${escapeHtml(q.explain)}</p>
          ${q.source ? `<p class="video-quiz-source">出典：${escapeHtml(q.source)}</p>` : ""}
          <button type="button" class="video-quiz-next" data-continue>続きを再生 →</button>`;
        speak(`${ok ? "正解です。" : `残念、正解は${KANA[q.answer]}です。`}${q.explain}`, () => {});
        box.querySelector("[data-continue]").addEventListener("click", () => {
          box.hidden = true;
          state.index += 1;
          if (!state.playing) setPlaying(true);
          silence();
          run();
        });
      })
    );
  };

  /* ---------- 組み立て ---------- */

  const start = async () => {
    try {
      const res = await fetch(main.dataset.script, { cache: "no-cache" });
      script = await res.json();
    } catch (e) {
      main.innerHTML = `<p class="video-note">台本を読み込めませんでした。ページを開き直してください。</p>`;
      return;
    }
    flatten();
    if (main.dataset.terms) await loadQuestions(main.dataset.terms, script.chapters.map((c) => c.quiz).filter(Boolean));
    document.title = `${script.title}｜解説動画`;
    if (state.index >= steps.length) state.index = 0;
    build();
    show();
    setPlaying(false);
  };
  start();
})();
