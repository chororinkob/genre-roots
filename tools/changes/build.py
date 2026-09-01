# -*- coding: utf-8 -*-
"""ジャンルの追加・修正の履歴から、docs/changes.html を組み立てる。

【何のためのものか】
ジャンルの追加も、修正依頼の反映も、利用者が確認して承認すればその場で
辞典に入る。チョロさんが一件ずつ見ているわけではないので、
「知らないうちに中身が変わっていて気づけない」という状態になる。
あとから「いつ・どのジャンルが・どう変わったか」を追えるようにするのが
このページ。

【なぜGitHubから毎回取らないか】
GitHubの窓口は1時間に60回までで、しかも100件ずつしか返さない。
履歴が増えるほどページを開くのが重くなり、そのうち上限に当たる。
手元の記録から静的なページを組み立てておけば、何回開いても軽く、
上限もない。

【いつ作り直すか】
`.github/workflows/changes.yml` が、ジャンルの追加・修正が入るたびに
自動で走らせる。手で作り直したいときは、このファイルを直接動かす。

    python tools/changes/build.py
"""
import io, os, re, subprocess, sys, html
from collections import OrderedDict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ここ = os.path.dirname(os.path.abspath(__file__))
リポジトリ = os.path.abspath(os.path.join(ここ, '..', '..'))
出力先 = os.path.join(リポジトリ, 'docs', 'changes.html')

# genre_adder.py が付ける記録の書き方。ここが変わったら合わせること。
#   新規追加  : feat: Barbershop を追加 (2026年8月28日)
#   修正の反映: feat: glam_metalの修正依頼を反映 を追加 (2026年8月12日)
新規の形 = re.compile(r'^feat: (?!.*の修正依頼を反映)(.+?) を追加 \(\d+年\d+月\d+日\)$')
修正の形 = re.compile(r'^feat: (.+?)の修正依頼を反映 を追加 \(\d+年\d+月\d+日\)$')

# 版の番号とジャンル数の行は、どの変更にも必ず付いてくる。
# 中身の変化ではないので、履歴には出さない。
雑音 = ('version-info', 'genre-count', 'FAME_DATE', 'gr-genre-count')

項目の名 = {
    'desc': '説明', 'roots': 'ルーツ', 'rep_tracks': '代表曲',
    'aliases': '別名', 'label': '名前', 'era': '発祥時期', 'cat': 'カテゴリ',
    'yt_mix': '動画', 'yt_tracks': '代表曲の動画', 'fame': '知名度',
}


def git(*引数):
    return subprocess.run(['git', '-C', リポジトリ] + list(引数),
                          capture_output=True, text=True, encoding='utf-8',
                          errors='replace').stdout


def 変わったところ(前, 後, 前後=18):
    """2つの行を見比べて、違っている部分だけを前後の文字ごと取り出す。

    行まるごとを出すと、変わっていない何百字もの説明文まで並んでしまう。
    頭から共通する分と、尻から共通する分を落とすと、実際に書き換わった
    部分だけが残る。
    """
    i = 0
    while i < min(len(前), len(後)) and 前[i] == 後[i]:
        i += 1
    j = 0
    while j < min(len(前), len(後)) - i and 前[len(前)-1-j] == 後[len(後)-1-j]:
        j += 1
    切る = lambda s: (('…' if i > 前後 else '')
                      + s[max(0, i - 前後):len(s) - j + 前後]
                      + ('…' if len(s) - j + 前後 < len(s) else ''))
    return 切る(前), 切る(後)


def つながりを読む(行):
    """つながり(LINKS)の行から、結んでいる2つと説明だけを取り出す。"""
    if not 行:
        return ''
    m = re.search(r'\{s:"([^"]+)",\s*t:"([^"]+)"', 行)
    d = re.search(r'desc:"((?:[^"\\]|\\.){0,300})', 行)
    向き = ('%s → %s' % (m.group(1), m.group(2))) if m else ''
    説明 = d.group(1) if d else ''
    if 向き and 説明:
        return '%s ： %s' % (向き, 説明)
    return 向き or 説明 or 行.strip()[:200]


