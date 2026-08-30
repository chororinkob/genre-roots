# -*- coding: utf-8 -*-
"""_out/ に撮れた PNG を、docs/img/ の JPG に書き出す。

【大きさの決め方】いま docs/img にある同じ名前の JPG の横幅に合わせる。
表を持って管理すると、必ずどこかで食い違う。すでにある図の横幅を
そのまま使えば、図ごとの大きさが勝手に変わることがない。

【同じ名前の JPG が無い場合】新しい図なので、横幅の決めようがない。
そのまま書き出さずに知らせる（気づかないまま変な大きさで入るより良い）。
"""
import io, os, sys
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ここ = os.path.dirname(os.path.abspath(__file__))
出た = os.path.join(ここ, '_out')
図の置き場 = os.path.abspath(os.path.join(ここ, '..', '..', 'docs', 'img'))
品質 = 88

if not os.path.isdir(出た):
    print('_out/ がありません。先に撮影を流してください。')
    sys.exit(1)

書いた = 見送り = 0
for 名 in sorted(os.listdir(出た)):
    if not 名.lower().endswith('.png'):
        continue
    # 「_raw」で終わるものは、注釈を入れる前の下書き。図そのものではないので飛ばす。
    if 名.lower().endswith('_raw.png'):
        continue
    元 = os.path.join(出た, 名)
    先 = os.path.join(図の置き場, 名[:-4] + '.jpg')
    im = Image.open(元).convert('RGB')
    if os.path.exists(先):
        幅 = Image.open(先).size[0]
    else:
        print('  ★ %s … 同じ名前の図が docs/img にありません。'
              '横幅が決められないので書き出しません' % 名)
        見送り += 1
        continue
    if im.size[0] != 幅:
        im = im.resize((幅, round(im.size[1] * 幅 / im.size[0])), Image.LANCZOS)
    im.save(先, quality=品質, optimize=True)
    print('  %-26s → %s  %d×%d  %dKB'
          % (名, os.path.basename(先), im.size[0], im.size[1],
             os.path.getsize(先) // 1024))
    書いた += 1

print('\n書き出した %d枚 ／ 見送り %d枚' % (書いた, 見送り))
if 見送り:
    sys.exit(1)
