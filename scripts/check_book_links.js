// 書籍リンクの生存確認スクリプト。月1回の保守作業で使う。
// 使い方: node scripts/check_book_links.js
//   （genre_roots.html と同じ階層から実行する）
//
// genre_roots.html の全ジャンルの books[] からASINを集め、各商品ページに
// 実際にアクセスして状態を4段階に分類する。
//   ok          … 通常に購入でき、タイトルも一致している
//   unavailable … ページはあるが「現在お取り扱いできません」等で買えない
//                 （即座に切れているとは限らないので、2ヶ月連続で出たものだけ
//                   実際に差し替える運用にする。詳しくは
//                   docs/書籍リンク保守プロトコル.html を参照）
//   gone        … 商品ページ自体が存在しない（真性リンク切れ、即差し替え対象）
//   mismatch    … ページもタイトルもあるが、保存してあるタイトルと全く違う
//                 （存在しないASINでも404にならず無関係の商品にすり替わって
//                   返ってくることがあると実測で確認したため、この判定を追加。
//                   タイトルが一致しない＝ASINの登録ミスの可能性が高いので、
//                   unavailableと同様に即差し替え対象として扱う）
//
// 結果は check_book_links_result.json に書き出す。次回実行時に前回結果と
// 突き合わせられるよう、findings配列はジャンルIDとASINの対応も含む。

// タイトルの大まかな一致確認。日本語タイトルの表記ゆれ（記号・空白の有無等）を
// 吸収するため、記号を除いた上で、どちらかがどちらかの先頭8文字を含むかで判定する
// （完全一致は求めない。すり替わり＝全く別物、を検出できれば十分なため）。
function normalizeTitle(s) {
  return (s || '').replace(/[\s　!-/:-@[-`{-~！-／：-＠［-｀｛-～]/g, '');
}
function titlesResemble(expected, actual) {
  const e = normalizeTitle(expected);
  const a = normalizeTitle(actual);
  if (!e || !a) return false;
  const key = e.slice(0, 8);
  return key.length >= 3 && (a.includes(key) || e.includes(a.slice(0, 8)));
}

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const UNAVAILABLE_PATTERNS = [
  '現在お取り扱いできません',
  '一時的に在庫切れ',
  'この商品は現在ご利用いただけません',
];
const GONE_PATTERNS = [
  'お探しのページが見つかりません',
  '申し訳ございません',
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const htmlPath = 'file:///' + path.resolve('genre_roots.html').replace(/\\/g, '/');
  await page.goto(htmlPath, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);

  // ASIN -> [{genreId, genreLabel, title, pin}] の対応表を作る
  // （同じ本を複数ジャンルで使い回している場合、1回のチェックで全部わかる）
  const asinMap = await page.evaluate(() => {
    const m = {};
    NODES.forEach(n => {
      (n.books || []).forEach(b => {
        if (!b.asin) return;
        (m[b.asin] = m[b.asin] || []).push({
          genreId: n.id, genreLabel: n.label, title: b.title, pin: !!b.pin
        });
      });
    });
    return m;
  });

  const asins = Object.keys(asinMap);
  console.log('チェック対象ASIN数（重複除く）:', asins.length);

  const results = [];
  const checkPage = await browser.newPage();
  for (let i = 0; i < asins.length; i++) {
    const asin = asins[i];
    const url = 'https://www.amazon.co.jp/dp/' + asin;
    const expectedTitle = asinMap[asin][0].title;
    let status = 'ok';
    let note = '';
    try {
      const resp = await checkPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const bodyText = await checkPage.evaluate(() => document.body.innerText).catch(() => '');
      const httpStatus = resp ? resp.status() : 0;

      if (httpStatus === 404 || GONE_PATTERNS.some(p => bodyText.includes(p))) {
        status = 'gone';
      } else if (UNAVAILABLE_PATTERNS.some(p => bodyText.includes(p))) {
        status = 'unavailable';
      } else {
        const title = await checkPage.locator('#productTitle').textContent({ timeout: 5000 }).catch(() => null);
        if (!title) {
          status = 'unavailable'; note = 'タイトル要素が見つからず';
        } else if (!titlesResemble(expectedTitle, title)) {
          status = 'mismatch';
          note = '想定タイトル「' + expectedTitle + '」に対し、実際は「' + title.trim() + '」';
        }
      }
    } catch (e) {
      status = 'unavailable';
      note = 'アクセス失敗: ' + e.message;
    }

    if (status !== 'ok') {
      results.push({ asin, status, note, usedIn: asinMap[asin] });
      console.log('[' + status + ']', asin, '-', asinMap[asin].map(u => u.genreLabel + '「' + u.title + '」').join(', '));
    }

    if ((i + 1) % 20 === 0) console.log('  ...', i + 1, '/', asins.length, '件チェック済み');
  }

  const outPath = path.resolve('scripts/check_book_links_result.json');
  fs.writeFileSync(outPath, JSON.stringify({
    checkedAt: new Date().toISOString(),
    totalAsins: asins.length,
    problemCount: results.length,
    findings: results
  }, null, 2), 'utf8');

  console.log('---');
  console.log('チェック完了。問題あり:', results.length, '件 / 全', asins.length, '件');
  console.log('結果を書き出しました:', outPath);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
