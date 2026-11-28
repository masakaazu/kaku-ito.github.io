/*
  用語マップのデータを作る（ap/terms/01〜23.md → ap/termmap.json）

    node tools/termmap/build.mjs

  用語集の md を差し替えたら、もう一度実行する（何度実行しても同じ結果になる）。
  md の読み方は assets/js/terms.js の parse と同じ（見出し「#### 用語名（よみ / English）」、
  「- 意味：」などの行、「| 用語 | 英語 | 解説 |」の表）。「## 問題演習」より下は使わない。

  できる JSON（ページは assets/js/termmap.js が読む）
    fields  分野番号 → [分野名, 系（0 テクノロジ／1 マネジメント／2 ストラテジ）]
    groups  [グループ名, 分野番号, [用語の番号…]]   … md の同じ「###」に並ぶ用語どうし
    terms   1行1用語
      n 用語名 / y 読み / e 英語 / k 系 / fl 印（要確認・重複）
      s 分野ごとの説明 [{f 分野番号, h 中分類, m 意味, p ポイント, x 例, w 語の意味, a たとえ, o 注, c 要確認, r その他の行}]
        説明の中に出てくるほかの用語は [[用語名]] にしてある
      g 入っているグループの番号 / m 説明の中に出てくる用語の番号

  変換そのもの（buildTermmap）はファイルを読まない関数なので、ブラウザからも呼べる。
*/

const LABELS = { 意味: "m", ポイント: "p", 例: "x", 注: "o", "⚠要確認": "c", 語の意味: "w", たとえ: "a" };
const LABEL_RE = /^(意味|ポイント|例|注|⚠要確認|語の意味|たとえ)[：:]\s*(.*)$/;
const KEI = { technology: 0, management: 1, strategy: 2 };
const TEXT_KEYS = ["m", "p", "x", "a", "o", "w", "c"];

