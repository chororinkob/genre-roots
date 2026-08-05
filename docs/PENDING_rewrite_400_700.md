# 完了: 新基準(desc 400字/roots_story 700字)への書き直し

**2026年8月3日、全565件が基準を満たした状態になった。この作業は完了。**

- 全体の平均: desc 487字 / roots_story 853字
- 用語集: 6361語
- 最終バージョン: v26.06

## 経緯

2026-07-30 時点で 46件が新基準に未達だったため、来週以降へ持ち越していた。
2026-08-03 に 10件・10件・10件・6件の4回に分けて全件を書き直し、完了した。

書き直した46件:

opera, waltz, chicago_blues, piano_blues, harmonica_blues, jump_blues,
boogie_woogie, contemporary_blues, roots_reggae, rocksteady, honky_tonk,
dark_country, neofolk, singer_songwriter, indie_folk, euphoric_hardstyle,
hard_trap, acidcore, makina, power_noise, doomcore, lento_violento,
moombahcore, raggacore, hard_bass_genre, hardvapour, bouncy_techno,
melbourne_bounce, dubstyle, subground, jungle_terror, nu_style,
splittercore, ndh, dungeon_synth, gamelan, kuduro, marrabenta, morna,
coladeira, funana, punta, garifuna, kwela, taarab, deconstructed_club

## 今後の確認方法

基準を割ったジャンルが出ていないかは、いつでもこれで確認できる。

    node tools/check_quality.js          # 全件
    node tools/check_quality.js <ID...>  # 指定したジャンルだけ

「OK: すべての基準を満たしています」と出れば問題なし。
新しくジャンルを追加した場合や、本文を手で直した場合はこれを実行すること。

## この作業で追加・修正したツール

- `tools/apply_text.js` — desc / roots_story を差し替える専用ツール(新規)。
  `tools/text_entries.json` に `{"ジャンルID": {"desc": "…", "roots_story": "…"}}`
  の形で書いて実行する。改行コードや引用符の扱いで置換が空振りする事故を
  防ぐため、1件でも失敗したら書き込み自体を中止する。

- `tools/find_missing.js` — 数字を含む固有名詞(TB-303 など)が途中で切れて
  誤検出される問題を修正。登録済みのより長い語が本文にあれば漏れとしない。
