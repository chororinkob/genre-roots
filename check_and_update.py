#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""毎月1日、動画のリンク切れを直す。

【何をするか】
全ジャンルのメイン動画（yt_mix）と代表曲の動画（yt_tracks）が
まだ生きているかをYouTubeに確かめ、消えていたものを手当てする。

【どう手当てするか（2026-09-12にチョロさんが決めた規則）】
  ■ 代表曲の動画
    1. 本命が消えた → 予備に繰り上げる
    2. 予備だけ消えた → 予備の欄を空ける（本命はそのまま）
    3. 両方消えた   → その代表曲を曲名ごと消す
  ■ メイン動画
    4. 1本目が消えた → 2本目に繰り上げる
    5. 両方消えた     → 生き残っている代表曲の動画のうち、
                        再生回数が一番多いものに入れ替える

【YouTubeで新しい動画を探すことは、絶対にしない】
以前はここで「{ジャンル名} best mix」と検索して、出てきた一番上を
そのまま入れていた。これは新規登録の側では一度やって失敗してやめた
やり方で、雅楽に「Japan HipHop mix」、セリアリズムに十二音技法の
解説動画が入る事故が起きている。ミックス動画はYouTube側が雑で、
再生数稼ぎの別物しか無いことが多い。
この処理が使ってよいのは、**すでにこの辞典に登録されていて、
中身の照合を通った動画だけ**（2026-09-12、チョロさんの指示）。

【代表曲を曲名ごと消す理由】
動画が無い代表曲を曲名だけ残すと、押されたときに曲名でYouTubeを
検索して一番上を自動再生する作りになっている。そこでは演奏者も
公式かどうかも照合していないため、まったく別の動画が流れうる。
それなら曲ごと消すほうが安全、という判断（2026-09-12）。

【AIは使わない】
生死の確認はYouTubeのoEmbed（鍵不要・無料）。再生回数はyt-dlp。
どちらもAIではない。

【記録の残し方】
直したものは fallback_report.json に書き出す。
  ・一般公開の「更新の記録」（docs/changes.html）… コミットの題名から作られる
  ・管理画面の通知 … サーバーがこのファイルを読んで出す

使い方:
    python check_and_update.py [対象のHTML] [記録の出力先]
