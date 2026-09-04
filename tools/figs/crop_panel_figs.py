# -*- coding: utf-8 -*-
"""panel_detail_figs.js / panel_detail_figs2.js / panel_gloss_only.js で
撮った生スクリーンショットから、説明パネルの部分だけを切り出して
docs/img に書き出す。

【2026-09-05に直したこと】
・パネルの実際の左端は物理px換算で2160（#side-panelをgetBoundingClientRectで
  実測）。前回2150にしていたわずかなズレより、もっと重大な事故が起きていた：
  fig04_gosenfu.png を撮り直すたびに jpgにする.py を流していて、それが
  _out/ に残ったままの「切り出す前の生の全画面スクリーンショット」
  （pnl1_top.png など）まで一緒に処理し、幅だけ合わせて上書きしてしまい、
  せっかく切り出したパネル画像が「地図＋パネルの全画面を無理やり縮めた
  もの」に化けていた。チョロさんに「ルーツマップが要らないのに全部
  縮小されて見えない」と指摘されて発覚。
・表示幅を .fig-panel（CSS側でmax-width:320px）に合わせて320pxで
  直接書き出すようにした（前回の760pxはCSSでどうせ320pxに縮められるため
  無駄に大きいファイルだった）。
・この事故を二度と起こさないよう、切り出しに使った生PNGは処理後に
  削除する（_out/に残さない）。
"""
from PIL import Image
import os

出た = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_out')
置き場 = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'img'))
幅 = 320  # .fig-panel の max-width と揃える

# パネルの実際の左端・右端（物理px。#side-panelをgetBoundingClientRectで実測、2026-09-05）
PANEL_L, PANEL_R = 2160, 2800

書いたpng = []

def 保存(名, im, target_w=幅):
    if im.size[0] != target_w:
        im = im.resize((target_w, round(im.size[1] * target_w / im.size[0])), Image.LANCZOS)
    先 = os.path.join(置き場, 名 + '.jpg')
    im.convert('RGB').save(先, quality=90, optimize=True)
    print('%-22s -> %s  %dx%d  %dKB' % (名, os.path.basename(先), im.size[0], im.size[1], os.path.getsize(先)//1024))

def パネル切り出し(ファイル名, y1, y2):
    元 = os.path.join(出た, ファイル名)
    書いたpng.append(元)
    im = Image.open(元)
    return im.crop((PANEL_L, y1, PANEL_R, y2))

# ① 上部：ジャンル名・知名度・別名・発祥時期・動画・代表曲
保存('pnl1_top', パネル切り出し('pnl1_top.png', 90, 1010))

# ⑥⑦ 音楽性・特徴（本文のみ／用語のふきだし）は、いずれもスクロールせず
# 最初の画面のまま下のほうを切り出す。スクロールすると、パネル上部の
# 固定ヘッダー（ジャンル名・知名度など）に、その下を流れていく本文が
# 透けて重なって見える不具合があるため（2026-09-05に発見）。
保存('pnl2a_desc', パネル切り出し('pnl1_top.png', 1030, 1650))
保存('pnl2b_gloss', パネル切り出し('pnl2b_gloss.png', 1030, 1650))

# ⑧ 成り立ち＋関連する書籍
保存('pnl3_roots_books', パネル切り出し('pnl3_roots_books.png', 90, 1170))

# ⑨ 影響を受けた／与えたジャンル（5つの四角）
保存('pnl4_influence', パネル切り出し('pnl4_influence.png', 90, 1500))

# いちばん下：修正依頼ボタン
保存('pnl5_correction', パネル切り出し('pnl5_correction.png', 1600, 1780))

# Amazon商品ページ（外部サイト。上のほう＝表紙・題名・価格のあたり）
im7先 = os.path.join(出た, 'pnl7_amazon.png')
書いたpng.append(im7先)
im7 = Image.open(im7先)
保存('pnl7_amazon', im7.crop((0, 0, 2100, 900)))

# 使い終わった生PNGを削除する。残しておくと、次に別の図（fig04など）を
# 撮り直したときに jpgにする.py が誤って一緒に処理し、この事故が
# また起きるため。
for f in set(書いたpng):
    if os.path.exists(f):
        os.remove(f)
        print('  （使用済みの生画像を削除: %s）' % os.path.basename(f))

print('\n完了。docs/img で見た目を必ず1枚ずつ目で確認すること。')
