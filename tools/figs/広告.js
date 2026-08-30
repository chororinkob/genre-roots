// YouTube の広告を飛ばす。
//
// 【なぜ要るか】説明パネルの動画は、広告から始まることがある。
// 図の中で広告が流れていると「よく広告が出るツール」に見えてしまう。
// 2026-08-31 に fig07 で実際に広告が写り込んだ。
//
// 【通信を止める手は効かない】広告も YouTube 自身の住所から来るので、
// doubleclick などを止めても防げない（試して効かなかった）。
// 動画の枠の中を見て、広告中なら「スキップ」を押し、終わるまで待つ。
//
// 動画が写る図（fig04・fig07）では、撮る直前に必ずこれを呼ぶこと。

async function 広告を飛ばす(p, 回数 = 25) {
  for (let i = 0; i < 回数; i++) {
    const f = p.frames().find(x => /youtube\.com\/embed/.test(x.url()));
    if (!f) { await p.waitForTimeout(1000); continue; }
    const 広告中 = await f.evaluate(() =>
      !!document.querySelector('.ad-showing, .ytp-ad-player-overlay, .ytp-ad-player-overlay-layout')
    ).catch(() => false);
    if (!広告中) {
      console.log('  広告なし（' + i + '回目で確認）');
      await p.waitForTimeout(2500);   // 本編が映るまで少し待つ
      return true;
    }
    await f.click('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button',
                  { timeout: 1200 }).catch(() => {});
    await p.waitForTimeout(1500);
  }
  console.log('  ★広告が消えませんでした。撮り直してください');
  return false;
}

module.exports = { 広告を飛ばす };
