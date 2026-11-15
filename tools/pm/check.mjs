// 午後（科目B）演習の JSON を点検する（設計書 8-2）。
// 使い方：node tools/pm/check.mjs ap/pm/2024r06a-1.json
// 問題が無ければ「OK」と出して 0 で終わる。あれば1件ずつ出して 1 で終わる。
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("使い方：node tools/pm/check.mjs ap/pm/{key}.json");
  process.exit(1);
}
const dir = dirname(resolve(jsonPath));
const errors = [];
const err = (msg) => errors.push(msg);

let q;
try {
  q = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch (e) {
  console.error(`JSON として読めない：${e.message}`);
  process.exit(1);
}

if (basename(jsonPath, ".json") !== q.key) err(`key "${q.key}" とファイル名が違う`);
for (const k of ["key", "exam", "examName", "no", "area", "title", "source", "body", "questions"]) if (q[k] === undefined) err(`${k} が無い`);

/* ---------- 本文の文字列を集める ---------- */
// list の項目は文字列か { text, p:[…], list:[…], mark }。入れ子もたどる
const strings = []; // { where, s }
const listStrings = (items, where) => {
  items.forEach((it, i) => {
    if (typeof it === "string") strings.push({ where: `${where}[${i}]`, s: it });
    else {
      if (typeof it.text === "string") strings.push({ where: `${where}[${i}].text`, s: it.text });
      (it.p || []).forEach((s, j) => strings.push({ where: `${where}[${i}].p[${j}]`, s }));
      if (it.list) listStrings(it.list, `${where}[${i}].list`);
    }
  });
};
const ids = new Set();
const figIds = new Set((q.figures || []).map((f) => f.id));
const tblIds = new Set((q.tables || []).map((t) => t.id));
for (const b of q.body || []) {
  if (!b.id) err(`id の無いブロックがある：${JSON.stringify(b).slice(0, 60)}`);
  else if (ids.has(b.id)) err(`ブロックの id が重なっている：${b.id}`);
  ids.add(b.id);
  if (b.p !== undefined) strings.push({ where: b.id, s: b.p });
  if (b.h !== undefined) strings.push({ where: b.id, s: b.h });
  if (b.note !== undefined) strings.push({ where: b.id, s: b.note });
  if (b.list) listStrings(b.list, b.id);
  if (b.code) b.code.forEach((s, i) => strings.push({ where: `${b.id}[${i}]`, s }));
  if (b.fig && !figIds.has(b.fig)) err(`${b.id}：図 ${b.fig} が figures に無い`);
  if (b.table && !tblIds.has(b.table)) err(`${b.id}：表 ${b.table} が tables に無い`);
}
// 表の中の文字（表の欄に下線・空欄がある問もある。pm.js は表の欄も本文と同じ飾りで表示する。欄の中の改行は "\n"）
for (const t of q.tables || []) {
  [t.caption, ...(t.head || []), ...(t.rows || []).flat(), t.note]
    .filter((s) => typeof s === "string")
    .forEach((s, i) => strings.push({ where: `${t.id}[${i}]`, s }));
}

// 飾りを外した文字（根拠の引用を探すため）
const plain = (s) =>
  s
    .replace(/\[ruby:([^|\]]*)\|[^\]]*\]/g, "$1")
    .replace(/\[sup:([^\]]*)\]/g, "$1")
    .replace(/\[blank:([a-z0-9]+)\]/g, "〔$1〕")
    .replace(/\[ref:u(\d+)\]/g, "下線$1")
    .replace(/\[\/?(u|g)(:[^\]]*)?\]/g, "")
    .replace(/\*\*/g, "");

