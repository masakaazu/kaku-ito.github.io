/*
  用語マップ（ap/termmap.html）

  - termmap.json（tools/termmap/build.mjs が用語集 md から作る）を1回だけ読む
  - 選んだ用語を真ん中に置き、関連用語を周りに最大26個並べる。点をタップするとその用語が新しい中心になる
  - 関連は3種類：説明に出てくる用語（太線）／同じグループの用語（細線）／この用語を説明に使っている用語（点線）
  - termmap.html?t=用語名 で、その用語を中心に開く（用語集の「マップで見る」から来るときの形）
  - 見た目は assets/css/termmap.css、グラフの動きは d3（d3-force）
*/
(() => {
  const main = document.querySelector(".termmap");
  if (!main) return;

  const MAX = 26; // 周りに出す用語の数
  const KEI = ["テクノロジ系", "マネジメント系", "ストラテジ系"];
  const KEI_COLOR = ["var(--tm-tech)", "var(--tm-mgmt)", "var(--tm-strat)"];
  const LABEL = [
    ["m", "意味"],
    ["a", "たとえ"],
    ["p", "ポイント"],
    ["x", "例"],
    ["w", "語の意味"],
    ["o", "注"],
    ["c", "要確認"],
  ];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel) => main.querySelector(sel);
  const panel = $(".termmap-panel");
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let T = [];
  let G = [];
  let F = {};
  let byName = new Map();
  let back = [];
  let center = -1;
  let onlyField = "";

  /* ---------- 文字の整形 ---------- */

  // **太字**・`コード`・[[用語]] だけを HTML にする
  const rich = (text) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[\[([^\]]+)\]\]/g, (m, name) => {
        const raw = name.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        const i = byName.get(raw);
        return i == null ? name : `<a class="term-link" href="?t=${encodeURIComponent(raw)}" data-id="${i}">${name}</a>`;
      });

  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const norm = (s) => toHira((s || "").normalize("NFKC").toLowerCase());
  const inField = (i) => !onlyField || T[i].s.some((s) => String(s.f) === onlyField);

  /* ---------- 関連用語 ---------- */

  const neighbours = (c) => {
    const rel = new Map(); // 番号 → "mention" | "group" | "back"
    T[c].m.forEach((j) => rel.set(j, "mention"));
    T[c].g.forEach((gi) => G[gi][2].forEach((j) => j !== c && !rel.has(j) && rel.set(j, "group")));
    back[c].forEach((j) => !rel.has(j) && rel.set(j, "back"));
    const order = { mention: 0, group: 1, back: 2 };
    return [...rel.entries()].sort((a, b) => order[a[1]] - order[b[1]]).slice(0, MAX);
  };

  /* ---------- マップ ---------- */

  const stage = $(".termmap-stage");
  const svg = d3.select($(".termmap-svg"));
  const root = svg.append("g");
  const gLinks = root.append("g");
  const gNodes = root.append("g");
  let W = 0;
  let H = 0;
  const measure = () => {
    W = stage.clientWidth;
    H = stage.clientHeight;
    svg.attr("viewBox", [0, 0, W, H]);
  };
  measure();

  const zoom = d3.zoom().scaleExtent([0.4, 3]).on("zoom", (e) => root.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);

  const nodeOf = new Map(); // 番号 → 点（位置を覚えておき、組み替えても残る点はそのまま動かす）
  let shown = new Set();
  // 狭い画面（スマホ）では点どうしの間を詰める（PC の広さで 1）
  const spread = () => Math.max(0.6, Math.min(1, Math.min(W, H) / 440));
  const labelOf = (i) => (T[i].n.length > 14 ? `${T[i].n.slice(0, 13)}…` : T[i].n);

  const sim = d3
    .forceSimulation()
    .force("charge", d3.forceManyBody().strength(() => -260 * spread()))
    .force("link", d3.forceLink().id((d) => d.id).distance((l) => (l.kind === "cross" ? 150 : 110) * spread()).strength((l) => (l.kind === "cross" ? 0.05 : 0.5)))
    .force("collide", d3.forceCollide().radius((d) => d.r + Math.min(60, labelOf(d.id).length * 7) / 2).strength(0.7))
    .force("x", d3.forceX().strength(0.04))
    .force("y", d3.forceY().strength(0.06))
    .on("tick", () => {
      gLinks
        .selectAll("line")
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      gNodes.selectAll("g.node").attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

  const draw = (c, from) => {
    const nb = neighbours(c);
    const ids = [c, ...nb.map(([j]) => j)];
    const origin = (from != null && nodeOf.get(from)) || { x: W / 2, y: H / 2 };
    const nodes = ids.map((id) => {
      let n = nodeOf.get(id);
      if (!n) nodeOf.set(id, (n = { id }));
      if (!shown.has(id) || n.x == null) {
        n.x = origin.x + (Math.random() - 0.5) * 40;
        n.y = origin.y + (Math.random() - 0.5) * 40;
      }
      n.fx = n.fy = null;
      n.r = id === c ? 16 : 7 + Math.min(6, Math.sqrt(back[id].length + T[id].m.length));
      return n;
    });
    const cn = nodeOf.get(c);
    cn.fx = W / 2;
    cn.fy = H / 2;
    shown = new Set(ids);

    const set = new Set(ids);
    const links = nb.map(([j, kind]) => ({ source: c, target: j, kind }));
    nb.forEach(([a]) => T[a].m.forEach((b) => b !== c && set.has(b) && links.push({ source: a, target: b, kind: "cross" })));

    const linkKey = (d) => `${d.source.id ?? d.source}-${d.target.id ?? d.target}`;
    const L = gLinks.selectAll("line").data(links, linkKey);
    L.exit().remove();
    L.enter().append("line");
    gLinks.selectAll("line").attr("class", (d) => `is-${d.kind}`);

    const N = gNodes.selectAll("g.node").data(nodes, (d) => d.id);
    N.exit().remove();
    const enter = N.enter()
      .append("g")
      .attr("class", "node")
      .attr("tabindex", 0)
      .attr("role", "button")
      .on("click", (e, d) => go(d.id))
      .on("keydown", (e, d) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go(d.id);
        }
      })
      .call(
        d3
          .drag()
          .on("start", (e, d) => {
            if (!e.active) sim.alphaTarget(0.2).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (e, d) => {
            d.fx = e.x;
            d.fy = e.y;
          })
          .on("end", (e, d) => {
            if (!e.active) sim.alphaTarget(0);
            if (d.id !== center) d.fx = d.fy = null;
          })
      );
    enter.append("circle");
    enter.append("text").attr("text-anchor", "middle");

    const all = gNodes.selectAll("g.node");
    all
      .classed("is-center", (d) => d.id === c)
      .classed("is-other", (d) => d.id !== c && !inField(d.id))
      .attr("aria-label", (d) => T[d.id].n);
    all.select("circle").attr("r", (d) => d.r).attr("fill", (d) => (d.id === c ? "var(--tm-center)" : KEI_COLOR[T[d.id].k]));
    all
      .select("text")
      .text((d) => (d.id === c ? T[d.id].n : labelOf(d.id)))
      .attr("dy", (d) => (d.id === c ? "2.2em" : "1.8em"));
    all.filter((d) => d.id === c).raise();

    sim.force("x").x(W / 2);
    sim.force("y").y(H / 2);
    sim.force("charge").strength(-260 * spread());
    sim.nodes(nodes);
    sim.force("link").links(links);
    if (reduceMotion) {
      sim.alpha(1).stop();
      for (let k = 0; k < 300; k += 1) sim.tick();
      sim.on("tick")();
    } else {
      sim.alpha(0.9).restart();
    }
    svg.call(zoom.transform, d3.zoomIdentity);
  };

  new ResizeObserver(() => {
    measure();
    if (center < 0) return;
    sim.force("x").x(W / 2);
    sim.force("y").y(H / 2);
    const cn = nodeOf.get(center);
    cn.fx = W / 2;
    cn.fy = H / 2;
    sim.alpha(0.4).restart();
  }).observe(stage);

  /* ---------- 説明パネル ---------- */

  const chips = (ids) =>
    `<div class="termmap-chips">${ids
      .map((j) => `<button type="button" data-id="${j}" style="--c:${KEI_COLOR[T[j].k]}">${escapeHtml(T[j].n)}</button>`)
      .join("")}</div>`;

  const showPanel = (c) => {
    const t = T[c];
    const fieldNos = [...new Set(t.s.map((s) => s.f))];
    const multi = t.s.length > 1;
    let html = `<ul class="termmap-kicker"><li>${KEI[t.k]}</li>${fieldNos
      .map((f) => `<li><a href="field.html?f=${f}">#${f} ${escapeHtml(F[f][0])}</a></li>`)
      .join("")}</ul>`;
    html += `<h2>${escapeHtml(t.n)}${(t.fl || []).map((f) => `<span class="termmap-flag">⚠${escapeHtml(f)}</span>`).join("")}</h2>`;
    if (t.y || t.e) html += `<p class="termmap-sub">${escapeHtml([t.y, t.e].filter(Boolean).join(" ／ "))}</p>`;
    t.s.forEach((s) => {
      html += `<section class="termmap-sec">${multi ? `<h3>${escapeHtml(F[s.f][0])}（${escapeHtml(s.h)}）</h3>` : ""}<dl>`;
      LABEL.forEach(([k, label]) => {
        if (s[k]) html += `<dt>${label}</dt><dd class="${k === "m" ? "is-meaning" : k === "c" ? "is-caution" : ""}">${rich(s[k])}</dd>`;
      });
      (s.r || []).forEach((r) => (html += `<dd>${rich(r)}</dd>`));
      html += "</dl></section>";
    });

    html += `<section class="termmap-rel"><h3>関連用語</h3>`;
    if (t.m.length) html += `<h4>説明の中に出てくる用語</h4>${chips(t.m)}`;
    t.g.forEach((gi) => {
      const ids = G[gi][2].filter((j) => j !== c);
      if (ids.length) html += `<h4>同じグループ「${escapeHtml(G[gi][0])}」（${escapeHtml(F[G[gi][1]][0])}）</h4>${chips(ids)}`;
    });
    if (back[c].length) {
      html += `<h4>この用語を説明に使っている用語</h4>${chips(back[c].slice(0, 60))}`;
      if (back[c].length > 60) html += `<p class="termmap-more">ほか ${back[c].length - 60} 語</p>`;
    }
    if (!t.m.length && !t.g.length && !back[c].length) html += `<p class="termmap-more">つながっている用語はまだありません。</p>`;
    html += "</section>";

    panel.innerHTML = html;
    panel.scrollTop = 0;
  };

  panel.addEventListener("click", (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    e.preventDefault();
    go(Number(el.dataset.id));
  });

  /* ---------- たどった道・URL ---------- */

  const trail = [];
  const trailBox = $(".termmap-trail");
  const showTrail = () => {
    const past = trail.slice(0, -1);
    trailBox.innerHTML = past.length
      ? `たどった道：${past.map((j) => `<button type="button" data-id="${j}">${escapeHtml(T[j].n)}</button>`).join("")}`
      : "";
  };
  trailBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) go(Number(b.dataset.id));
  });

  const go = (id) => {
    if (id === center || !T[id]) return;
    const from = center;
    center = id;
    const k = trail.indexOf(id);
    if (k >= 0) trail.splice(k, 1);
    trail.push(id);
    if (trail.length > 9) trail.shift();
    draw(id, from);
    showPanel(id);
    showTrail();
    try {
      const url = new URL(location.href);
      url.searchParams.set("t", T[id].n);
      history.replaceState(null, "", url);
    } catch (e) {
      /* URL を書き換えられなくても使える */
    }
  };

  /* ---------- 検索・分野・ランダム ---------- */

  const q = $("#termmap-q");
  const results = $("#termmap-results");
  let index = [];
  let hits = [];
  let sel = 0;

  const close = () => {
    results.hidden = true;
    q.setAttribute("aria-expanded", "false");
  };
  const search = () => {
    const s = norm(q.value.trim());
    if (!s) return close();
    const scored = [];
    index.forEach((keys, i) => {
      if (!inField(i)) return;
      let best = 99;
      keys.forEach((x, k) => {
        if (!x) return;
        if (x === s) best = Math.min(best, k);
        else if (x.startsWith(s)) best = Math.min(best, 3 + k);
        else if (x.includes(s)) best = Math.min(best, 6 + k);
      });
      if (best < 99) scored.push([best, T[i].n.length, i]);
    });
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    hits = scored.slice(0, 12).map((x) => x[2]);
    sel = 0;
    results.innerHTML = hits.length
      ? hits
          .map(
            (i, k) =>
              `<li role="option" id="termmap-opt-${k}" data-id="${i}" aria-selected="${k === 0}"><span>${escapeHtml(T[i].n)}</span><span class="sub">${escapeHtml(
                [T[i].y, T[i].e].filter(Boolean).join(" / ")
              )}</span></li>`
          )
          .join("")
      : `<li aria-disabled="true"><span class="sub">見つかりませんでした。読み（ひらがな）や英語でも探せます</span></li>`;
    results.hidden = false;
    q.setAttribute("aria-expanded", "true");
  };
  const pick = (i) => {
    close();
    q.value = "";
    q.blur();
    go(i);
  };
  q.addEventListener("input", search);
  q.addEventListener("keydown", (e) => {
    if (results.hidden || !hits.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sel = (sel + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
      [...results.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === sel)));
      q.setAttribute("aria-activedescendant", `termmap-opt-${sel}`);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(hits[sel]);
    } else if (e.key === "Escape") close();
  });
  results.addEventListener("mousedown", (e) => {
    const li = e.target.closest("[data-id]");
    if (!li) return;
    e.preventDefault();
    pick(Number(li.dataset.id));
  });
  q.addEventListener("blur", () => setTimeout(close, 120));

  const fieldSelect = $("#termmap-field");
  fieldSelect.addEventListener("change", () => {
    onlyField = fieldSelect.value;
    if (center >= 0) draw(center, center);
    if (onlyField && center >= 0 && !inField(center)) random();
  });

  const random = () => {
    const pool = T.map((t, i) => i).filter((i) => inField(i) && T[i].m.length + back[i].length >= 3);
    if (pool.length) go(pool[Math.floor(Math.random() * pool.length)]);
  };
  main.querySelector("[data-random]").addEventListener("click", random);

  /* ---------- 読み込み ---------- */

  fetch(main.dataset.src, { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((data) => {
      T = data.terms;
      G = data.groups;
      F = data.fields;
      byName = new Map(T.map((t, i) => [t.n, i]));
      back = T.map(() => []);
      T.forEach((t, i) => t.m.forEach((j) => back[j].push(i)));
      index = T.map((t) => [norm(t.n), norm(t.y), norm(t.e)]);
      $("[data-count]").textContent = `全${T.length.toLocaleString()}語`;
      Object.entries(F)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .forEach(([no, [name]]) => fieldSelect.insertAdjacentHTML("beforeend", `<option value="${no}">#${no} ${escapeHtml(name)}</option>`));

      const want = new URLSearchParams(location.search).get("t");
      const start = (want && byName.get(want)) ?? byName.get("DNS") ?? 0;
      go(start);
    })
    .catch((error) => {
      console.warn("[termmap]", error);
      panel.innerHTML = `<p class="termmap-error">用語のデータを読み込めませんでした。電波のある場所でページを開き直してください。</p>`;
    });
})();