def 新規の中身(足された, 名前):
    """新しく足されたジャンルの、カテゴリと説明の書き出しを取り出す。"""
    かたまり = '\n'.join(足された)
    m = re.search(r'\{id:"([^"]+)",\s*label:"([^"]*' + re.escape(名前.split()[0]) + r'[^"]*)"',
                  かたまり)
    if not m:
        m = re.search(r'\{id:"([^"]+)",\s*label:"([^"]+)"', かたまり)
    id_ = m.group(1) if m else ''
    cat = re.search(r'cat:"([^"]+)"', かたまり)
    desc = re.search(r'desc:"((?:[^"\\]|\\.){0,400})', かたまり)
    return {
        'id': id_,
        'cat': cat.group(1) if cat else '',
        'desc': (desc.group(1).replace('\\"', '"') if desc else ''),
    }


def 修正の中身(引かれた, 足された):
    """書き換わった項目と、その前後を組にして取り出す。"""
    出 = []
    for 前, 後 in zip(引かれた, 足された):
        if 前 == 後:
            continue
        m = re.search(r'\b(desc|roots|rep_tracks|aliases|label|era|cat|yt_mix|yt_tracks|fame)\s*:', 後) \
            or re.search(r'\b(desc|roots|rep_tracks|aliases|label|era|cat|yt_mix|yt_tracks|fame)\s*:', 前)
        # つながり(LINKS)の行かどうか。この行は
        #   {s:"country",t:"norteno",w:25,score:{...},desc:"..."}
        # という形をしていて、生のまま出しても読めない。
        # どの2つを結ぶ線なのかと、その説明だけを取り出す。
        繋がり = ('{s:"' in 後 or '{s:"' in 前)
        if 繋がり:
            名 = 'つながりの説明'
            b, a = つながりを読む(前), つながりを読む(後)
            if b == a:
                continue
        else:
            名 = 項目の名.get(m.group(1), m.group(1)) if m else 'その他'
            b, a = 変わったところ(前, 後)
        出.append({'項目': 名, '前': b, '後': a})
    # 前後の行数が合わない（丸ごと足された・消された）場合も取りこぼさない
    for 余り, 向き in ((引かれた[len(足された):], '消えた'), (足された[len(引かれた):], '増えた')):
        for l in 余り:
            読み = つながりを読む(l) if '{s:"' in l else l.strip()[:200]
            名 = ('つながりが' + 向き) if '{s:"' in l else ('行が' + 向き)
            出.append({'項目': 名, '前': '' if 向き == '増えた' else 読み,
                       '後': 読み if 向き == '増えた' else ''})
    return 出


def 集める():
    記録 = git('log', '--format=%H\t%ad\t%s', '--date=short')
    件 = []
    for 行 in 記録.splitlines():
        欄 = 行.split('\t')
        if len(欄) < 3:
            continue
        sha, 日, 題 = 欄[0], 欄[1], 欄[2]
        m新 = 新規の形.match(題)
        m修 = 修正の形.match(題)
        if not (m新 or m修):
            continue
        差 = git('show', sha, '--', 'genre_roots.html')
        引 = [l[1:] for l in 差.splitlines()
              if l.startswith('-') and not l.startswith('---') and not any(x in l for x in 雑音)]
        足 = [l[1:] for l in 差.splitlines()
              if l.startswith('+') and not l.startswith('+++') and not any(x in l for x in 雑音)]
        if m新:
            中 = 新規の中身(足, m新.group(1))
            # 【ジャンルの追加と、動画の入れ替えを見分ける】
            # genre_adder は動画を差し替えたときにも
            #   feat: メイン動画を3件差し替え を追加 (2026年8月6日)
            # という同じ書き方の記録を残す。題名だけでは見分けられない。
            # 新しいジャンルが本当に足されたかどうか（id と label の組が
            # 増えているか）で判断する。これなら書き方が変わっても効く。
            種 = '新規' if 中.get('id') else '動画'
            件.append({'種類': 種, '日': 日, 'sha': sha, '名': m新.group(1), **中})
        else:
            件.append({'種類': '修正', '日': 日, 'sha': sha, 'id': m修.group(1),
                       '名': m修.group(1), '中身': 修正の中身(引, 足)})
    return 件


