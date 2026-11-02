# -*- coding: utf-8 -*-
"""panel_figs_all.js が _out_panel/ に撮った説明パネルの図を、横幅320pxの JPG にして docs/img を差し替える
（2026-11-03 新設）。320px は manual.html の .fig-panel の最大幅と同じ。
書き出したら _out_panel/ の PNG は消す（古い PNG が残って、次に別の図を上書きする事故を避けるため）。"""
from PIL import Image
from pathlib import Path

ここ = Path(__file__).resolve().parent
出た = ここ / '_out_panel'
置き場 = ここ.parent.parent / 'docs' / 'img'
for f in sorted(出た.glob('*.png')):
    im = Image.open(f).convert('RGB')
    im = im.resize((320, round(im.height * 320 / im.width)), Image.LANCZOS)
    im.save(置き場 / (f.stem + '.jpg'), quality=88)
    print('  %-18s → %s.jpg  %d×%d' % (f.name, f.stem, im.width, im.height))
    f.unlink()
