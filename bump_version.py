"""
genre_roots.html のバージョン番号と最終更新日を自動インクリメントするスクリプト
GitHub Actions から push 時に実行される。

genre_adder.py側（ジャンル追加・修正依頼の承認）は、pushする前に自分自身で
既にバージョンを1つ上げている。このスクリプトがそれに気づかず無条件にもう
1つ上げてしまうと、1回の承認につきgenre_roots.htmlへのpushが2回発生し、
GitHub Pagesのデプロイ待ち行列を無駄に2倍に増やしてしまう（1回のデプロイに
数十分かかることもあり、行列が伸びるほど反映の確認待ちが長引く）。
そのため、直前のコミット時点のバージョンと比較し、既にバージョンが
上がっている場合はここでの二重の更新をスキップする。
（動画差し替えバッチ等、まだ自前でバージョンを上げていない他の経路のための
保険としては、このスクリプト自体は残す。）
"""
import re
import subprocess
import sys
from datetime import datetime

HTML_PATH = "genre_roots.html"

with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()


def _extract_version(text):
    m = re.search(r'<span id="version-info">v(\d+)\.(\d+)', text)
    return (int(m.group(1)), int(m.group(2))) if m else None


current_version = _extract_version(html)
try:
    prev_html = subprocess.run(
        ["git", "show", "HEAD~1:genre_roots.html"],
        capture_output=True, encoding="utf-8", check=True,
    ).stdout
    prev_version = _extract_version(prev_html)
except subprocess.CalledProcessError as e:
    # HEAD~1が取得できない場合（浅いクローンでfetch-depthが足りない等）、
    # 比較できないまま無条件にバージョンを上げてしまうと二重更新防止が
    # 効かなくなるため、原因が分かるように警告を残しておく。
    print(f"警告: HEAD~1のgenre_roots.htmlを取得できませんでした"
          f"（fetch-depthが足りない可能性があります）: {e}", file=sys.stderr)
    prev_version = None

if prev_version and current_version and current_version > prev_version:
    print(f"バージョンは既に更新済みです（v{prev_version[0]}.{prev_version[1]} → "
          f"v{current_version[0]}.{current_version[1]}）。二重更新を避けるためスキップします。")
    sys.exit(0)

# ── バージョン番号インクリメント (v23.25 → v23.26。小数点以下が99を超える
# 場合は繰り上げて v23.99 → v24.0 とする。2026-07-22、繰り上げ処理が
# 存在しなかったせいで小数点以下が3桁(v24.100〜)まで伸びてしまったため
# 追加。過去分はv25.67として手動で補正済み） ──────────────────────
ver_match = re.search(r'<span id="version-info">v(\d+)\.(\d+)', html)
if not ver_match:
    print("ERROR: バージョン番号が見つかりません", file=sys.stderr)
    sys.exit(1)

major = int(ver_match.group(1))
minor = int(ver_match.group(2))
new_minor = minor + 1
new_major = major
if new_minor > 99:
    new_major = major + 1
    new_minor = 0
old_ver_str = f"v{major}.{minor}"
new_ver_str = f"v{new_major}.{new_minor}"

html = html.replace(
    f'<span id="version-info">{old_ver_str}',
    f'<span id="version-info">{new_ver_str}',
    1
)

# ── LAST_UPDATED を今日の日付に更新 ─────────────────────────────────────
d = datetime.now()
today = f"{d.year}年{d.month}月{d.day}日"

html = re.sub(
    r'const LAST_UPDATED = "[^"]*";',
    f'const LAST_UPDATED = "{today}";',
    html,
    count=1
)

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print(f"✓ {old_ver_str} → {new_ver_str}  /  最終更新日: {today}")
