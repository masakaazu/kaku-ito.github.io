/*
  用語集の md から、図解スライド（HTML）を自動で作る。
  使い方: node tools/slides/md2slides.js fe/terms/12.md tools/slides/fe-12.html
  そのあと topdf.js で PDF にする。見た目は fe-10.html と同じ（白地に紺の箱）。
  構成: 表紙 → 目次 → 小分類ごとに「まとめ表」と「用語の箱（1枚に最大6語）」 → まとめ
*/
const fs = require("fs");
const path = require("path");

const [src, out] = process.argv.slice(2);
const md = fs.readFileSync(src, "utf8").replace(/\r\n?/g, "\n");
const style = fs.readFileSync(path.join(__dirname, "fe-10.html"), "utf8").match(/<style>[\s\S]*?<\/style>/)[0];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

// ---- md を読む ----
const head = md.match(/^# .*#(\d+)\s+(.+?)（/m);
const no = Number(head[1]);
const name = head[2].trim();
const sections = [];
let sec = null, theme = "", term = null, table = null, caption = "";
for (const line of md.split("\n")) {
  if (/^## 問題演習/.test(line)) break;
  let m;
  if ((m = line.match(/^## (.+)/))) { sec = { title: m[1].trim(), tables: [], terms: [] }; sections.push(sec); term = null; continue; }
  if (!sec) continue;
  if ((m = line.match(/^### (.+)/))) { theme = m[1].trim(); term = null; continue; }
  if ((m = line.match(/^\*\*(.+)\*\*$/))) { caption = m[1]; continue; }
  if (/^\|/.test(line)) {
    const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (!table) { table = { caption, head: cells, rows: [] }; sec.tables.push(table); }
    else table.rows.push(cells);
    continue;
  } else table = null;
  if ((m = line.match(/^#### (.+)/))) {
    const t = m[1].trim();
    const p = t.match(/^(.+?)（(.+)）$/);
    term = { name: p ? p[1] : t, sub: p ? p[2] : "", theme, lines: {} };
    sec.terms.push(term);
    continue;
  }
  if (term && (m = line.match(/^- (意味|ポイント|例|注|語の意味)：(.+)/))) term.lines[m[1]] = m[2];
}

// ---- スライドを組む ----
const label = no <= 13 ? "テクノロジ系" : no <= 16 ? "マネジメント系" : "ストラテジ系";
const slides = [];
const foot = () => `<div class="foot"><span>基本情報 ${esc(name)}</span><span>${slides.length + 1}</span></div>`;
const add = (body, cls = "") => slides.push(`<section class="slide ${cls}">\n${body}\n${foot()}\n</section>`);

add(`  <div class="k">基本情報技術者試験　${label}　No.${no}</div>
  <h1>${esc(name)}</h1>
  <p>${sections.map((s) => esc(s.title.replace(/^\d+-\d+\s*/, ""))).join("・")}</p>`, "title");

add(`  <h1>目次</h1>
  <ol class="toc">
${sections.map((s) => `    <li>${esc(s.title)}（${s.terms.length}語）</li>`).join("\n")}
    <li>まとめ</li>
  </ol>`);

const tableHtml = (t) => `<div class="cap">${inline(t.caption || "まとめ表")}</div>
  <table><thead><tr>${t.head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>
  <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

const card = (t) => {
  const L = t.lines;
  const rows = [];
  if (L["意味"]) rows.push(`<dd>${inline(L["意味"])}</dd>`);
  if (L["ポイント"]) rows.push(`<dd class="pt"><span class="tag">ポイント</span>${inline(L["ポイント"])}</dd>`);
  if (L["例"]) rows.push(`<dd class="pt"><span class="tag">例</span>${inline(L["例"])}</dd>`);
  if (L["注"]) rows.push(`<dd class="pt"><span class="tag">注</span>${inline(L["注"])}</dd>`);
  if (L["語の意味"]) rows.push(`<dd class="words">${inline(L["語の意味"])}</dd>`);
  return `<div class="term"><div class="box b${t.sub ? 1 : 2}">${esc(t.name)}${t.sub ? `<span>${esc(t.sub)}</span>` : ""}</div><dl>${rows.join("")}</dl></div>`;
};

// 1枚に入る量を文字数でおおまかに見積もって詰める
const weight = (t) => Object.values(t.lines).join("").length + 40;
for (const s of sections) {
  const sub = s.title;
  // 表は大きさに応じて1枚に1〜2つ
  for (let i = 0; i < s.tables.length; i++) {
    const a = s.tables[i], b = s.tables[i + 1];
    const size = (t) => t.rows.length + 1;
    if (b && size(a) + size(b) <= 9 && a.head.length <= 3 && b.head.length <= 3) {
      add(`  <h1>${esc(sub)}<small>まとめ表</small></h1>\n  <div class="cols"><div>${tableHtml(a)}</div><div>${tableHtml(b)}</div></div>`);
      i++;
    } else add(`  <h1>${esc(sub)}<small>まとめ表</small></h1>\n  ${tableHtml(a)}`);
  }
  let page = [], w = 0;
  const flush = () => {
    if (!page.length) return;
    const themes = [...new Set(page.map((t) => t.theme))].join("・");
    add(`  <h1>${esc(sub)}<small>${esc(themes)}</small></h1>\n  <div class="grid">${page.map(card).join("")}</div>`);
    page = []; w = 0;
  };
  for (const t of s.terms) {
    if (page.length >= 6 || (page.length && w + weight(t) > 600)) flush();
    page.push(t); w += weight(t);
  }
  flush();
}

// まとめ：小分類ごとの用語名
add(`  <h1>まとめ<small>この分野で覚える用語</small></h1>
  <table><thead><tr><th style="width:30%">小分類</th><th>用語</th></tr></thead><tbody>
${sections.map((s) => `<tr><td>${esc(s.title)}</td><td>${s.terms.map((t) => esc(t.name)).join("・")}</td></tr>`).join("\n")}
  </tbody></table>`);

const extra = `<style>
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 22px; }
.term .box { text-align: left; font-size: 15px; padding: 7px 12px; }
.term dl { margin: 6px 2px 0; }
.term dd { margin: 0 0 4px; font-size: 12.5px; line-height: 1.5; }
.term dd.pt { color: #333; }
.term dd.words { color: var(--navy2); font-size: 11.5px; }
.term .tag { font-size: 10.5px; padding: 0 5px; }
.slide .cap + table { margin-bottom: 14px; }
</style>`;

fs.writeFileSync(out, `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>基本情報 ${esc(name)} 図解</title>
${style}
${extra}
</head>
<body>
${slides.join("\n\n")}
</body>
</html>
`);
console.log(`${out}: ${slides.length}枚`);
