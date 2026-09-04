# -*- coding: utf-8 -*-
"""panel_detail_figs.js で撮った生スクリーンショットから、
説明パネルの部分だけを切り出して docs/img に書き出す。
新しい図なので、jpgにする.py の「既存の横幅に合わせる」対象外
（新規ファイルは幅を自分で決める）。
"""
from PIL import Image
import os

出た = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out')
置き場 = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'img'))
幅 = 760  # 他の図と揃える

def 保存(名, im, target_w=幅):
    if im.size[0] != target_w:
        im = im.resize((target_w, round(im.size[1] * target_w / im.size[0])), Image.LANCZOS)
    先 = os.path.join(置き場, 名 + '.jpg')
    im.convert('RGB').save(先, quality=88, optimize=True)
    print('%-22s -> %s  %dx%d  %dKB' % (名, os.path.basename(先), im.size[0], im.size[1], os.path.getsize(先)//1024))

# パネルはビューポート右側、x=2150〜2800（deviceScaleFactor 2 の物理px）
PANEL_L, PANEL_R = 2150, 2800

def パネル切り出し(ファイル名, y1, y2):
    im = Image.open(os.path.join(出た, ファイル名))
    return im.crop((PANEL_L, y1, PANEL_R, y2))

# ① 上部：ジャンル名・知名度・別名・発祥時期・動画・代表曲・Spotify
保存('pnl1_top', パネル切り出し('pnl1_top.png', 90, 1090))

# ② 音楽性・特徴＋用語のふきだし
保存('pnl2_desc_gloss', パネル切り出し('pnl2_desc_gloss.png', 90, 500))

# ③ 成り立ち＋関連する書籍
保存('pnl3_roots_books', パネル切り出し('pnl3_roots_books.png', 90, 1170))

# ④ 影響を受けた／与えたジャンル（5つの四角）
保存('pnl4_influence', パネル切り出し('pnl4_influence.png', 90, 1500))

# ⑤ 修正依頼ボタン（パネル最下部）
保存('pnl5_correction', パネル切り出し('pnl5_correction.png', 1080, 1290))

# ⑥ Spotify検索結果（外部サイト。Top result のカードのみ、変な曲が並ぶ帯は避ける）
im6 = Image.open(os.path.join(出た, 'pnl6_spotify.png'))
保存('pnl6_spotify', im6.crop((0, 0, 1600, 700)), target_w=幅)

# ⑦ Amazon商品ページ（外部サイト。上のほう＝表紙・題名・価格のあたり）
im7 = Image.open(os.path.join(出た, 'pnl7_amazon.png'))
保存('pnl7_amazon', im7.crop((0, 0, 2100, 900)), target_w=幅)

print('\n完了。docs/img で見た目を確認すること。')