どちらも省略できる（既定は genre_roots.html と fallback_report.json）。
"""
import sys, re, json, subprocess, time, urllib.request, urllib.error
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HTML_PATH   = sys.argv[1] if len(sys.argv) > 1 else "genre_roots.html"
REPORT_PATH = sys.argv[2] if len(sys.argv) > 2 else "fallback_report.json"
SLEEP_SEC   = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0


# ──────────────────────────────────────────────────────────────
# YouTubeへの問い合わせ（AIは使わない）
# ──────────────────────────────────────────────────────────────
def 生きているか(vid):
    """その動画がまだ見られるか。鍵の要らない無料の窓口で確かめる。"""
    if not vid:
        return False
    url = ("https://www.youtube.com/oembed?url="
           "https://www.youtube.com/watch?v=%s&format=json" % vid)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return e.code == 200
    except Exception:
        return False


def 再生回数(vid):
    """再生回数を取る。取れなければ -1。

    YouTubeの正式な窓口（鍵が要る）ではなく yt-dlp を使うのは、
    この処理がGitHubの上で動いており、鍵を預けなくて済むため。
    """
    if not vid:
        return -1
    try:
        r = subprocess.run(
            ['python', '-m', 'yt_dlp',
             'https://www.youtube.com/watch?v=' + vid,
             '--print', 'view_count', '--no-download', '--quiet', '--no-warnings'],
            capture_output=True, text=True, encoding='utf-8',
            errors='replace', timeout=30)
        s = (r.stdout or '').strip().split('\n')[0].strip()
        return int(s) if s.isdigit() else -1
    except Exception:
        return -1


# ──────────────────────────────────────────────────────────────
# データの読み書き
# ──────────────────────────────────────────────────────────────
def 括弧の終わり(text, start):
    """text[start] が '[' のとき、対応する ']' の位置を返す。"""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '[':
            depth += 1
        elif text[i] == ']':
            depth -= 1
            if depth == 0:
                return i
    return -1


def 配列を取る(chunk, 名前):
    """chunk の中の 名前:[...] を (中身, 開始, 終了) で返す。無ければ None。"""
    key = 名前 + ':['
    p = chunk.find(key)
    if p < 0:
        return None
    b = chunk.find('[', p)
    e = 括弧の終わり(chunk, b)
    if e < 0:
        return None
    try:
        return json.loads(chunk[b:e + 1]), p, e
    except Exception:
        return None


def 手当てする(chunk, gid, 覚え):
    """1ジャンルぶんの手当て。(直した後のchunk, 直した内容) を返す。

    覚え … 動画IDごとの生死を覚えておく辞書。同じ動画が
            メインと代表曲の両方に入っていることが多く、
            二度問い合わせるのが無駄なため。
    """
    def 生死(vid):
        if vid not in 覚え:
            覚え[vid] = 生きているか(vid)
            time.sleep(SLEEP_SEC)
        return 覚え[vid]

    label_m = re.search(r'label:"([^"]+)"', chunk)
    label = label_m.group(1).replace('\\n', ' ') if label_m else gid
    直した = []

    rep = 配列を取る(chunk, 'rep_tracks')
    trk = 配列を取る(chunk, 'yt_tracks')
    mix = 配列を取る(chunk, 'yt_mix')

    # ── 代表曲の動画 ────────────────────────────────
    消す番号 = []
    if trk:
        tracks, _, _ = trk
        rep_names = rep[0] if rep else []
        for i, 組 in enumerate(tracks):
            曲名 = rep_names[i] if i < len(rep_names) else '(曲名不明)'
            本命 = 組[0] if len(組) > 0 else ''
            予備 = 組[1] if len(組) > 1 else ''
            本命生 = 生死(本命) if 本命 else False
            予備生 = 生死(予備) if 予備 else False

            if 本命 and not 本命生 and 予備 and 予備生:
                # 規則1：本命が消えた → 予備に繰り上げる
                tracks[i] = [予備]
                直した.append({'種類': '代表曲の繰り上げ', 'ジャンル': label,
                             'id': gid, '曲名': 曲名,
                             '消えた動画': 本命, '新しい動画': 予備})
            elif 本命 and 本命生 and 予備 and not 予備生:
                # 規則2：予備だけ消えた → 予備の欄を空ける
                tracks[i] = [本命]
                直した.append({'種類': '予備の削除', 'ジャンル': label,
                             'id': gid, '曲名': 曲名, '消えた動画': 予備})
            elif 本命 and not 本命生 and (not 予備 or not 予備生):
                # 規則3：両方消えた → 曲名ごと消す
                消す番号.append(i)
                直した.append({'種類': '代表曲の削除', 'ジャンル': label,
                             'id': gid, '曲名': 曲名,
                             '消えた動画': ', '.join(x for x in (本命, 予備) if x)})

        for i in reversed(消す番号):
            if i < len(tracks):
                del tracks[i]
            if rep and i < len(rep[0]):
                del rep[0][i]

    # ── メイン動画 ──────────────────────────────────
    if mix:
        mixes, _, _ = mix
        生きている = [v for v in mixes if v and 生死(v)]
        消えた = [v for v in mixes if v and not 生死(v)]
        if 消えた:
            if 生きている:
                # 規則4：1本でも生きていれば、それに繰り上げる
                mix[0][:] = 生きている
                直した.append({'種類': 'メイン動画の繰り上げ', 'ジャンル': label,
                             'id': gid, '曲名': '',
                             '消えた動画': ', '.join(消えた),
                             '新しい動画': ', '.join(生きている)})
            else:
                # 規則5：全部消えた → 生き残った代表曲の動画から、
                #        再生回数が一番多いものを持ってくる
                候補 = []
                if trk:
                    for 組 in trk[0]:
                        for v in 組:
                            if v and 生死(v):
                                候補.append(v)
                if 候補:
                    最多 = max(候補, key=再生回数)
                    mix[0][:] = [最多]
                    直した.append({'種類': 'メイン動画の入れ替え', 'ジャンル': label,
                                 'id': gid, '曲名': '',
                                 '消えた動画': ', '.join(消えた), '新しい動画': 最多})
                else:
                    mix[0][:] = []
                    直した.append({'種類': 'メイン動画が空になった', 'ジャンル': label,
                                 'id': gid, '曲名': '',
                                 '消えた動画': ', '.join(消えた), '新しい動画': ''})

    if not 直した:
        return chunk, []

    # 書き戻す。
    #
    # 【必ず後ろから差し替えること】2026-09-12
    # 前から差し替えると、長さが変わったぶんだけ後ろの項目の位置がずれ、
    # 次の差し替えが1文字ずれた場所に書き込まれて地図が壊れる。
    # 並び順は決め打ちにできない。実物は rep_tracks → yt_mix → yt_tracks の
    # 順に並んでおり、「yt_mix が最後」と決め打ちしていたために
    # 地図がJSとして読めなくなる不具合を出した（テストで発覚）。
    # 位置の大きいものから順に差し替える。
    書き戻す = [(名前, 取れた) for 名前, 取れた in
                (('yt_mix', mix), ('yt_tracks', trk), ('rep_tracks', rep)) if 取れた]
    書き戻す.sort(key=lambda x: x[1][1], reverse=True)
    for 名前, (中身, p, e) in 書き戻す:
        chunk = chunk[:p] + 名前 + ':' + json.dumps(中身, ensure_ascii=False) + chunk[e + 1:]
    return chunk, 直した


# ──────────────────────────────────────────────────────────────
# 本体
# ──────────────────────────────────────────────────────────────
def 実行(html):
    """HTMLの文字列を受け取り、(直した後のHTML, 直した内容の一覧) を返す。"""
    nodes_start = html.find('const NODES')
    links_start = html.find('const LINKS', nodes_start)
    if nodes_start < 0 or links_start < 0:
        raise ValueError('NODES / LINKS が見つかりません')
    nodes_text = html[nodes_start:links_start]

    覚え = {}
    差し替え = []
    全部 = []
    for m in re.finditer(r'\{id:"([^"]+)"', nodes_text):
        gid = m.group(1)
        pos = m.start()
        nxt = nodes_text.find('{id:', pos + 4)
        chunk = nodes_text[pos: nxt if nxt > 0 else len(nodes_text)]
        新, 直した = 手当てする(chunk, gid, 覚え)
        if 直した:
            差し替え.append((chunk, 新))
            全部.extend(直した)
            for x in 直した:
                print('  %s: %s %s' % (x['ジャンル'], x['種類'], x.get('曲名', '')))

    for 旧, 新 in 差し替え:
        nodes_text = nodes_text.replace(旧, 新, 1)
    return html[:nodes_start] + nodes_text + html[links_start:], 全部


def 題名を作る(直した):
    """コミットの題名。一般公開の「更新の記録」がこの書き方を見て
    『動画の入れ替え』に分類する（tools/changes/build.py）。
    書き方を変えると記録に載らなくなるので注意。"""
    数 = {}
    for x in 直した:
        数[x['種類']] = 数.get(x['種類'], 0) + 1
    中身 = '・'.join('%s%d件' % (k, v) for k, v in 数.items())
    今日 = datetime.now()
    return 'feat: %s を追加 (%d年%d月%d日)' % (中身, 今日.year, 今日.month, 今日.day)


if __name__ == '__main__':
    print('=== 毎月のリンク切れ確認 ===\n')
    with open(HTML_PATH, encoding='utf-8') as f:
        元 = f.read()

    新html, 直した = 実行(元)

    記録 = {
        '実行日': datetime.now().strftime('%Y-%m-%d %H:%M'),
        '件数': len(直した),
        '内容': 直した,
        'コミットの題名': 題名を作る(直した) if 直した else '',
    }
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(記録, f, ensure_ascii=False, indent=2)

    print('\n直した件数: %d件' % len(直した))
    if 直した:
        with open(HTML_PATH, 'w', encoding='utf-8') as f:
            f.write(新html)
        print('✓ %s を更新しました' % HTML_PATH)
        print('✓ コミットの題名: %s' % 記録['コミットの題名'])
    else:
        print('✓ 変更なし（全部生きていました）')
    sys.exit(0)
