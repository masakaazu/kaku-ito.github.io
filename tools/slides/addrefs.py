"""
図解スライド（HTML）に参照元リンクを入れる。
使い方: python3 tools/slides/addrefs.py tools/slides/ap-02.html tools/slides/refs/ap-02.json
  - 本文の用語（refs の inline）に、1枚につき最初の1か所だけリンクを付ける
  - 「R4春 問1」「R3春13」のような過去問番号は、すべて応用情報技術者試験.com の解説ページにリンクする
  - 各ページの下に「詳しく：」の行を足す（refs の foot。なければ、そのページの用語が多い用語集の小分類を自動で選ぶ）
  - refs の legend が true なら表紙にリンクの説明を、出典のページに参照サイトを足す
何度実行しても同じ結果になる（前に付けたリンクを外してから付け直す）。
"""
import json, re, sys
from collections import Counter

src, refs_path = sys.argv[1], sys.argv[2]
refs = json.load(open(refs_path, encoding="utf-8"))
html = open(src, encoding="utf-8").read()

# 前回のリンクを外す
html = re.sub(r'<a class="ref[^"]*" href="[^"]*">(.*?)</a>', r"\1", html, flags=re.S)
html = re.sub(r'\n?\s*<div class="refs">.*?</div>', "", html, flags=re.S)
html = re.sub(r'\n?\s*<div class="refs-legend">.*?</div>', "", html, flags=re.S)
html = re.sub(r'\n?\s*<dt class="refs-src">.*?</dd>', "", html, flags=re.S)

CSS_MARK = "/* 参照元リンク（tools/slides/addrefs.py が付ける） */"
html = re.sub(re.escape(CSS_MARK) + r".*?(?=</style>)", "", html, count=1, flags=re.S)
if True:
    has_foot = "className='foot'" in html
    # 左下に分野名の表示があるときは右寄せにして重ならないようにする
    pos = "left: auto; max-width: 560px; text-align: right;" if has_foot else "left: 52px; text-align: left;"
    css = f"""{CSS_MARK}
a.ref, a.src {{ color: inherit; text-decoration: underline dotted; text-decoration-color: color-mix(in srgb, currentColor 60%, transparent); text-underline-offset: 2px; }}
a.ref.q, a.src {{ color: var(--blue, #0071e3); }}
.refs {{ position: absolute; {pos} right: 80px; bottom: 14px; font-size: 11px; color: #6e6e73; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
.refs a.ref {{ color: var(--blue, #0071e3); }}
.refs-legend {{ position: absolute; left: 52px; right: 52px; bottom: 22px; font-size: 12px; color: #6e6e73; text-align: center; }}
"""
    html = html.replace("</style>", css + "</style>", 1)

season = {"春": "haru", "秋": "aki"}
q_re = re.compile(r"R([1-9])(春|秋) ?問? ?([1-9][0-9]?)(?![0-9])")
esc = lambda u: u.replace("&", "&amp;").replace('"', "&quot;")


def q_link(m):
    url = refs["kakomon"].format(yy="%02d" % int(m.group(1)), season=season[m.group(2)], q=m.group(3))
    return f'<a class="ref q" href="{esc(url)}">{m.group(0)}</a>'


def is_ascii_word(c):
    return c.isascii() and (c.isalnum() or c in "-_/")


def link_text(text, pat, terms, used, hits):
    if not text.strip():
        return text
    out, pos = [], 0
    for m in pat.finditer(text):
        t = m.group(0)
        url = terms.get(t)
        if url is None or url in used:
            continue
        a, b = m.start(), m.end()
        # 英字の用語は、前後が英数字なら単語の一部なので付けない（例：RAM の AM）
        if t[0].isascii() and a > 0 and is_ascii_word(text[a - 1]):
            continue
        if t[-1].isascii() and b < len(text) and is_ascii_word(text[b]):
            continue
        used.add(url)
        hits.append(t)
        out.append(text[pos:a])
        out.append(f'<a class="ref" href="{esc(url)}">{t}</a>')
        pos = b
    out.append(text[pos:])
    s = "".join(out)
    parts = re.split(r"(<a .*?</a>)", s)
    return "".join(p if p.startswith("<a ") else q_re.sub(q_link, p) for p in parts)


def auto_foot(hits):
    secs = refs.get("secs", {})
    c = Counter(secs[t] for t in hits if t in secs)
    out = []
    for sec, n in c.most_common(2):
        if n >= 2 or not out:
            fld = sec.split("-")[0]
            out.append([f"応用情報.com 用語集 {sec} {refs['secnames'][sec]}",
                        f"https://www.ap-siken.com/keyword/{fld}/{sec}/"])
    return out


def process_section(sec, no):
    is_src = re.search(r"<h1[^>]*>[^<]*出典", sec) is not None
    if no == 1 or is_src or no in refs.get("skip_slides", []):
        if refs.get("legend") and no == 1:
            sec = sec.replace("</section>", '  <div class="refs-legend">点線の下線の用語・青い過去問番号・各ページ下の「詳しく：」を押すと、参照元のサイト（e-Words／応用情報技術者試験.com）で詳しい解説が開く</div>\n</section>')
        if refs.get("legend") and is_src:
            note = ('<dt class="refs-src">参照リンク</dt><dd>各ページのリンク先は、'
                    '<a class="src" href="https://e-words.jp/">IT用語辞典 e-Words</a>、'
                    '<a class="src" href="https://www.ap-siken.com/keyword/">応用情報技術者試験.com（用語集・過去問解説）</a>'
                    f'。{refs.get("checked", "")}にリンク先が開けることを確かめた</dd>')
            if '<dl class="def">' in sec:
                sec = sec.replace('<dl class="def">', '<dl class="def">\n    ' + note, 1)
        return sec
    terms = dict(refs["inline"])
    terms.update(refs.get("override", {}).get(str(no), {}))
    keys = sorted((k for k, v in terms.items() if v), key=len, reverse=True)
    pat = re.compile("|".join(re.escape(t) for t in keys))
    used, hits = set(), []
    # 図・見出し・出典の行・ほかのリンクの中には付けない（リンクの入れ子を防ぐ）
    tokens = re.split(r'(<svg.*?</svg>|<h1.*?</h1>|<div class="cite">.*?</div>|<a\s.*?</a>|<[^>]+>)', sec, flags=re.S)
    def one(t):
        if t.startswith('<div class="cite">'):
            # 出典の行にはリンクを付けないが、「詳しく：」の選び方は前と同じにするため用語は数える
            link_text(re.sub(r"<[^>]+>", "", t), pat, terms, used, hits)
            return t
        return t if t.startswith("<") else link_text(t, pat, terms, used, hits)
    sec = "".join(one(t) for t in tokens)
    foot = refs.get("foot", {}).get(str(no))
    if foot is None and "secs" in refs:
        foot = auto_foot(hits)
    if foot:
        links = " ／ ".join(f'<a class="ref" href="{esc(u)}">{l}</a>' for l, u in foot)
        sec = sec.replace("</section>", f'  <div class="refs">詳しく：{links}</div>\n</section>')
    return sec


n = [0]


def repl(m):
    n[0] += 1
    return process_section(m.group(0), n[0])


html = re.sub(r"<section.*?</section>", repl, html, flags=re.S)
open(src, "w", encoding="utf-8").write(html)
print("slides:", n[0])