def ならす(s):
    """画面に出す前に整える。

    説明文の中の改行は、本物の改行ではなく「バックスラッシュ」と「n」の
    2文字として入っている。そのまま出すと画面にその2文字が見えてしまう
    （実際に Trot の説明でそう出た）。空白に置き換える。
    """
    s = (s or '').replace('\\n', ' ').replace('\\"', '"')
    return re.sub(r'\s+', ' ', s).strip()


def 逃がす(s):
    return html.escape(ならす(s), quote=False)


def 組み立てる(件):
    新規数 = sum(1 for x in 件 if x['種類'] == '新規')
    修正数 = sum(1 for x in 件 if x['種類'] == '修正')
    動画数 = sum(1 for x in 件 if x['種類'] == '動画')
    期間 = ('%s 〜 %s' % (件[-1]['日'], 件[0]['日'])) if 件 else '—'

    月ごと = OrderedDict()
    for x in 件:
        月 = x['日'][:7]
        月ごと.setdefault(月, []).append(x)

    本文 = []
    for 月, 中 in 月ごと.items():
        年, つき = 月.split('-')
        本文.append('<h2 class="month">%s年%s月 <span class="cnt">%d件</span></h2>'
                    % (年, int(つき), len(中)))
        for x in 中:
            種 = x['種類']
            印 = {'新規': '新規追加', '修正': '修正', '動画': '動画の入れ替え'}[種]
            クラス = {'新規': 'new', '修正': 'fix', '動画': 'vid'}[種]
            リンク = 'https://github.com/chororinkob/genre-roots/commit/' + x['sha']
            中身 = []
            if 種 == '動画':
                中身.append('<p class="meta">動画の差し替え・補完です。'
                            'ジャンルの中身は変わっていません。</p>')
            elif 種 == '新規':
                if x.get('desc'):
                    中身.append('<p class="desc">%s</p>' % 逃がす(x['desc'][:220]
                                + ('…' if len(x['desc']) > 220 else '')))
                脇 = []
                if x.get('id'): 脇.append('id: <code>%s</code>' % 逃がす(x['id']))
                if x.get('cat'): 脇.append('カテゴリ: <code>%s</code>' % 逃がす(x['cat']))
                if 脇: 中身.append('<p class="meta">%s</p>' % '　'.join(脇))
            else:
                for c in x['中身'][:6]:
                    中身.append(
                        '<div class="chg"><span class="field">%s</span>'
                        '<div class="ba"><div class="before"><span class="lbl">前</span>%s</div>'
                        '<div class="after"><span class="lbl">後</span>%s</div></div></div>'
                        % (逃がす(c['項目']), 逃がす(c['前']) or '<span class="none">（なし）</span>',
                           逃がす(c['後']) or '<span class="none">（なし）</span>'))
                if len(x['中身']) > 6:
                    中身.append('<p class="meta">ほか %d か所</p>' % (len(x['中身']) - 6))
                if not x['中身']:
                    中身.append('<p class="meta">中身の取り出しができませんでした。'
                                '右の「記録を見る」から実物を確認できます。</p>')
            本文.append(
                '<article class="item %s" data-kind="%s">'
                '<div class="head"><span class="tag %s">%s</span>'
                '<span class="name">%s</span><time>%s</time>'
                '<a class="src" href="%s" target="_blank" rel="noopener">記録を見る</a></div>'
                '%s</article>'
                % (クラス, 種, クラス, 印, 逃がす(x['名']), x['日'], リンク, ''.join(中身)))

    return テンプレ % {
        '件数': len(件), '新規数': 新規数, '修正数': 修正数, '動画数': 動画数, '期間': 期間,
        '本文': '\n'.join(本文),
    }


