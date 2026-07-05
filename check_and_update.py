"""
月次YouTubeリンク検証・自動更新スクリプト
GitHub Actionsから毎月1日に実行される

動作:
1. genre_roots.html 内の全 yt_mix / yt_tracks IDを抽出
2. YouTube oembed API で生死確認（APIキー不要・高速）
3. 死亡IDをyt-dlpで差し替え
4. HTMLを更新して保存
5. 変更があった場合は終了コード0を返し、GitHub Actionsがcommit/push
"""
import sys, re, json, subprocess, time, urllib.request, urllib.error
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HTML_PATH = "genre_roots.html"
SLEEP_SEC = 1.0

def is_video_alive(vid_id):
    """oembed APIで動画の生死確認（APIキー不要）"""
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
    """yt-dlpで代替動画を検索（2件取得）"""
    try:
        result = subprocess.run(
            ['python', '-m', 'yt_dlp',
             f'ytsearch2:{query}',
             '--print', 'id',
             '--no-download', '--quiet', '--no-warnings'],
            capture_output=True, text=True, encoding='utf-8', errors='replace',
            timeout=30
        )
        ids = [ln.strip() for ln in result.stdout.strip().split('\n') if ln.strip()]
        return ids[:2]
    except Exception:
        return []

# ─── HTML読み込み ───
with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# ─── 全IDを抽出してチェック ───
print("=== 月次 YouTube リンクチェック ===")
print()

# yt_mix と yt_tracks の全IDを収集
nodes_start = html.find('const NODES = [')
links_start = html.find('const LINKS', nodes_start)
nodes_text  = html[nodes_start:links_start]

dead_count   = 0
update_count = 0
checked      = 0

# 各ジャンルのIDをチェック・必要なら差し替え
for m in re.finditer(r'\{id:"([^"]+)"', nodes_text):
    gid = m.group(1)
    pos = m.start()
    nxt = nodes_text.find('{id:', pos + 4)
    chunk = nodes_text[pos: nxt if nxt > 0 else len(nodes_text)]

    changed = False

    # yt_mix チェック
    mix_match = re.search(r'yt_mix:(\[[^\]]*\])', chunk)
    if mix_match:
        mix_ids = json.loads(mix_match.group(1))
        for j, vid in enumerate(mix_ids):
            checked += 1
            if vid and not is_video_alive(vid):
                dead_count += 1
                print(f"✗ {gid} mix[{j}] 死亡: {vid}")
                # ラベルを取得して再検索
                lbl_m = re.search(r'label:"([^"]+)"', chunk)
                label = lbl_m.group(1).replace('\n', ' ') if lbl_m else gid
                new_ids = search_replacement(f"{label} best mix")
                if new_ids:
                    mix_ids[j] = new_ids[0]
                    print(f"  → 差し替え: {new_ids[0]}")
                    changed = True
                time.sleep(SLEEP_SEC)

    # yt_tracks チェック
    tracks_match = re.search(r'yt_tracks:(\[(?:\[[^\]]*\],?\s*)*\])', chunk)
    if tracks_match:
        tracks_ids = json.loads(tracks_match.group(1))
        # rep_tracksのラベルを取得
        rt_match = re.search(r'rep_tracks:\[([^\]]*)\]', chunk)
        rep_names = re.findall(r'"((?:[^"\\]|\\.)*)"', rt_match.group(1)) if rt_match else []

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
                        changed = True
                    time.sleep(SLEEP_SEC)

    # HTMLに変更を反映
    if changed:
        new_chunk = chunk
        if mix_match:
            new_chunk = new_chunk[:mix_match.start(1)] + json.dumps(mix_ids) + new_chunk[mix_match.end(1):]
        if tracks_match:
            new_chunk = new_chunk[:tracks_match.start(1)] + json.dumps(tracks_ids) + new_chunk[tracks_match.end(1):]
        # nodes_text内のchunkを置換
        nodes_text = nodes_text[:pos] + new_chunk + nodes_text[pos + len(chunk):]
        update_count += 1

# nodes_textをHTMLに戻す
html = html[:nodes_start] + nodes_text + html[nodes_start + len(nodes_text):]

print()
print(f"確認: {checked}件 | 死亡: {dead_count}件 | 更新: {update_count}ジャンル")

if update_count > 0:
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✓ {HTML_PATH} を更新しました")
else:
    print("✓ 変更なし（全リンク正常）")

# GitHub Actionsが変更を検知するためのexit code
sys.exit(0)
