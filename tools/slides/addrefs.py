"""
図解スライド（HTML）に参照元リンクを入れる。
使い方: python3 tools/slides/addrefs.py tools/slides/ap-01.html tools/slides/refs/ap-01.json
  - 本文の用語（refs の inline）に、1枚につき最初の1か所だけリンクを付ける
  - 「R4春 問1」のような過去問番号は、すべて応用情報技術者試験.com の解説ページにリンクする
  - 各ページの下に「詳しく：」の行（refs の foot）を足す
何度実行しても同じ結果になる（前に付けたリンクを外してから付け直す）。
"""
import json, re, sys

src, refs_path = sys.argv[1], sys.argv[2]
refs = json.load(open(refs_path, encoding="utf-8"))
html = open(src, encoding="utf-8").read()

# 前回のリンクを外す
html = re.sub(r'<a class="ref[^"]*" href="[^"]*">(.*?)</a>', r"\1", html, flags=re.S)
html = re.sub(r'\n?\s*<div class="refs">.*?</div>', "", html, flags=re.S)

season = {"春": "haru", "秋": "aki"}
q_re = re.compile(r"R([1-9])(春|秋) ?問([1-9])")
esc = lambda u: u.replace("&", "&amp;").replace('"', "&quot;")


def q_link(m):
    url = refs["kakomon"].format(yy="%02d" % int(m.group(1)), season=season[m.group(2)], q=m.group(3))
    return f'<a class="ref q" href="{esc(url)}">{m.group(0)}</a>'


def is_ascii_word(c):
    return c.isascii() and (c.isalnum() or c in "-_/")


def link_text(text, terms, used):
    """テキスト1つ分に、用語リンクと過去問リンクを付ける"""
    if not text.strip():
        return text
    pat = re.compile("|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True)))
    out, pos = [], 0
    for m in pat.finditer(text):
        t, url = m.group(0), terms[m.group(0)]
        if url is None or url in used:
            continue
        a, b = m.start(), m.end()
        # 英字の用語は、前後が英数字なら単語の一部なので付けない（例：RAM の AM）
        if t[0].isascii() and a > 0 and is_ascii_word(text[a - 1]):
            continue
        if t[-1].isascii() and b < len(text) and is_ascii_word(text[b]):
            continue
        used.add(url)
        out.append(text[pos:a])
        out.append(f'<a class="ref" href="{esc(url)}">{t}</a>')
        pos = b
    out.append(text[pos:])
    s = "".join(out)
    # 過去問番号（リンクの外だけ）
    parts = re.split(r"(<a .*?</a>)", s)
    return "".join(p if p.startswith("<a ") else q_re.sub(q_link, p) for p in parts)


def process_section(sec, no):
    if no in refs.get("skip_slides", []):
        return sec
    terms = dict(refs["inline"])
    terms.update(refs.get("override", {}).get(str(no), {}))
    used = set()
    # svg・見出し・タグの中は触らない。テキスト部分だけ処理する
    tokens = re.split(r"(<svg.*?</svg>|<h1.*?</h1>|<[^>]+>)", sec, flags=re.S)
    res = []
    for tok in tokens:
        if tok.startswith("<"):
            res.append(tok)
        else:
            res.append(link_text(tok, terms, used))
    sec = "".join(res)
    foot = refs.get("foot", {}).get(str(no))
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