/* ---------- 飾りの開き閉じと参照先 ---------- */
const underlines = new Set();
const blanks = new Set();
const groundMarks = new Set();
for (const { where, s } of strings) {
  const tags = s.match(/\[\/?[a-z]+(:[^\]]*)?\]/g) || [];
  const stack = [];
  for (const t of tags) {
    const m = t.match(/^\[(\/?)([a-z]+)(?::([^\]]*))?\]$/);
    const [, close, name, arg] = m;
    if (!["u", "g", "blank", "ref", "ruby", "sup"].includes(name)) err(`${where}：知らない飾り ${t}`);
    if (name === "u" || name === "g") {
      if (close) {
        if (stack.pop() !== name) err(`${where}：${t} の開きが無い、または入れ子が交差している`);
      } else {
        stack.push(name);
        if (name === "u") {
          if (underlines.has(arg)) err(`${where}：下線 ${arg} が2回ある`);
          underlines.add(arg);
        } else arg.split(",").forEach((x) => groundMarks.add(x.trim()));
      }
    }
    if (name === "blank") blanks.add(arg);
  }
  if (stack.length) err(`${where}：閉じていない飾り ${stack.join(",")}`);
}

/* ---------- 設問 ---------- */
const splitMarks = (s) => String(s || "").split(/[，,、・\s]+/).filter(Boolean);
const parts = [];
const textsToCheck = [];
for (const qu of q.questions || []) {
  textsToCheck.push({ where: `設問${qu.no}`, s: qu.text || "" });
  for (const p of qu.parts || []) {
    parts.push(p);
    if (p.text) textsToCheck.push({ where: p.id, s: p.text });
    if (!p.id) err(`設問${qu.no}：id の無い part`);
    if (!Array.isArray(p.answers) || !p.answers.length) err(`${p.id}：answers が無い`);
    if (!["text", "short", "choice", "multi"].includes(p.kind)) err(`${p.id}：kind が text/short/choice/multi でない`);
    // 記号の part（choice は1つ、multi は全て選ぶ。答えは "ア，ウ"）。解答群は part の choices か設問の choices
    if (p.kind === "choice" || p.kind === "multi") {
      const choices = p.choices || qu.choices;
      const marks = Array.isArray(p.answers) ? (p.kind === "multi" ? p.answers.flatMap(splitMarks) : p.answers) : [];
      if (!choices) err(`${p.id}：${p.kind} なのに part にも設問${qu.no}にも choices が無い`);
      else marks.forEach((a) => choices[a] === undefined && err(`${p.id}：答え ${a} が choices に無い`));
      if (p.kind === "multi") (p.answers || []).forEach((a) => splitMarks(a).length < 1 && err(`${p.id}：multi の答え "${a}" に記号が無い`));
      if (p.think?.others && choices) {
        for (const k of Object.keys(choices)) if (!marks.includes(k) && !p.think.others[k]) err(`${p.id}：選択肢 ${k} の説明（think.others）が無い`);
      }
    } else if (p.choices) err(`${p.id}：記号の part でないのに choices がある`);
    if (p.limit) p.answers.forEach((a) => [...plain(a)].length > p.limit && err(`${p.id}：解答例が ${[...plain(a)].length} 字で ${p.limit} 字を超える`));
    if (p.chars) p.answers.forEach((a) => [...plain(a)].length !== p.chars && err(`${p.id}：解答例が ${p.chars} 字でない`));
    if (p.blank && !blanks.has(p.blank)) err(`${p.id}：空欄 ${p.blank} が本文に無い`);
    if (/^\s*[（(][0-9０-９]+[)）]/.test(p.text || "")) err(`${p.id}：小問の番号（(1) など）は text ではなく label に書く`);
    // 記号の part が空欄を埋めるときは blank で示す（label は "(1)" などの見出し）。古い形の label "a" だけのものも空欄として確かめる
    if (!p.blank && (p.kind === "choice" || p.kind === "multi") && /^[a-z]$/.test(p.label || "") && !blanks.has(p.label)) err(`${p.id}：空欄 ${p.label} が本文に無い`);
  }
}
for (const { where, s } of textsToCheck) {
  for (const m of s.matchAll(/\[ref:(u\d+)\]/g)) if (!underlines.has(m[1].slice(1))) err(`${where}：${m[0]} の下線が本文に無い`);
  for (const m of s.matchAll(/\[blank:([a-z0-9]+)\]/g)) if (!blanks.has(m[1])) err(`${where}：空欄 ${m[1]} が本文に無い`);
}

