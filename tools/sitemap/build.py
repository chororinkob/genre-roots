# -*- coding: utf-8 -*-
"""検索エンジンへの案内状（sitemap.xml と robots.txt）を作る。

【何のためのものか】
Google は放っておいても住所を見つけてくれるが、?genre=… のような
「押さないと辿り着けない住所」は自力では見つけられない。
573本の住所を一覧にして渡すことで、見に来てもらえるようにする。

【なぜジャンルごとのページを作らないのか】
チョロさんの判断（2026-09-02）。この辞典の売りは地図であって説明文ではない。
別ページを作ると、地図の劣化版になり、用語の吹き出しも代表曲の再生も失われる。
地図の住所そのものを検索に載せる形にした。
検索から来た人は、いつもの地図がそのジャンルのパネルを開いた状態で始まる。

    python tools/sitemap/build.py
"""
import io
import os
import re
import sys
from xml.sax.saxutils import escape

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ここ = os.path.dirname(os.path.abspath(__file__))
リポジトリ = os.path.abspath(os.path.join(ここ, '..', '..'))
地図 = os.path.join(リポジトリ, 'genre_roots.html')
公開 = 'https://genre-roots.com'


def 日付():
    """地図が最後に変わった日。git の記録から取る。"""
    import subprocess
    r = subprocess.run(['git', '-C', リポジトリ, 'log', '-1', '--format=%ad',
                        '--date=short', '--', 'genre_roots.html'],
                       capture_output=True, text=True, encoding='utf-8')
    return (r.stdout or '').strip() or '2026-09-02'


def ジャンルたち():
    s = io.open(地図, encoding='utf-8').read()
    i = s.index('const NODES')
    j = s.index('\n];', i)
    return [m.group(1) for m in re.finditer(r'\{id:"([a-z0-9_]+)"', s[i:j])]


def 組み立てる(ids, 更新日):
    行 = []

    def 足す(道, 重み, 頻度='monthly'):
        行.append(
            '  <url>\n'
            '    <loc>%s</loc>\n'
            '    <lastmod>%s</lastmod>\n'
            '    <changefreq>%s</changefreq>\n'
            '    <priority>%s</priority>\n'
            '  </url>' % (escape(公開 + 道), 更新日, 頻度, 重み))

    # 入口と説明のページ
    足す('/genre_roots.html', '1.0', 'weekly')
    足す('/docs/manual.html', '0.5')
    足す('/docs/about.html', '0.3')
    足す('/docs/changes.html', '0.3', 'weekly')
    # ジャンルごとの住所。これが本体
    for id_ in ids:
        足す('/genre_roots.html?genre=' + id_, '0.8')

    地図xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n'
               + '\n'.join(行) + '\n</urlset>\n')
    # 正しい名前空間に直す（sitemaps.org）
    地図xml = 地図xml.replace('http://www.sitemap.org/schemas/sitemap/0.9',
                              'http://www.sitemaps.org/schemas/sitemap/0.9')

    ロボット = (
        '# 音楽ジャンルルーツ辞典\n'
        '# ジャンルごとの住所は sitemap.xml に一覧がある。\n'
        '# 押さないと辿り着けない住所なので、これが無いと見つけてもらえない。\n'
        'User-agent: *\n'
        'Allow: /\n'
        '\n'
        'Sitemap: %s/sitemap.xml\n' % 公開)
    return 地図xml, ロボット


if __name__ == '__main__':
    ids = ジャンルたち()
    更新日 = 日付()
    地図xml, ロボット = 組み立てる(ids, 更新日)
    io.open(os.path.join(リポジトリ, 'sitemap.xml'), 'w',
            encoding='utf-8', newline='\n').write(地図xml)
    io.open(os.path.join(リポジトリ, 'robots.txt'), 'w',
            encoding='utf-8', newline='\n').write(ロボット)
    print('  ○ sitemap.xml を作りました（住所 %d 本・最終更新 %s）'
          % (地図xml.count('<url>'), 更新日))
    print('     うちジャンル %d 本' % len(ids))
    print('  ○ robots.txt を作りました')
