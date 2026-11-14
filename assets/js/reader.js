/*
  図解スライドを、そのままページの中で読むための画面。
  PDF と違って、1枚ごとにメモを書けて、その枚に出てくる用語の意味をその場で開ける。

  使い方（各資格の read.html）：
    <main class="reader" data-topic="ap"></main>
    <script src="../assets/js/study-sync.js"></script>
    <script src="../assets/js/catalog.js"></script>
    <script src="../assets/js/reader.js"></script>
    <script src="../assets/js/site.js"></script>
  URL は read.html?f=6（分野の番号）。

  もとになるもの：
    - スライド：tools/slides/<資格>-NN.html（PDF を作るもとの HTML。1枚＝<section class="slide">）
    - 用語：<資格>/terms/NN.md（用語集と同じファイル。意味・たとえ・ポイントを使う）

  メモのキーは「slide:ap:6:見出し」。見出しで覚えるので、スライドの順番が変わってもメモは付いたまま。
  色は theme.css。スライドの中だけは、PDF と同じ見た目になるように、スライド自身の色を使う。
*/
(function () {
  const main = document.querySelector("main.reader");
  if (!main) return;

  const topic = main.dataset.topic || "ap";
  const fieldNo = Number(new URLSearchParams(location.search).get("f")) || 0;
  const nn = String(fieldNo).padStart(2, "0");
  const slideBase = `../tools/slides/`;
  const slideUrl = `${slideBase}${topic}-${nn}.html`;
  const termsUrl = `terms/${nn}.md`;
  const notes = window.StudyNotes || null;
  const SLIDE_W = 960;
  const ZOOM_SCALE = 0.85; // 押して拡大したときの倍率（スライドの幅 960px に対して）

  const escapeHtml = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const inline = (s) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  /* ---------- 用語（md から、見出し・意味・たとえ・ポイントだけ読む） ---------- */

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
        // 見出しのカッコ内の略語（「FPGA: Field …」の FPGA）でも探せるようにする
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

  // その枚の文字に出てくる用語を、出てくる順に返す。英数字だけの短い言葉は、単語の切れ目も見る
  const termsIn = (text, terms) => {
    const found = [];
    terms.forEach((term) => {
      let at = -1;
      term.keys.forEach((key) => {
        if (key.length < 2) return;
        let i;
        if (/^[A-Za-z0-9./+-]+$/.test(key)) {
          const m = new RegExp(`(^|[^A-Za-z0-9])${key.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")}(?![A-Za-z0-9])`).exec(text);
          i = m ? m.index + m[1].length : -1;
        } else i = text.indexOf(key);
        if (i >= 0 && (at < 0 || i < at)) at = i;
      });
      if (at >= 0) found.push({ term, at });
    });
    return found.sort((a, b) => a.at - b.at).map((f) => f.term);
  };

  /* ---------- メモ ---------- */

  const memoInner = (key) => {
    const body = notes ? notes.get(key) : "";
    return body
      ? `<p class="memo-text">${escapeHtml(body).replace(/\n/g, "<br>")}</p><button type="button" class="memo-edit" data-memo-edit>メモを直す</button>`
      : `<button type="button" class="memo-edit" data-memo-edit>このページにメモを書く</button>`;
  };
  const memoBlock = (key) => (notes ? `<div class="memo" data-memo-key="${escapeHtml(key)}">${memoInner(key)}</div>` : "");

  const setupMemos = () => {
    if (!notes) return;
    const close = (box, save) => {
      const area = box.querySelector("textarea");
      if (area && save) notes.set(box.dataset.memoKey, area.value);
      box.innerHTML = memoInner(box.dataset.memoKey);
      updateMemoCount();
    };
    main.addEventListener("click", (e) => {
      const box = e.target.closest("[data-memo-key]");
      if (!box) return;
      if (e.target.closest("[data-memo-edit]")) {
        box.innerHTML = `
          <textarea class="memo-input" rows="3" placeholder="気づいたこと・覚え方・自分の言葉での説明など">${escapeHtml(notes.get(box.dataset.memoKey))}</textarea>
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
    main.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || !e.target.matches(".memo-input")) return;
      close(e.target.closest("[data-memo-key]"), true);
    });
    notes.onChange(() => {
      main.querySelectorAll("[data-memo-key]").forEach((box) => {
        if (!box.querySelector("textarea")) box.innerHTML = memoInner(box.dataset.memoKey);
      });
      updateMemoCount();
    });
  };

  const updateMemoCount = () => {
    const out = main.querySelector("[data-memo-count]");
    if (!out) return;
    const n = main.querySelectorAll(".reader-page .memo-text").length;
    out.textContent = n ? `メモを書いたページ ${n}枚` : "";
    main.querySelectorAll("[data-toc-page]").forEach((a) => {
      const page = document.getElementById(a.dataset.tocPage);
      a.classList.toggle("has-memo", !!(page && page.querySelector(".memo-text")));
    });
  };

  /* ---------- スライド ---------- */

  // スライドの中だけに効かせる追加の決まり。字の幅が端末で違ってもはみ出して切れないよう、高さは中身に合わせる
  const EXTRA_CSS = `
    :host { display: block; position: relative; }
    .slide { height: auto !important; min-height: 540px; overflow: visible !important; padding-bottom: 64px !important; page-break-after: auto !important; }
    body, .slide { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif; color: #1d1d1f; }
    .fit { position: absolute; left: 0; top: 0; width: ${SLIDE_W}px; transform-origin: 0 0; }
    img.is-missing { display: none !important; }
  `;

  const fitAll = () => {
    main.querySelectorAll(".reader-slide").forEach((host) => {
      const fit = host.shadowRoot && host.shadowRoot.querySelector(".fit");
      if (!fit) return;
      // スマホでは字が小さくなるので、スライドを押すと拡大して横に動かせる
      const scale = host.classList.contains("is-zoom") ? Math.max(host.clientWidth / SLIDE_W, ZOOM_SCALE) : host.clientWidth / SLIDE_W;
      fit.style.transform = `scale(${scale})`;
      host.style.height = `${Math.ceil(fit.offsetHeight * scale)}px`;
    });
  };

  const titleOf = (section) => {
    const h1 = section.querySelector("h1");
    if (!h1) return "";
    const clone = h1.cloneNode(true);
    clone.querySelectorAll("small").forEach((s) => s.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  };

  const termPanel = (term) => `
    <div class="reader-term-panel">
      <p class="reader-term-name">${escapeHtml(term.name)}${term.sub ? `<span>${escapeHtml(term.sub)}</span>` : ""}</p>
      <p class="term-meaning">${inline(term.meaning)}</p>
      ${term.analogy ? `<p class="term-line term-analogy"><span class="term-label">たとえ</span>${inline(term.analogy)}</p>` : ""}
      ${term.point ? `<p class="term-line"><span class="term-label">ポイント</span>${inline(term.point)}</p>` : ""}
    </div>`;

  const build = async () => {
    let fieldName = "";
    const catalog = window.SITE_CATALOG;
    if (catalog) {
      const fields = (catalog.topics[topic] && catalog.topics[topic].fields) || catalog.fields || [];
      const f = fields.find((x) => x.no === fieldNo);
      if (f) fieldName = f.name;
    }

    main.innerHTML = `<p class="terms-loading">読み込んでいます…</p>`;
    let html;
    try {
      const res = await fetch(slideUrl, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      html = await res.text();
    } catch (error) {
      main.innerHTML = `
        <header class="terms-hero">
          <p class="terms-kicker">図解</p>
          <h1>この分野の図解は、まだありません</h1>
          <p><a class="terms-button" href="field.html?f=${fieldNo}">分野のページへ戻る</a></p>
        </header>`;
      return;
    }
    let terms = [];
    try {
      const res = await fetch(termsUrl, { cache: "no-cache" });
      if (res.ok) terms = parseTerms(await res.text());
    } catch (error) {
      /* 用語が読めなくても、スライドとメモは使える */
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n").replace(/:root\b/g, ":host") + EXTRA_CSS; // スライドの色の変数（:root）を、スライドの箱の中で効かせる
    const sections = [...doc.querySelectorAll("section.slide")];
    if (!fieldName) fieldName = (doc.title || "").replace(/^.*#\d+\s*/, "").replace(/\s*図解.*$/, "");

    let sheet = null;
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
    } catch (error) {
      sheet = null; // 古いブラウザは <style> を1枚ずつ入れる
    }

    const seen = {};
    const toc = [];
    let chapter = null;
    const pages = sections.map((section, index) => {
      const title = titleOf(section) || `ページ ${index + 1}`;
      seen[title] = (seen[title] || 0) + 1;
      const keyTitle = seen[title] > 1 ? `${title} #${seen[title]}` : title;
      const id = `p${index + 1}`;
      const isChapter = section.classList.contains("chapter");
      if (isChapter) {
        chapter = { title, id, pages: [] };
        toc.push(chapter);
      } else if (!section.classList.contains("title")) {
        if (!chapter) {
          chapter = { title: "はじめに", id, pages: [] };
          toc.push(chapter);
        }
        chapter.pages.push({ title, id });
      }
      return { section, index, id, title, isChapter, key: `slide:${topic}:${fieldNo}:${keyTitle.slice(0, 120)}` };
    });

    main.innerHTML = `
      <header class="terms-hero">
        <p class="terms-kicker">図解を読む・No.${nn}</p>
        <h1>${escapeHtml(fieldName)}</h1>
        <p class="terms-stats">${sections.length}枚。1枚ごとにメモを書けて、出てくる言葉の意味をその場で開ける。<span data-memo-count></span></p>
        <p class="reader-links">
          <a class="terms-button" href="terms/${nn}.html">用語集・クイズ</a>
          <a class="terms-button" href="terms/${nn}.pdf" target="_blank" rel="noopener">PDFで開く</a>
        </p>
        <details class="reader-toc">
          <summary>目次</summary>
          ${toc
            .map(
              (c) => `
            <p class="reader-toc-chapter"><a href="#${c.id}">${escapeHtml(c.title)}</a></p>
            <ol>${c.pages.map((p) => `<li><a href="#${p.id}" data-toc-page="${p.id}">${escapeHtml(p.title)}</a></li>`).join("")}</ol>`
            )
            .join("")}
        </details>
      </header>
      <div class="reader-pages">
        ${pages
          .map(
            (p) => `
          <article class="reader-page ${p.isChapter ? "is-chapter" : ""}" id="${p.id}">
            <p class="reader-page-no">${p.index + 1} / ${pages.length}<span class="reader-zoom-hint">スライドを押すと拡大</span></p>
            <div class="reader-slide"></div>
            <div class="reader-terms" data-terms></div>
            ${p.isChapter ? "" : memoBlock(p.key)}
          </article>`
          )
          .join("")}
      </div>`;

    const hosts = main.querySelectorAll(".reader-slide");
    pages.forEach((p, i) => {
      const section = document.importNode(p.section, true);
      section.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (!/^(https?:|data:|\/)/.test(src)) img.setAttribute("src", slideBase + src);
        img.loading = "lazy";
        // リポジトリに入れていない挿絵（いらすとや）は、枠ごと出さない
        img.addEventListener("error", () => {
          img.classList.add("is-missing");
          fitAll();
        });
        img.addEventListener("load", fitAll);
      });
      section.querySelectorAll("a[href]").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
      });
      const root = hosts[i].attachShadow({ mode: "open" });
      if (sheet && "adoptedStyleSheets" in root) root.adoptedStyleSheets = [sheet];
      else {
        const style = document.createElement("style");
        style.textContent = css;
        root.appendChild(style);
      }
      const fit = document.createElement("div");
      fit.className = "fit";
      fit.appendChild(section);
      root.appendChild(fit);

      // その枚に出てくる用語
      if (!p.isChapter && terms.length) {
        const found = termsIn(section.textContent.replace(/\s+/g, " "), terms);
        const box = hosts[i].parentNode.querySelector("[data-terms]");
        if (found.length) {
          box.innerHTML = `
            <p class="reader-terms-label">このページの言葉（押すと意味が開く）</p>
            <div class="reader-chips">${found.map((t) => `<button type="button" class="reader-chip" data-term="${terms.indexOf(t)}" aria-expanded="false">${escapeHtml(t.name)}${t.analogy ? `<i aria-hidden="true"></i>` : ""}</button>`).join("")}</div>
            <div class="reader-term-open" data-term-open></div>`;
        }
      }
    });

    main.addEventListener("click", (e) => {
      const host = e.target.closest(".reader-slide");
      if (host && (host.classList.contains("is-zoom") || host.clientWidth < SLIDE_W * ZOOM_SCALE) && !e.composedPath().some((n) => n.tagName === "A")) {
        host.classList.toggle("is-zoom");
        fitAll();
        return;
      }
      const chip = e.target.closest("[data-term]");
      if (!chip) return;
      const box = chip.closest("[data-terms]");
      const out = box.querySelector("[data-term-open]");
      const wasOpen = chip.getAttribute("aria-expanded") === "true";
      box.querySelectorAll("[data-term]").forEach((c) => c.setAttribute("aria-expanded", "false"));
      if (wasOpen) out.innerHTML = "";
      else {
        chip.setAttribute("aria-expanded", "true");
        out.innerHTML = termPanel(terms[Number(chip.dataset.term)]);
      }
    });

    setupMemos();
    updateMemoCount();
    fitAll();
    window.addEventListener("resize", fitAll);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
    document.title = `${fieldName}｜図解を読む`;
  };

  build();
})();
