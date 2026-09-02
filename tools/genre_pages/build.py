# -*- coding: utf-8 -*-
"""地図のデータから、ジャンルごとの解説ページを組み立てる。

【何のためのものか】
いまの辞典は1ページしかなく、573ジャンルの説明はすべて JavaScript の中に
入っている。検索エンジンから見ると「753字しか書いていないサイト」で、
「クラウトロック とは」で検索しても絶対に出てこない。

ジャンルごとに1ページずつ作り、説明を「画面に見える文字」として置くことで、
検索から人が来られるようにする。

【読み物を別に作るのではない】
見た目も中身も、地図の説明パネルと同じものにする。書き下ろしはしない。
上に「ジャンルマップで見る」を置き、押すとそのジャンルが開いた状態の
地図が立ち上がる（genre_roots.html?genre=… ・地図 v27.57 で対応済み）。

    python tools/genre_pages/build.py            … 全部作る
    python tools/genre_pages/build.py krautrock  … 1つだけ作る（下見用）
"""
import html
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ここ = os.path.dirname(os.path.abspath(__file__))
リポジトリ = os.path.abspath(os.path.join(ここ, '..', '..'))
地図 = os.path.join(リポジトリ, 'genre_roots.html')
出力先 = os.path.join(リポジトリ, 'genre')
公開 = 'https://genre-roots.com'

# 文字列の中の「"」は \" と書かれている。ふつうに [^"]* で取ると
# そこで切れてしまう（4'33" のような曲名で実際に起きる）。
文字列 = lambda 名: re.compile(名 + r':"((?:[^"\\]|\\.)*)"')


def ほどく(s):
    """JavaScript の文字列を、そのまま読める形に戻す。"""
    return (s.replace('\\"', '"').replace("\\'", "'")
             .replace('\\n', '\n').replace('\\\\', '\\'))


def 読み込む():
    s = io.open(地図, encoding='utf-8').read()

    # ── ジャンル ──
    節点 = {}
    順 = []
    for m in re.finditer(r'\{id:"([a-z0-9_]+)",\s*label:"((?:[^"\\]|\\.)*)"', s):
        始 = m.start()
        次 = s.find('\n  {id:"', 始 + 10)
        中 = s[始:次 if 次 > 0 else 始 + 8000]
        取 = lambda 名: (文字列(名).search(中).group(1) if 文字列(名).search(中) else '')
        並び = lambda 名: re.findall(r'"((?:[^"\\]|\\.)*)"',
                                    (re.search(名 + r':\[([^\]]*)\]', 中) or
                                     re.match(r'(?!)', '')).group(1)) \
            if re.search(名 + r':\[([^\]]*)\]', 中) else []
        id_ = m.group(1)
        節点[id_] = {
            'id': id_,
            'label': ほどく(m.group(2)).replace('\n', ' '),
            'cat': 取('cat'),
            'era': 取('era'),
            'desc': ほどく(取('desc')),
            'roots_story': ほどく(取('roots_story')),
            'aliases': [ほどく(x) for x in 並び('aliases')],
            'rep_tracks': [ほどく(x) for x in 並び('rep_tracks')],
        }
        順.append(id_)

    # ── つながり ──
    i = s.index('const LINKS')
    j = s.index('\n];', i)
    繋 = []
    for m in re.finditer(r'\{s:"([a-z0-9_]+)",\s*t:"([a-z0-9_]+)"', s[i:j]):
        始 = i + m.start()
        終 = s.find('}', s.find('desc:', 始)) if 'desc:' in s[始:始 + 900] else 始
        d = 文字列('desc').search(s[始:始 + 900])
        繋.append({'s': m.group(1), 't': m.group(2),
                   'desc': ほどく(d.group(1)) if d else ''})

    # ── カテゴリの日本語名 ──
    カテゴリ = {}
    for m in re.finditer(r'data-cat="([a-z0-9_]+)"[^>]*>.*?legend-label">([^<]+)<', s):
        カテゴリ[m.group(1)] = m.group(2)

    # ── 知名度（★1〜5）──
    知名度 = {}
    k = s.find('const FAME = {')
    if k > 0:
        # 書き方は  krautrock: [3,41,…]  で、キーに引用符は付かない
        for m in re.finditer(r'([a-z0-9_]+):\s*\[\s*(\d)', s[k:s.index('\n};', k)]):
            知名度[m.group(1)] = int(m.group(2))

    return 節点, 順, 繋, カテゴリ, 知名度


