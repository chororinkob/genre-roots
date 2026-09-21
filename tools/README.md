# ジャンル別ページ 589個の追加・再生成ツール（初版 2026-09-22、最終更新 2026-09-22）

## これは何？
- `genre/` フォルダ：ジャンルごとの独立ページ（例: `genre/jazz.html`）
  - 各ページは Google 用の固有タイトル・説明文・canonical を持つ
  - 画面は今までの地図アプリそのもの（全画面表示・操作感も同一）
  - JavaScript無効環境向けに、ジャンル解説の全文がページ内テキストとして入っている
- `sitemap.xml`：`?genre=` URL から `/genre/xxx.html` URL への差し替え版（docs/changes.html は noindex のため除外）
- `tools/gen_stubs.js`：再生成スクリプト。ジャンルを追加・修正したら genre_roots.html を更新してから、
  リポジトリのどこからでも `node tools/gen_stubs.js` を実行すれば、genre/・sitemap.xml が
  **リポジトリ直下に直接**書き直される（2026-09-23〜。それより前の版は Genspark の作業環境の
  道が固定で書かれていて、ほかのPCでは動かなかった）

## 反映手順
1. `node tools/gen_stubs.js` を実行する（リポジトリ直下・tools/の中、どちらから実行してもよい）
2. `git status` で genre/・sitemap.xml の差分を確かめてから、いつも通りコミット＆push → Render が自動デプロイ
3. https://genre-roots.com/genre/jazz.html を開いて確認（タブ名が Jazz 専用になり、地図が開けばOK）
4. Search Console の「サイトマップ」で sitemap.xml を再送信（任意だが推奨）

## ロールバック
- `git revert <コミット番号>` で genre/ 追加前の状態に完全に戻る
- アプリ本体（genre_roots.html / index.html / docs/）はこのツールでは一切変更しない

## 今回やっていないこと（フェーズ2候補）
- 古い `genre_roots.html?genre=xxx` URL の canonical を新 URL に向ける1行修正（アプリ内JS）。
  やらないままでも Google は徐々に統合するが、やると統合が早くなる。様子を見てからでOK
