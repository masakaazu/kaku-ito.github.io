/*
  縦型ショート動画のプレーヤー（short.css と組み合わせて使う）

  ■ しくみ
  - ページに 1080×1920 の舞台（.short-stage）を置き、端末の画面に合わせて縮める
  - 時間の基準は1本に混ぜた音声（data-audio の mp3）。音声の再生位置 t 秒に合わせて、
    ページ側で決めた Short.scene(t, tl) が図を描き直す（同じ t なら必ず同じ絵になる）
  - タイムライン（data-timeline の JSON）は { total, lines: [{ who, face, t, s, e }] }。
    s〜e がそのせりふの音声の位置。字幕と立ち絵はここから出す
  - ?record を付けて開くと操作の層を出さず、window.renderAt(t) で好きな時刻の絵にできる
    （tools/short/record.mjs がこれで1コマずつ撮って mp4 にする）
*/
(function () {
  const stage = document.querySelector(".short-stage");
  if (!stage) return;
  const record = new URLSearchParams(location.search).has("record");
  const Short = (window.Short = window.Short || {});
  const cast = {
    z: { name: "ずんだもん", img: "zundamon" },
    m: { name: "四国めたん", img: "metan" },
  };
  const castDir = stage.dataset.cast || "../cast/";

  // ---------- 便利な関数（場面を書くときに使う） ----------
  const clamp = (x) => Math.max(0, Math.min(1, x));
  Short.p = (t, a, b) => clamp((t - a) / (b - a));
  Short.ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // 要素をふわっと出す（p=0 で見えない、1 で出きる）
  Short.show = (el, p, dy = 24) => {
    el.style.opacity = p;
    el.style.transform = p >= 1 ? "" : `translateY(${(1 - Short.ease(p)) * dy}px)`;
    el.style.visibility = p <= 0 ? "hidden" : "visible";
  };
  // 線を引く（stroke-dashoffset で伸ばす）
  Short.draw = (path, p) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len * (1 - p)}`;
  };
  // 光る点を線の上で動かす
  Short.move = (dot, path, p) => {
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len * Short.ease(clamp(p)));
    dot.setAttribute("cx", pt.x);
    dot.setAttribute("cy", pt.y);
    dot.style.opacity = p > 0 && p < 1 ? 1 : 0;
  };

  // ---------- 舞台を画面に合わせる ----------
  function fit() {
    if (record) {
      stage.style.transform = "none";
      stage.style.left = "0";
      stage.style.top = "0";
      return;
    }
    const s = Math.min(innerWidth / 1080, innerHeight / 1920);
    stage.style.transform = `translate(${-540 * s}px, ${-960 * s}px) scale(${s})`;
  }
  addEventListener("resize", fit);
  fit();

  // ---------- 字幕・立ち絵・進み具合 ----------
  let tl = null;
  const cap = stage.querySelector("[data-cap]");
  const capImg = cap && cap.querySelector("img");
  const capWho = cap && cap.querySelector(".who");
  const capTxt = cap && cap.querySelector(".txt");
  const bar = stage.querySelector("[data-bar]");
  let lastKey = "";

  function render(t) {
    if (!tl) return;
    let line = null;
    for (const l of tl.lines) if (t >= l.s - 0.15) line = l;
    if (cap) {
      cap.style.opacity = line ? 1 : 0;
      if (line) {
        const key = line.s + line.face;
        if (key !== lastKey) {
          lastKey = key;
          capImg.src = `${castDir}${cast[line.who].img}-${line.face || "normal"}.webp`;
          capImg.alt = cast[line.who].name;
          capWho.textContent = cast[line.who].name;
          capWho.className = `who ${line.who}`;
          capTxt.textContent = line.t;
        }
        // 話しているあいだ、立ち絵を少し弾ませる
        const talking = t >= line.s && t <= line.e;
        capImg.style.transform = talking ? `translateY(${-Math.abs(Math.sin(t * 9)) * 6}px)` : "";
      }
    }
    if (bar) bar.style.width = `${(Math.min(t, tl.total) / tl.total) * 100}%`;
    if (Short.scene) Short.scene(t, tl);
  }

  // ---------- 再生 ----------
  const audio = new Audio(stage.dataset.audio);
  audio.preload = "auto";
  const ui = document.querySelector(".short-ui");
  let playing = false;

  function loop() {
    if (!playing) return;
    render(audio.currentTime);
    if (audio.ended) return stop(true);
    requestAnimationFrame(loop);
  }
  function play() {
    if (audio.ended || audio.currentTime >= tl.total - 0.05) audio.currentTime = 0;
    audio.play().catch(() => {});
    playing = true;
    if (ui) ui.hidden = true;
    requestAnimationFrame(loop);
  }
  function stop(ended) {
    playing = false;
    audio.pause();
    if (ui) {
      ui.hidden = false;
      const btn = ui.querySelector(".play");
      if (btn) btn.textContent = ended ? "↺" : "▶";
    }
  }

  fetch(stage.dataset.timeline)
    .then((r) => r.json())
    .then((data) => {
      tl = data;
      window.renderAt = (t) => render(t);
      render(0);
      window.__shortReady = true;
      if (record) {
        if (ui) ui.remove();
        return;
      }
      ui.querySelector(".play").addEventListener("click", (e) => {
        e.stopPropagation();
        play();
      });
      const again = ui.querySelector("[data-again]");
      if (again)
        again.addEventListener("click", (e) => {
          e.stopPropagation();
          audio.currentTime = 0;
          play();
        });
      // 再生中に画面をタップすると一時停止
      document.querySelector(".short-wrap").addEventListener("click", () => {
        if (playing) stop(false);
      });
      addEventListener("keydown", (e) => {
        if (e.key === " ") {
          e.preventDefault();
          playing ? stop(false) : play();
        }
      });
    });
})();