def 逃(s):
    return html.escape(s or '', quote=True)


def カタカナ(節):
    """題名に添える読み。別名の中からカタカナのものを選ぶ。"""
    for a in 節['aliases']:
        if re.fullmatch(r'[ァ-ヴー・＝\s]+', a):
            return a
    return ''


def 段落(文):
    """長い説明を、読みやすいように段落に分ける。
    もとの文章は一続きなので、句点で区切って3文ずつまとめる。"""
    if not 文:
        return ''
    文たち = [x for x in re.split(r'(?<=。)', 文.replace('\n', '')) if x.strip()]
    塊 = ['<p>%s</p>' % 逃(''.join(文たち[i:i + 3])) for i in range(0, len(文たち), 3)]
    return '\n      '.join(塊)


def 作る(id_, 節点, 繋, カテゴリ, 知名度):
    n = 節点[id_]
    読み = カタカナ(n)
    題 = '%s%s とは' % (n['label'], ('（%s）' % 読み) if 読み else '')
    説明文 = re.sub(r'\s+', ' ', n['desc'])[:115]

    親 = [x for x in 繋 if x['t'] == id_ and x['s'] in 節点]
    子 = [x for x in 繋 if x['s'] == id_ and x['t'] in 節点]
    星 = 知名度.get(id_, 0)

    脇 = []
    if n['era']:
        脇.append('<div><dt>発祥</dt><dd>%s年ごろ</dd></div>' % 逃(n['era']))
    if n['cat']:
        脇.append('<div><dt>カテゴリ</dt><dd>%s</dd></div>' % 逃(カテゴリ.get(n['cat'], n['cat'])))
    if 星:
        脇.append('<div><dt>知名度</dt><dd class="fame">%s<span>%s</span></dd></div>'
                  % ('★' * 星, '☆' * (5 - 星)))
    if n['aliases']:
        脇.append('<div><dt>別名</dt><dd>%s</dd></div>'
                  % '、'.join(逃(a) for a in n['aliases']))

    曲 = ''
    if n['rep_tracks']:
        曲 = ('<h2>代表曲</h2>\n      <ul class="tracks">%s</ul>'
              % ''.join('<li>%s</li>' % 逃(t) for t in n['rep_tracks']))

    def 並べる(見出し, 一覧, 向き):
        if not 一覧:
            return ''
        行 = []
        for x in 一覧:
            相手 = x['s'] if 向き == '親' else x['t']
            行.append('<li><a href="%s.html">%s</a>%s</li>'
                      % (逃(相手), 逃(節点[相手]['label']),
                         ('<span>%s</span>' % 逃(x['desc'])) if x['desc'] else ''))
        return '<h2>%s</h2>\n      <ul class="rel">%s</ul>' % (見出し, ''.join(行))

    構造 = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": 題,
        "description": 説明文,
        "inLanguage": "ja",
        "isPartOf": {"@type": "WebSite", "name": "音楽ジャンルルーツ辞典", "url": 公開 + "/"},
        "about": {"@type": "Thing", "name": n['label'],
                  "alternateName": n['aliases'], "description": 説明文},
    }

    return テンプレ % {
        'id': 逃(id_),
        'title': 逃(題),
        'label': 逃(n['label']),
        'yomi': ('<span class="yomi">%s</span>' % 逃(読み)) if 読み else '',
        'desc_meta': 逃(説明文),
        'meta': ''.join(脇),
        'body': 段落(n['desc']),
        'tracks': 曲,
        'roots': ('<h2>成り立ち</h2>\n      %s' % 段落(n['roots_story'])) if n['roots_story'] else '',
        'parents': 並べる('影響を受けたジャンル（ルーツ）', 親, '親'),
        'children': 並べる('影響を与えたジャンル', 子, '子'),
        'jsonld': json.dumps(構造, ensure_ascii=False),
    }


