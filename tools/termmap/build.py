#!/usr/bin/env python3
"""
用語マップのデータを作る（ap/terms/01〜23.md → ap/termmap.json）

  python3 tools/termmap/build.py

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
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "ap", "terms")
OUT = os.path.join(ROOT, "ap", "termmap.json")

LABELS = {"意味": "m", "ポイント": "p", "例": "x", "注": "o", "⚠要確認": "c", "語の意味": "w", "たとえ": "a"}
LABEL_RE = re.compile(r"^(意味|ポイント|例|注|⚠要確認|語の意味|たとえ)[：:]\s*(.*)$")
KEI = {"technology": 0, "management": 1, "strategy": 2}
TEXT_KEYS = ["m", "p", "x", "a", "o", "w", "c"]


def unescape(text):
    return re.sub(r"\\([\\`*_{}\[\]()#+\-.!&:<>|~])", r"\1", text)


def parse_heading(raw):
    """terms.js の parseHeading と同じ"""
    text = raw.strip()
    flags = []

    def flag(m):
        flags.append(m.group(1))
        return ""

    text = re.sub(r"⚠(要確認|重複)", flag, text).strip()
    m = re.match(r"^(.*?)（([^（）]*)）$", text)
    name, reading, english = text, "", ""
    if m:
        name = m.group(1).strip()
        parts = m.group(2).split(" / ")
        if len(parts) >= 2:
            reading = parts[0].strip()
            english = " / ".join(parts[1:]).strip()
        elif re.match(r"^[\x20-\x7E]+$", parts[0]):
            english = parts[0].strip()
        else:
            reading = parts[0].strip()
    return {"name": name, "reading": reading, "english": english, "flags": flags}


def parse(md):
    """1つの md から (中分類, グループ, 用語) を取り出す"""
    lines = [unescape(l.rstrip()) for l in md.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    groups = []  # {"section","title","terms":[...]}
    section, group, term = "", None, None
    summary, in_meta, table_head = False, True, None

    def ensure_group():
        nonlocal group
        if group is None:
            group = {"section": section, "title": section, "terms": []}
            groups.append(group)
        return group

    for line in lines:
        if not line.startswith("|"):
            table_head = None
        if re.match(r"^#\s", line):
            continue
        if re.match(r"^##\s+問題演習", line):
            break
        if re.match(r"^##\s", line):
            in_meta = False
            section = re.sub(r"^##\s+", "", line)
            group, term = None, None
            summary = "まとめ" in section
            continue
        if re.match(r"^###\s", line):
            in_meta = False
            title = re.sub(r"^###\s+", "", line)
            term = None
            if "まとめ" in title:
                summary, group = True, None
            else:
                summary = False
                group = {"section": section, "title": title, "terms": []}
                groups.append(group)
            continue
        if re.match(r"^####\s", line):
            in_meta, summary = False, False
            term = dict(parse_heading(re.sub(r"^####\s+", "", line)), section=section, fields={}, extra=[])
            ensure_group()["terms"].append(term)
            continue
        if re.match(r"^-{3,}$", line):
            in_meta, summary = False, False
            continue
        if in_meta or summary:
            continue
        if line.startswith("|"):
            if re.match(r"^\|[\s:|-]+$", line):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if table_head is None:
                table_head = cells
                continue
            if "用語" not in table_head:
                continue
            cell = lambda label: cells[table_head.index(label)] if label in table_head and table_head.index(label) < len(cells) else ""
            raw = cell("用語")
            bare = bool(re.search(r"\s*⚠\s*$", raw))
            head = parse_heading(re.sub(r"\s*⚠\s*$", "", raw))
            if bare:
                head["flags"].append("要確認")
            if cell("英語") and cell("英語") != head["name"] and not head["english"]:
                head["english"] = cell("英語")
            t = dict(head, section=section, fields={"m": cell("解説") or cell("意味"), "p": cell("ポイント")}, extra=[])
            ensure_group()["terms"].append(t)
            term = None
            continue
        if term is not None and re.match(r"^\s*-\s+", line):
            body = re.sub(r"^\s*-\s+", "", line)
            m = LABEL_RE.match(body)
            if m:
                k = LABELS[m.group(1)]
                term["fields"][k] = (term["fields"].get(k, "") + " " + m.group(2)).strip()
            else:
                term["extra"].append(body)
    return [g for g in groups if g["terms"]]


def load_fields():
    src = open(os.path.join(ROOT, "assets", "js", "catalog.js"), encoding="utf-8").read()
    out = {}
    # 「fields: [ { no: 1, group: "technology", …, name: "基礎理論" }, … ]」の行（最初に出てくる23分野）
    for no, grp, name in re.findall(r'\{\s*no:\s*(\d+),\s*group:\s*"(\w+)",[^}\n]*?name:\s*"([^"]+)"', src):
        if grp in KEI:
            out.setdefault(int(no), [name, KEI[grp]])
    return out


def main():
    fields = load_fields()
    terms, index, groups = [], {}, []
    for no in sorted(fields):
        path = os.path.join(SRC, "%02d.md" % no)
        if not os.path.exists(path):
            continue
        for g in parse(open(path, encoding="utf-8").read()):
            ids = []
            for t in g["terms"]:
                text = {k: v for k, v in t["fields"].items() if v}
                if t["extra"]:
                    text["r"] = t["extra"]
                if not text.get("m"):
                    continue  # 名前だけの用語（説明がない）はマップに出さない
                key = t["name"]
                if key not in index:
                    index[key] = len(terms)
                    terms.append({"n": key, "y": t["reading"], "e": t["english"], "k": fields[no][1],
                                  "fl": [], "s": [], "g": []})
                rec = terms[index[key]]
                for attr, val in (("y", t["reading"]), ("e", t["english"])):
                    if val and not rec[attr]:
                        rec[attr] = val
                rec["fl"] = sorted(set(rec["fl"]) | set(t["flags"]))
                if "重複" in t["flags"] and rec["s"]:
                    pass  # 重複掲載は説明を足さない（グループのつながりだけ残す）
                else:
                    rec["s"].append(dict({"f": no, "h": t["section"]}, **text))
                if index[key] not in ids:
                    ids.append(index[key])
            if len(ids) > 1:
                gi = len(groups)
                groups.append([g["title"], no, ids])
                for i in ids:
                    terms[i]["g"].append(gi)

    # 説明の中に出てくるほかの用語を [[ ]] にする（長い名前を先に。日本語は3文字以上、英字は単語の切れ目だけ）
    def linkable(name):
        if re.search(r"[^\x00-\x7f]", name):
            return len(name) >= 3
        return len(name) >= 2 and not name.isdigit()

    def pat(name):
        e = re.escape(name)
        if re.match(r"^[A-Za-z0-9]", name):
            e = r"(?<![A-Za-z0-9])" + e
        if re.search(r"[A-Za-z0-9]$", name):
            e = e + r"(?![A-Za-z0-9])"
        return e

    names = sorted((n for n in index if linkable(n)), key=len, reverse=True)
    big = re.compile("|".join(pat(n) for n in names))
    protect = re.compile(r"(`[^`]*`|\[\[[^\]]*\]\])")

    for i, rec in enumerate(terms):
        used = set()

        def rep(m):
            k = m.group(0)
            if k == rec["n"] or k in used or len(used) >= 15:
                return k
            used.add(k)
            return "[[%s]]" % k

        def link(s):
            return "".join(seg if protect.fullmatch(seg) else big.sub(rep, seg) for seg in protect.split(s))

        for s in rec["s"]:
            for k in TEXT_KEYS:
                if k in s and k != "w":
                    s[k] = link(s[k])
            if "r" in s:
                s["r"] = [link(x) for x in s["r"]]
        rec["m"] = sorted(index[k] for k in used)
        if not rec["fl"]:
            del rec["fl"]
        for a in ("y", "e"):
            if not rec[a]:
                del rec[a]

    with open(OUT, "w", encoding="utf-8") as f:
        f.write('{"fields":' + json.dumps({str(k): v for k, v in sorted(fields.items())}, ensure_ascii=False, separators=(",", ":")))
        f.write(',\n"groups":' + json.dumps(groups, ensure_ascii=False, separators=(",", ":")))
        f.write(',\n"terms":[\n' + ",\n".join(json.dumps(t, ensure_ascii=False, separators=(",", ":")) for t in terms) + "\n]}\n")
    links = sum(len(t["m"]) for t in terms)
    print("用語 %d語・グループ %d・説明の中のつながり %d本 → %s（%dKB）" % (
        len(terms), len(groups), links, os.path.relpath(OUT, ROOT), os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    sys.exit(main())