const unescape = (text) => text.replace(/\\([\\`*_{}[\]()#+\-.!&:<>|~])/g, "$1");

/* terms.js の parseHeading と同じ */
const parseHeading = (raw) => {
  let text = raw.trim();
  const flags = [];
  text = text
    .replace(/⚠(要確認|重複)/g, (_, f) => {
      flags.push(f);
      return "";
    })
    .trim();
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

/* 1つの md から グループ（中分類・題・用語）を取り出す */
const parse = (md) => {
  const lines = md
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => unescape(l.trimEnd()));
  const groups = [];
  let section = "";
  let group = null;
  let term = null;
  let summary = false;
  let inMeta = true;
  let tableHead = null;
  const ensureGroup = () => {
    if (!group) {
      group = { section, title: section, terms: [] };
      groups.push(group);
    }
    return group;
  };

  for (const line of lines) {
    if (!line.startsWith("|")) tableHead = null;
    if (/^#\s/.test(line)) continue;
    if (/^##\s+問題演習/.test(line)) break;
    if (/^##\s/.test(line)) {
      inMeta = false;
      section = line.replace(/^##\s+/, "");
      group = null;
      term = null;
      summary = section.includes("まとめ");
      continue;
    }
    if (/^###\s/.test(line)) {
      inMeta = false;
      const title = line.replace(/^###\s+/, "");
      term = null;
      if (title.includes("まとめ")) {
        summary = true;
        group = null;
      } else {
        summary = false;
        group = { section, title, terms: [] };
        groups.push(group);
      }
      continue;
    }
    if (/^####\s/.test(line)) {
      inMeta = false;
      summary = false;
      term = { ...parseHeading(line.replace(/^####\s+/, "")), section, fields: {}, extra: [] };
      ensureGroup().terms.push(term);
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      inMeta = false;
      summary = false;
      continue;
    }
    if (inMeta || summary) continue;
    if (line.startsWith("|")) {
      if (/^\|[\s:|-]+$/.test(line)) continue;
      const cells = line
        .replace(/^\|+/, "")
        .replace(/\|+$/, "")
        .split("|")
        .map((c) => c.trim());
      if (!tableHead) {
        tableHead = cells;
        continue;
      }
      if (!tableHead.includes("用語")) continue;
      const cell = (label) => cells[tableHead.indexOf(label)] || "";
      const raw = cell("用語");
      const bare = /\s*⚠\s*$/.test(raw);
      const head = parseHeading(raw.replace(/\s*⚠\s*$/, ""));
      if (bare) head.flags.push("要確認");
      if (cell("英語") && cell("英語") !== head.name && !head.english) head.english = cell("英語");
      ensureGroup().terms.push({ ...head, section, fields: { m: cell("解説") || cell("意味"), p: cell("ポイント") }, extra: [] });
      term = null;
      continue;
    }
    if (term && /^\s*-\s+/.test(line)) {
      const body = line.replace(/^\s*-\s+/, "");
      const m = body.match(LABEL_RE);
      if (m) {
        const k = LABELS[m[1]];
        term.fields[k] = `${term.fields[k] || ""} ${m[2]}`.trim();
      } else {
        term.extra.push(body);
      }
    }
  }
  return groups.filter((g) => g.terms.length);
};

/* catalog.js の fields（23分野）から 分野番号 → [分野名, 系] */
export const loadFields = (catalogSrc) => {
  const out = {};
  for (const [, no, grp, name] of catalogSrc.matchAll(/\{\s*no:\s*(\d+),\s*group:\s*"(\w+)",[^}\n]*?name:\s*"([^"]+)"/g)) {
    if (grp in KEI && !(Number(no) in out)) out[Number(no)] = [name, KEI[grp]];
  }
  return out;
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
  mdOf(分野番号) → その分野の md の文字列（ないときは null）
  返り値は { json: ファイルに書く文字列, terms, groups, links }
*/
export const buildTermmap = (fields, mdOf) => {
  const terms = [];
  const index = new Map();
  const groups = [];
  const nos = Object.keys(fields)
    .map(Number)
    .sort((a, b) => a - b);

  for (const no of nos) {
    const md = mdOf(no);
    if (md == null) continue;
    for (const g of parse(md)) {
      const ids = [];
      for (const t of g.terms) {
        const text = {};
        Object.entries(t.fields).forEach(([k, v]) => v && (text[k] = v));
        if (t.extra.length) text.r = t.extra;
        if (!text.m) continue; // 名前だけの用語（説明がない）はマップに出さない
        const key = t.name;
        if (!index.has(key)) {
          index.set(key, terms.length);
          terms.push({ n: key, y: t.reading, e: t.english, k: fields[no][1], fl: [], s: [], g: [] });
        }
        const rec = terms[index.get(key)];
        if (t.reading && !rec.y) rec.y = t.reading;
        if (t.english && !rec.e) rec.e = t.english;
        rec.fl = [...new Set([...rec.fl, ...t.flags])].sort();
        // 重複掲載は説明を足さない（グループのつながりだけ残す）
        if (!(t.flags.includes("重複") && rec.s.length)) rec.s.push({ f: no, h: t.section, ...text });
        if (!ids.includes(index.get(key))) ids.push(index.get(key));
      }
      if (ids.length > 1) {
        const gi = groups.length;
        groups.push([g.title, no, ids]);
        ids.forEach((i) => terms[i].g.push(gi));
      }
    }
  }

  // 説明の中に出てくるほかの用語を [[ ]] にする（長い名前を先に。日本語は3文字以上、英字は単語の切れ目だけ）
  const len = (s) => [...s].length;
  const linkable = (name) => (/[^\x00-\x7f]/.test(name) ? len(name) >= 3 : len(name) >= 2 && !/^\d+$/.test(name));
  const pat = (name) => {
    let e = escapeRe(name);
    if (/^[A-Za-z0-9]/.test(name)) e = `(?<![A-Za-z0-9])${e}`;
    if (/[A-Za-z0-9]$/.test(name)) e = `${e}(?![A-Za-z0-9])`;
    return e;
  };
  const names = [...index.keys()].filter(linkable).sort((a, b) => len(b) - len(a));
  const big = new RegExp(names.map(pat).join("|"), "gu");
  const protect = /(`[^`]*`|\[\[[^\]]*\]\])/;

  terms.forEach((rec) => {
    const used = new Set();
    const rep = (k) => {
      if (k === rec.n || used.has(k) || used.size >= 15) return k;
      used.add(k);
      return `[[${k}]]`;
    };
    const link = (s) =>
      s
        .split(protect)
        .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(big, rep)))
        .join("");
    rec.s.forEach((s) => {
      TEXT_KEYS.forEach((k) => {
        if (k in s && k !== "w") s[k] = link(s[k]);
      });
      if (s.r) s.r = s.r.map(link);
    });
    rec.m = [...used].map((k) => index.get(k)).sort((a, b) => a - b);
    if (!rec.fl.length) delete rec.fl;
    if (!rec.y) delete rec.y;
    if (!rec.e) delete rec.e;
  });

  const fieldsOut = {};
  nos.forEach((no) => (fieldsOut[no] = fields[no]));
  const json =
    `{"fields":${JSON.stringify(fieldsOut)}` +
    `,\n"groups":${JSON.stringify(groups)}` +
    `,\n"terms":[\n${terms.map((t) => JSON.stringify(t)).join(",\n")}\n]}\n`;
  return { json, terms: terms.length, groups: groups.length, links: terms.reduce((n, t) => n + t.m.length, 0) };
};

/* ---------- node tools/termmap/build.mjs で実行したとき ---------- */
const isCli = typeof process !== "undefined" && !!process.argv && !!process.argv[1] && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1];
if (isCli) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..", "..");
  const fields = loadFields(fs.readFileSync(path.join(root, "assets", "js", "catalog.js"), "utf8"));
  const mdOf = (no) => {
    const file = path.join(root, "ap", "terms", `${String(no).padStart(2, "0")}.md`);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  };
  const out = path.join(root, "ap", "termmap.json");
  const result = buildTermmap(fields, mdOf);
  fs.writeFileSync(out, result.json);
  console.log(`用語 ${result.terms}語・グループ ${result.groups}・説明の中のつながり ${result.links}本 → ap/termmap.json（${Math.floor(fs.statSync(out).size / 1024)}KB）`);
}