テンプレ = '''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>更新の記録 — 音楽ジャンルルーツ辞典</title>
<meta name="description" content="音楽ジャンルルーツ辞典に、いつ・どのジャンルが追加され、どこが直されたかの一覧。">
<link rel="canonical" href="https://genre-roots.com/docs/changes.html">
<meta name="robots" content="noindex">
<style>
  :root {
    --bg: #0f0f1a; --surface: #16162a; --surface-2: #1e1e38;
    --text: #f0f0f8; --text-2: #9a9aae; --border: rgba(255,255,255,0.09);
    --accent: #e94560; --ok: #22c55e; --info: #7ecfff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: "Hiragino Sans", "Noto Sans JP", system-ui, -apple-system, sans-serif;
    padding: 0 0 80px; line-height: 1.75;
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
  .top-bar a.to-toc {
    background: transparent; border-color: rgba(255,255,255,0.28);
    color: var(--text-2); box-shadow: none;
  }
  .top-bar a.to-toc:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .tb-short { display: none; }
  @media (max-width: 760px) {
    .tb-full { display: none; }
    .tb-short { display: inline; }
    .top-bar { gap: 6px; padding: 12px 12px; }
    .top-bar a { padding: 8px 11px; font-size: 12.5px; }
  }

  .wrap { max-width: 820px; margin: 0 auto; padding: 30px 20px 0; }
  h1 { font-size: clamp(19px, 5vw, 26px); font-weight: 800; margin-bottom: 6px; }
  .lede { font-size: 13.5px; color: var(--text-2); margin-bottom: 18px; }

  .sum { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
  .sum div {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 14px; min-width: 96px;
  }
  .sum b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; }
  .sum span { font-size: 11.5px; color: var(--text-2); }

  .filters { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
  .filters button {
    background: transparent; color: var(--text-2); font-size: 12.5px; font-weight: 700;
    border: 1px solid rgba(255,255,255,0.22); border-radius: 999px;
    padding: 7px 15px; cursor: pointer; font-family: inherit;
  }
  .filters button[aria-pressed="true"] { background: #2f6fd0; border-color: #4a86e8; color: #fff; }
  .filters button:hover { color: #fff; }

  h2.month {
    font-size: 13px; color: var(--text-2); font-weight: 700; letter-spacing: .04em;
    margin: 30px 0 12px; padding-bottom: 7px; border-bottom: 1px solid var(--border);
  }
  h2.month .cnt { font-weight: 400; }

  .item {
    background: var(--surface); border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: 10px; padding: 13px 16px; margin-bottom: 10px;
  }
  .item.new { border-left-color: var(--ok); }
  .item.fix { border-left-color: var(--info); }
  .item.vid { border-left-color: #a78bfa; }
  .head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .tag {
    font-size: 10.5px; font-weight: 700; border-radius: 4px; padding: 2px 7px;
    letter-spacing: .03em; flex: 0 0 auto;
  }
  .tag.new { background: rgba(34,197,94,.16); color: #4ade80; }
  .tag.fix { background: rgba(126,207,255,.14); color: var(--info); }
  .tag.vid { background: rgba(167,139,250,.16); color: #c4b5fd; }
  .name { font-weight: 700; font-size: 15px; }
  time { font-size: 11.5px; color: var(--text-2); font-variant-numeric: tabular-nums; }
  .src { margin-left: auto; font-size: 11.5px; color: var(--text-2); text-decoration: none;
         border-bottom: 1px dotted var(--text-2); }
  .src:hover { color: #fff; border-bottom-color: #fff; }
  .desc { font-size: 13px; color: #d5d5e2; margin-top: 8px; }
  .meta { font-size: 11.5px; color: var(--text-2); margin-top: 7px; }
  code { background: var(--surface-2); border-radius: 4px; padding: 1px 6px; font-size: 11.5px; }

  .chg { margin-top: 10px; }
  .field {
    font-size: 11px; font-weight: 700; color: var(--text-2);
    background: var(--surface-2); border-radius: 4px; padding: 2px 8px;
  }
  .ba { margin-top: 6px; display: grid; gap: 5px; }
  .before, .after {
    font-size: 12.5px; border-radius: 7px; padding: 7px 11px;
    overflow-wrap: anywhere; line-height: 1.7;
  }
  .before { background: rgba(233,69,96,.10); color: #ffc9d2; }
  .after  { background: rgba(34,197,94,.10);  color: #b6f0c6; }
  .lbl { font-size: 10px; font-weight: 700; opacity: .75; margin-right: 8px; }
  .none { opacity: .5; }
  .empty { color: var(--text-2); font-size: 13px; padding: 30px 0; }
  footer { max-width: 820px; margin: 40px auto 0; padding: 0 20px;
           font-size: 11.5px; color: var(--text-2); }
</style>
</head>
<body>
<div class="top-bar">
  <a href="../genre_roots.html"><span class="tb-full">← ジャンルマップに戻る</span><span class="tb-short">← 地図へ</span></a>
  <a class="to-toc" href="manual.html#menu"><span class="tb-full">↑ 目次に戻る</span><span class="tb-short">↑ 目次</span></a>
</div>

<div class="wrap">
  <h1>更新の記録</h1>
  <p class="lede">辞典に載っているジャンルが、いつ・どこが変わったかの一覧です。<br>
    ジャンルの追加と、間違いの指摘（修正依頼）は、出した方がその場で内容を確かめて
    承認すると辞典に入ります。ここは、そうして入った変更をあとから追えるようにした場所です。</p>

  <div class="sum">
    <div><b>%(件数)d</b><span>変更の件数</span></div>
    <div><b>%(新規数)d</b><span>ジャンルの追加</span></div>
    <div><b>%(修正数)d</b><span>内容の修正</span></div>
    <div><b>%(動画数)d</b><span>動画の入れ替え</span></div>
  </div>
  <p class="lede">%(期間)s</p>

  <div class="filters">
    <button type="button" data-f="all" aria-pressed="true">すべて</button>
    <button type="button" data-f="新規" aria-pressed="false">ジャンルの追加だけ</button>
    <button type="button" data-f="修正" aria-pressed="false">内容の修正だけ</button>
    <button type="button" data-f="動画" aria-pressed="false">動画の入れ替えだけ</button>
  </div>

  <div id="list">
%(本文)s
  </div>
  <p class="empty" id="empty" hidden>該当する変更はありません。</p>
</div>

<footer>
  このページは、辞典の変更の記録から自動で作られています。手で書き足すものではありません。<br>
  作り直すには <code>python tools/changes/build.py</code>。ジャンルが追加・修正されると自動で作り直されます。
</footer>

<script>
// 絞り込み。押したものだけを残す。
document.querySelectorAll('.filters button').forEach(b => {
  b.addEventListener('click', () => {
    const f = b.dataset.f;
    document.querySelectorAll('.filters button').forEach(x =>
      x.setAttribute('aria-pressed', String(x === b)));
    let 見えてる = 0;
    document.querySelectorAll('.item').forEach(el => {
      const 出す = (f === 'all' || el.dataset.kind === f);
      el.hidden = !出す;
      if (出す) 見えてる++;
    });
    // 中身が全部隠れた月の見出しも一緒に隠す
    document.querySelectorAll('h2.month').forEach(h => {
      let n = 0;
      for (let e = h.nextElementSibling; e && e.tagName === 'ARTICLE'; e = e.nextElementSibling)
        if (!e.hidden) n++;
      h.hidden = (n === 0);
    });
    document.getElementById('empty').hidden = (見えてる > 0);
  });
});
</script>
</body>
</html>
'''


if __name__ == '__main__':
    件 = 集める()
    io.open(出力先, 'w', encoding='utf-8', newline='\n').write(組み立てる(件))
    数 = lambda k: sum(1 for x in 件 if x['種類'] == k)
    print('  ○ docs/changes.html を作りました')
    print('     全 %d 件（ジャンルの追加 %d / 内容の修正 %d / 動画の入れ替え %d）'
          % (len(件), 数('新規'), 数('修正'), 数('動画')))
    if 件:
        print('     期間 %s 〜 %s' % (件[-1]['日'], 件[0]['日']))