テンプレ = '''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%(title)s — 音楽ジャンルルーツ辞典</title>
<meta name="description" content="%(desc_meta)s">
<link rel="canonical" href="https://genre-roots.com/genre/%(id)s.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="音楽ジャンルルーツ辞典">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="%(title)s — 音楽ジャンルルーツ辞典">
<meta property="og:description" content="%(desc_meta)s">
<meta property="og:url" content="https://genre-roots.com/genre/%(id)s.html">
<meta property="og:image" content="https://genre-roots.com/ogp.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://genre-roots.com/ogp.jpg">
<script type="application/ld+json">%(jsonld)s</script>
<style>
  :root {
    --bg: #0f0f1a; --surface: #16162a; --surface-2: #1e1e38;
    --text: #f0f0f8; --text-2: #9a9aae; --border: rgba(255,255,255,0.09);
    --accent: #e94560; --gold: #e8d9a0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: "Hiragino Sans", "Noto Sans JP", system-ui, -apple-system, sans-serif;
    padding: 0 0 80px; line-height: 1.9;
  }
  .top-bar {
    position: sticky; top: 0; z-index: 10;
    background: rgba(15,15,26,0.92); backdrop-filter: blur(6px);
    border-bottom: 1px solid var(--border); padding: 14px 20px;
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  }
  .top-bar a {
    color: #fff; text-decoration: none; font-size: 14px; font-weight: 700;
    display: inline-flex; align-items: center; gap: 8px;
    background: #2f6fd0; border: 1px solid #4a86e8; border-radius: 8px;
    padding: 9px 18px; box-shadow: 0 2px 10px rgba(47,111,208,.35);
  }
  .top-bar a:hover { background: #3d80e6; }
  .top-bar a:focus-visible { outline: 2px solid #ffcc33; outline-offset: 2px; }
  .top-bar a.sub {
    background: transparent; border-color: rgba(255,255,255,0.28);
    color: var(--text-2); box-shadow: none;
  }
  .top-bar a.sub:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .tb-short { display: none; }
  @media (max-width: 760px) {
    .tb-full { display: none; }
    .tb-short { display: inline; }
    .top-bar { gap: 6px; padding: 12px 12px; }
    .top-bar a { padding: 8px 11px; font-size: 12.5px; }
  }

  .wrap { max-width: 760px; margin: 0 auto; padding: 30px 20px 0; }

  /* 見出しまわり。地図の説明パネルの頭と同じ見え方にする */
  .head {
    background: linear-gradient(180deg, rgba(232,217,160,.10), transparent);
    border-bottom: 1px solid var(--border);
    padding-bottom: 18px; margin-bottom: 24px;
  }
  h1 { font-size: clamp(24px, 6vw, 34px); font-weight: 800; letter-spacing: -.01em;
       line-height: 1.35; }
  h1 .yomi { display: block; font-size: 15px; font-weight: 600;
             color: var(--gold); margin-top: 4px; letter-spacing: .04em; }
  dl.meta { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 14px; }
  dl.meta div { display: flex; gap: 8px; align-items: baseline; }
  dl.meta dt { font-size: 11.5px; color: var(--text-2); font-weight: 700; }
  dl.meta dd { font-size: 13.5px; }
  dd.fame { color: var(--gold); letter-spacing: .1em; }
  dd.fame span { color: rgba(232,217,160,.28); }

  h2 {
    font-size: 15px; font-weight: 800; letter-spacing: .02em;
    margin: 34px 0 12px; padding-left: 11px; border-left: 3px solid var(--accent);
  }
  p { margin-bottom: 15px; font-size: 15px; }

  ul.tracks { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
  ul.tracks li {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 999px; padding: 6px 15px; font-size: 13.5px;
  }
  ul.rel { list-style: none; display: grid; gap: 8px; }
  ul.rel li {
    background: var(--surface); border: 1px solid var(--border);
    border-left: 3px solid rgba(233,69,96,.5);
    border-radius: 9px; padding: 11px 15px;
  }
  ul.rel a { color: #9fc6ff; font-weight: 700; font-size: 14.5px; text-decoration: none; }
  ul.rel a:hover { text-decoration: underline; }
  ul.rel span { display: block; color: var(--text-2); font-size: 13px;
                margin-top: 4px; line-height: 1.75; }

  .cta {
    margin: 40px 0 0; padding: 22px; text-align: center;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  }
  .cta p { color: var(--text-2); font-size: 13.5px; margin-bottom: 14px; }
  .cta a {
    display: inline-flex; align-items: center; gap: 9px;
    background: #2f6fd0; border: 1px solid #4a86e8; border-radius: 9px;
    color: #fff; text-decoration: none; font-weight: 800; font-size: 15px;
    padding: 13px 26px; box-shadow: 0 3px 14px rgba(47,111,208,.4);
  }
  .cta a:hover { background: #3d80e6; }
  footer { max-width: 760px; margin: 34px auto 0; padding: 0 20px;
           font-size: 11.5px; color: var(--text-2); }
  footer a { color: var(--text-2); }
</style>
</head>
<body>
<div class="top-bar">
  <a href="../genre_roots.html?genre=%(id)s"><span class="tb-full">▶ ジャンルマップで見る</span><span class="tb-short">▶ 地図で見る</span></a>
  <a class="sub" href="../docs/manual.html#menu"><span class="tb-full">↑ 目次に戻る</span><span class="tb-short">↑ 目次</span></a>
  <a class="sub" href="../docs/manual.html#howto"><span class="tb-full">↑ 操作説明の目次に戻る</span><span class="tb-short">↑ 操作説明</span></a>
</div>

<div class="wrap">
  <article>
    <div class="head">
      <h1>%(label)s%(yomi)s</h1>
      <dl class="meta">%(meta)s</dl>
    </div>

    <h2>音楽性・特徴</h2>
      %(body)s

      %(tracks)s

      %(roots)s

      %(parents)s

      %(children)s

    <div class="cta">
      <p>このジャンルが、どのジャンルから生まれ、どこへ広がったのか。<br>
        573ジャンルのつながりを地図でたどれます。</p>
      <a href="../genre_roots.html?genre=%(id)s">▶ %(label)s を地図で見る</a>
    </div>
  </article>
</div>

<footer>
  <a href="../genre_roots.html">音楽ジャンルルーツ辞典</a> ・
  <a href="../docs/about.html">このサイトについて</a> ・
  © 2026 チョロ<br>
  このページは辞典のデータから自動で作られています。内容は説明パネルと同じものです。
</footer>
</body>
</html>
'''


if __name__ == '__main__':
    節点, 順, 繋, カテゴリ, 知名度 = 読み込む()
    print('  読み込み: ジャンル %d件 / つながり %d件 / カテゴリ %d件 / 知名度 %d件'
          % (len(節点), len(繋), len(カテゴリ), len(知名度)))
    対象 = sys.argv[1:] or 順
    os.makedirs(出力先, exist_ok=True)
    作った = 0
    for id_ in 対象:
        if id_ not in 節点:
            print('  ✗ %s というジャンルは無い' % id_)
            continue
        道 = os.path.join(出力先, id_ + '.html')
        io.open(道, 'w', encoding='utf-8', newline='\n').write(
            作る(id_, 節点, 繋, カテゴリ, 知名度))
        作った += 1
        if len(対象) <= 5:
            print('  ○ %s（%.1fKB）' % (道, os.path.getsize(道) / 1024))
    if 作った > 5:
        print('  ○ %d ページ作りました' % 作った)