// 問題 ID が全部違う
const qids = parts.map((p) => `appm-${q.key}-${p.id}`);
if (new Set(qids).size !== qids.length) err("問題 ID（appm-{key}-{part}）が重なっている");

// 本文の [g:…] が知っている part を指す
const partIds = new Set(parts.map((p) => p.id));
for (const g of groundMarks) if (!partIds.has(g)) err(`本文の [g:${g}] の part が無い`);
for (const t of q.tables || []) for (const g of Object.keys(t.ground || {})) if (!partIds.has(g)) err(`${t.id}.ground の part ${g} が無い`);

/* ---------- 根拠の引用が本文にあるか ---------- */
const blockPlain = {};
for (const { where, s } of strings) {
  const id = where.replace(/[[.].*$/, "");
  blockPlain[id] = (blockPlain[id] || "") + "\n" + plain(s);
}
const uPlain = {};
for (const { s } of strings) for (const m of s.matchAll(/\[u:(\d+)\]([\s\S]*?)\[\/u\]/g)) uPlain[`u${m[1]}`] = plain(m[2]);
const tblPlain = {};
for (const t of q.tables || []) tblPlain[t.id] = [t.caption, ...(t.head || []), ...(t.rows || []).flat()].join("\n");
const figPlain = {};
for (const f of q.figures || []) figPlain[f.id] = `${f.caption}\n${f.alt}`;
const allPlain = Object.values(blockPlain).join("\n") + Object.values(tblPlain).join("\n");

for (const p of parts) {
  const t = p.think;
  if (!t) {
    err(`${p.id}：think（考え方）が無い`);
    continue;
  }
  for (const k of ["ask", "ground", "steps", "build", "trap"]) if (!t[k] || (Array.isArray(t[k]) && !t[k].length)) err(`${p.id}：think.${k} が無い`);
  for (const g of t.ground || []) {
    const where = blockPlain[g.ref] ?? uPlain[g.ref] ?? tblPlain[g.ref] ?? figPlain[g.ref];
    if (where === undefined) err(`${p.id}：根拠の ref "${g.ref}" が本文に無い`);
    else if (g.quote && !where.includes(g.quote)) err(`${p.id}：根拠の引用が ${g.ref} に無い「${g.quote}」${allPlain.includes(g.quote) ? "（本文の別の所にはある）" : ""}`);
  }
}

/* ---------- 用語が用語集にあるか ---------- */
const termNames = new Set();
for (const n of q.termFiles || []) {
  const f = join(dir, "..", "terms", `${String(n).padStart(2, "0")}.md`);
  if (!existsSync(f)) {
    err(`用語集 ${f} が無い`);
    continue;
  }
  for (const raw of readFileSync(f, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s+問題演習/.test(line)) break;
    const h = line.match(/^####\s+(.+)$/);
    if (h) termNames.add((h[1].match(/^(.*?)（(.*)）$/)?.[1] ?? h[1]).trim());
  }
}
const needTerms = new Set([...(q.glossary || [])]);
for (const p of parts) [...(p.terms || []), ...(p.think?.terms || [])].forEach((x) => needTerms.add(x));
for (const t of needTerms) if (!termNames.has(t)) err(`用語「${t}」が用語集（${(q.termFiles || []).join(",")}.md）の見出しに無い`);

/* ---------- 画像 ---------- */
let bytes = 0;
const files = (q.figures || []).map((f) => f.file);
for (const n of q.pages || []) files.push(`img/${q.exam}-p${String(n).padStart(2, "0")}.webp`);
for (const f of files) {
  const path = join(dir, f);
  if (!existsSync(path)) err(`画像 ${f} が無い`);
  else bytes += statSync(path).size;
}
if (bytes > 400 * 1024) err(`画像の合計が ${(bytes / 1024).toFixed(0)}KB で 400KB を超える`);

if (errors.length) {
  errors.forEach((e) => console.log(`NG  ${e}`));
  console.log(`${errors.length} 件`);
  process.exit(1);
}
console.log(`OK  ${q.key}：本文 ${q.body.length} ブロック・part ${parts.length}・用語 ${needTerms.size}・画像 ${files.length} 枚 ${(bytes / 1024).toFixed(0)}KB`);
