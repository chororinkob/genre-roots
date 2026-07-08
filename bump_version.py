"""
genre_roots.html のバージョン番号と最終更新日を自動インクリメントするスクリプト
GitHub Actions から push 時に実行される
"""
import re
import sys
from datetime import datetime

HTML_PATH = "genre_roots.html"

with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# ── バージョン番号インクリメント (v23.25 → v23.26) ──────────────────────
ver_match = re.search(r'<span id="version-info">v(\d+)\.(\d+)', html)
if not ver_match:
    print("ERROR: バージョン番号が見つかりません", file=sys.stderr)
    sys.exit(1)

major = int(ver_match.group(1))
minor = int(ver_match.group(2))
new_minor = minor + 1
old_ver_str = f"v{major}.{minor}"
new_ver_str = f"v{major}.{new_minor}"

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
