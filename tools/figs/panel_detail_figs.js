// 説明パネルの中身を、項目ごとに詳しく撮る（2026-09-05 新設）。
// チョロさんから「説明パネルの見方がPC版でほぼ丸ごと抜けている」との
// 指摘を受け、1〜9（8.5含む）の各項目に図を付けるために作った。
const 設定 = require('./設定');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 設定.地図;
const 出力 = 設定.出力先;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await p.route('**://*.doubleclick.net/**', r => r.abort());
  await p.route('**://*.googlesyndication.com/**', r => r.abort());
  await p.route('**://*.googleadservices.com/**', r => r.abort());
  await p.route('**://*.google.com/pagead/**', r => r.abort());
  await p.route('**://*.youtube.com/api/stats/ads**', r => r.abort());
  await p.route('**://*.youtube.com/pagead/**', r => r.abort());
  await p.route('**://*.youtube.com/ptracking**', r => r.abort());
  await p.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(6000);
  await p.evaluate(() => {
    const n = [...document.querySelectorAll('.node')].find(e => (e.__data__ || {}).id === 'jazz');
    n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(12000);

  // ① パネル上部：ジャンル名・知名度・別名・発祥時期・動画・代表曲・Spotify
  await p.screenshot({ path: path.join(出力, 'pnl1_top.png') });
  console.log('→ pnl1_top.png（上部：名前・知名度・別名・発祥時期・動画・代表曲・Spotify）');

  // ② 音楽性・特徴（スクロールして表示）＋ 用語のふきだし
  await p.evaluate(() => {
    const el = document.getElementById('sp-desc-sec');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await p.waitForTimeout(500);
  // 用語のふきだしを1つ出す（説明文の中の最初の .gloss-term をクリックして固定表示）
  const glossOk = await p.evaluate(() => {
    const panel = document.getElementById('sp-desc');
    if (!panel) return false;
    const term = panel.querySelector('.gloss-term');
    if (!term) return false;
    term.click();
    return true;
  });
  await p.waitForTimeout(400);
  console.log('用語のふきだし表示:', glossOk);
  await p.screenshot({ path: path.join(出力, 'pnl2_desc_gloss.png') });
  console.log('→ pnl2_desc_gloss.png（音楽性・特徴＋用語のふきだし）');
  // ふきだしを閉じる（次のスクロールに影響しないように）
  await p.evaluate(() => document.body.click());
  await p.waitForTimeout(300);

  // ③ 成り立ち（ルーツ）＋ 関連する書籍
  await p.evaluate(() => {
    const el = document.getElementById('sp-books-wrap');
    const target = (el && el.style.display !== 'none') ? el : document.getElementById('sp-roots-story-sec');
    if (target) target.scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(出力, 'pnl3_roots_books.png') });
  console.log('→ pnl3_roots_books.png（成り立ち＋関連する書籍）');

  // ④ 影響を受けた／与えたジャンル（5つの四角＝影響Lv）
  await p.evaluate(() => {
    const el = document.getElementById('sp-in-sec') || document.getElementById('sp-influence-group');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(出力, 'pnl4_influence.png') });
  console.log('→ pnl4_influence.png（影響を受けた／与えたジャンル）');

  // ⑤ 修正依頼ボタン（パネルのいちばん下）
  await p.evaluate(() => {
    const el = document.getElementById('sp-correction-btn');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(出力, 'pnl5_correction.png') });
  console.log('→ pnl5_correction.png（修正依頼ボタン）');

  // ⑥ Spotifyの検索結果（別タブで開く先）
  const spotifyHref = await p.evaluate(() => document.getElementById('sp-spotify-link')?.href || '');
  console.log('Spotifyリンク先:', spotifyHref);
  if (spotifyHref) {
    const spPage = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    try {
      await spPage.goto(spotifyHref, { waitUntil: 'load', timeout: 30000 });
      await spPage.waitForTimeout(3500);
      await spPage.screenshot({ path: path.join(出力, 'pnl6_spotify.png') });
      console.log('→ pnl6_spotify.png（Spotify検索結果）');
    } catch (e) {
      console.log('  ★ Spotifyの画面が撮れませんでした:', e.message);
    }
    await spPage.close();
  }

  // ⑦ Amazonの商品ページ（書籍リンクの先）
  const amazonHref = await p.evaluate(() => {
    const a = document.querySelector('#sp-books-row a.sp-book-card');
    return a ? a.href : '';
  });
  console.log('Amazonリンク先:', amazonHref);
  if (amazonHref) {
    const azPage = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
    try {
      await azPage.goto(amazonHref, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await azPage.waitForTimeout(3500);
      await azPage.screenshot({ path: path.join(出力, 'pnl7_amazon.png') });
      console.log('→ pnl7_amazon.png（Amazonの商品ページ）');
    } catch (e) {
      console.log('  ★ Amazonの画面が撮れませんでした:', e.message);
    }
    await azPage.close();
  }

  await p.close();
  await b.close();
})();
