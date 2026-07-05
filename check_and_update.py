"""
月次YouTubeリンク検証・自動更新スクリプト
GitHub Actionsから毎月1日に実行される

動作:
1. genre_roots.html 内の全 yt_mix / yt_tracks IDを抽出
2. YouTube oembed API で生死確認（APIキー不要）
3. 死亡IDをyt-dlpで差し替え
4. HTMLを更新して保存
"""
import sys, re, json, subprocess, time, urllib.request, urllib.error
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HTML_PATH = "genre_roots.html"
SLEEP_SEC = 1.0

def is_video_alive(vid_id):
    if not vid_id:
        return False
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid_id}&format=json"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return e.code == 200
    except Exception:
        return False

def search_replacement(query):
    try:
        result = subprocess.run(
            ['python', '-m', 'yt_dlp', f'ytsearch2:{query}',
             '--print', 'id', '--no-download', '--quiet', '--no-warnings'],
            capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30
        )
        ids = [ln.strip() for ln in result.stdout.strip().split('\n') if ln.strip()]
        return ids[:2]
    except Exception:
        return []

def find_bracket_end(text, start):
    """text[start]が'['であることを前提に、対応する']'の位置を返す"""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '[': depth += 1
        elif text[i] == ']':
            depth -= 1
            if depth == 0:
                return i
    return -1

with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

nodes_start = html.find('const NODES = [')
links_start = html.find('const LINKS', nodes_start)
nodes_text  = html[nodes_start:links_start]  # 元のnodes_textを保持

dead_count   = 0
update_count = 0
checked      = 0
replacements = []  # (old_chunk, new_chunk) のリストを後でまとめて適用

print("=== 月次 YouTube リンクチェック ===\n")

for m in re.finditer(r'\{id:"([^"]+)"', nodes_text):
    gid = m.group(1)
    pos = m.start()
    nxt = nodes_text.find('{id:', pos + 4)
    # ─ 元のnodes_textから読む（ループ中は書き換えない）
    chunk = nodes_text[pos: nxt if nxt > 0 else len(nodes_text)]

    changed  = False
    new_chunk = chunk

    # ─ yt_mix チェック ─────────────────────────────
    mix_match = re.search(r'yt_mix:(\[[^\]]*\])', new_chunk)
    if mix_match:
        try:
            mix_ids = json.loads(mix_match.group(1))
        except Exception:
            mix_ids = []
        mix_changed = False
        for j, vid in enumerate(mix_ids):
            checked += 1
            if vid and not is_video_alive(vid):
                dead_count += 1
                lbl_m = re.search(r'label:"([^"]+)"', new_chunk)
                label = lbl_m.group(1).replace('\n', ' ') if lbl_m else gid
                print(f"✗ {gid} mix[{j}] 死亡: {vid}")
                new_ids = search_replacement(f"{label} best mix")
                if new_ids:
                    mix_ids[j] = new_ids[0]
                    print(f"  → 差し替え: {new_ids[0]}")
                    mix_changed = True
                time.sleep(SLEEP_SEC)
        if mix_changed:
            old_str = mix_match.group(0)          # yt_mix:[...] 元の文字列
            new_str = 'yt_mix:' + json.dumps(mix_ids, ensure_ascii=False)
            new_chunk = new_chunk.replace(old_str, new_str, 1)
            changed = True

    # ─ yt_tracks チェック ────────────────────────────
    tp = new_chunk.find('yt_tracks:[')
    if tp != -1:
        b = new_chunk.find('[', tp)
        end = find_bracket_end(new_chunk, b)
        if end != -1:
            tracks_str = new_chunk[b:end+1]
            try:
                tracks_ids = json.loads(tracks_str)
            except Exception:
                tracks_ids = []
            rt_match = re.search(r'rep_tracks:\[', new_chunk)
            rep_names = []
            if rt_match:
                rb = new_chunk.find('[', rt_match.start())
                re_ = find_bracket_end(new_chunk, rb)
                if re_ != -1:
                    rt_content = new_chunk[rb+1:re_]
                    rep_names = [x.strip().strip('"') for x in rt_content.split('","') if x.strip()]

            tracks_changed = False
            for ti, pair in enumerate(tracks_ids):
                for j, vid in enumerate(pair):
                    checked += 1
                    if vid and not is_video_alive(vid):
                        dead_count += 1
                        query = rep_names[ti] if ti < len(rep_names) else gid
                        print(f"✗ {gid} track[{ti}][{j}] 死亡: {vid} ({query[:40]})")
                        new_ids = search_replacement(query)
                        if new_ids:
                            tracks_ids[ti][j] = new_ids[0]
                            print(f"  → 差し替え: {new_ids[0]}")
                            tracks_changed = True
                        time.sleep(SLEEP_SEC)

            if tracks_changed:
                old_str  = new_chunk[tp: end+1]   # yt_tracks:[...] 元の文字列
                new_str  = 'yt_tracks:' + json.dumps(tracks_ids, ensure_ascii=False)
                new_chunk = new_chunk.replace(old_str, new_str, 1)
                changed   = True

    if changed:
        replacements.append((chunk, new_chunk))
        update_count += 1

# ─ まとめて元のnodes_textに反映（位置ズレを防ぐ）─
for old, new in replacements:
    nodes_text = nodes_text.replace(old, new, 1)

# ─ htmlに戻す（links_startで正確に切り出す）─
html = html[:nodes_start] + nodes_text + html[links_start:]

print(f"\n確認: {checked}件 | 死亡: {dead_count}件 | 更新: {update_count}ジャンル")

if update_count > 0:
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✓ {HTML_PATH} を更新しました")
else:
    print("✓ 変更なし（全リンク正常）")

sys.exit(0)
