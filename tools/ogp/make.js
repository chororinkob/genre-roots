// SNSで共有したときに出る画像（1200×630）を作る。
// 地図の実物を右へ寄せて、空いた左側に題名を置く。
const { chromium } = require('playwright');
// 手元のファイル（file://）から撮ると YouTube が動画を貸してくれず、
// 図にエラーが写り込む。公開しているURLから撮ること。
const 元 = 'https://genre-roots.com/genre_roots.html';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.route('**youtube.com/**', r => r.abort());
  await p.goto(元, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(14000);
  await p.evaluate(() => { twinkleActive = false; });   // きらめきを止める
  await p.waitForTimeout(7000);

  const 数 = await p.evaluate(() => NODES.length);

  await p.evaluate(数 => {
    // 画面の飾りを隠して、地図だけにする
    ['#header', '#left-sidebar', '#drawer-tab', '#side-panel', '#sidebar-overlay']
      .forEach(s => { const e = document.querySelector(s); if (e) e.style.display = 'none'; });
    // 地図を右へ寄せる。左に題名の置き場所を作るため
    const 図 = document.querySelector('svg');
    if (図) { 図.style.transform = 'translateX(322px) scale(0.95)';
              図.style.transformOrigin = 'center center'; }

    const 層 = document.createElement('div');
    層.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;'
      + 'font-family:"Hiragino Sans","Noto Sans JP",system-ui,sans-serif;';
    層.innerHTML = `
      <!-- 左をしっかり暗くして、字を置ける面を作る -->
      <div style="position:absolute;inset:0;background:
        linear-gradient(90deg, rgba(9,10,18,0.98) 0%, rgba(9,10,18,0.97) 40%,
                       rgba(9,10,18,0.72) 53%, rgba(9,10,18,0.16) 70%,
                       rgba(9,10,18,0) 84%);"></div>
      <!-- 上下をわずかに締める -->
      <div style="position:absolute;inset:0;background:
        linear-gradient(180deg, rgba(9,10,18,0.42) 0%, rgba(9,10,18,0) 26%,
                       rgba(9,10,18,0) 74%, rgba(9,10,18,0.55) 100%);"></div>

      <div style="position:absolute;left:66px;top:50%;transform:translateY(-50%);width:560px;">
        <div style="display:inline-block;font-size:17px;font-weight:700;letter-spacing:.15em;
          color:#ff6b85;padding:6px 18px;border-radius:999px;
          background:rgba(233,69,96,0.13);border:1px solid rgba(233,69,96,0.48);
          margin-bottom:20px;">MUSIC GENRE ROOTS</div>

        <div style="font-size:64px;font-weight:800;letter-spacing:-.015em;line-height:1.14;
          color:#f4f5ff;text-shadow:0 4px 26px rgba(0,0,0,.85);">
          音楽ジャンル<br>
          <span style="background:linear-gradient(96deg,#e94560 2%,#ff7a4d 32%,#c86bf0 68%,#5aa0ff 100%);
            -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
            filter:drop-shadow(0 0 20px rgba(233,69,96,.4));">ルーツ辞典</span>
        </div>

        <!-- サイトの見出しと同じ五線の飾り（ト音記号・調号・拍子記号つき）。
             線の間隔を10pxにして、絵の座標(間隔6)を 10/6 倍で描いている -->
        <div style="position:relative;height:50px;width:480px;margin:20px 0 0;
          -webkit-mask-image:linear-gradient(90deg,#000 0%,#000 40%,rgba(0,0,0,.4) 72%,transparent 100%);
                  mask-image:linear-gradient(90deg,#000 0%,#000 40%,rgba(0,0,0,.4) 72%,transparent 100%);">
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;gap:10px;">
            ${[0,1,2,3,4].map(i => `<i style="display:block;height:2px;opacity:${
              (i===0||i===4)?0.58:((i===1||i===3)?0.8:1)};background:linear-gradient(90deg,
              rgba(233,69,96,.92) 0%,rgba(255,138,92,.8) 34%,
              rgba(200,107,240,.7) 68%,rgba(120,170,255,.62) 100%);"></i>`).join('')}
          </div>
          <span style="position:absolute;left:47%;top:0;height:50px;width:2px;
            background:rgba(190,175,225,.42);"></span>
          <span style="position:absolute;left:70%;top:0;height:50px;width:2px;
            background:rgba(190,175,225,.42);"></span>
          <svg width="80" height="92" viewBox="0 32 40 46" fill="none"
            stroke-linecap="round" stroke-linejoin="round"
            style="position:absolute;left:2px;top:-15px;overflow:visible;
                   width:80px;height:92px;
                   filter:drop-shadow(0 0 9px rgba(233,69,96,.4));">
            <path d="M8,58 C4,57 2.5,60 4,62.5 C7,66.5 13.5,64.5 13.5,58 C13.5,52 9,48 7,43 C5.5,39 6.5,36 8.5,34.5" stroke="rgba(233,69,96,0.95)" stroke-width="2.2"/>
            <path d="M8.5,34.5 C10.5,33 12,34.5 12,37.5 C12,42 9.5,46.5 8.2,51 C6.8,56 6.4,62 7.2,67 C7.8,70.5 9.2,73 8.4,74.5 C7.6,76 5,75.4 4.2,73" stroke="rgba(233,69,96,0.95)" stroke-width="1.4"/>
            <path d="M19,41 L19,56 M19,49 C23,50 24.5,52.5 22.5,54.5 C21.5,55.5 20.2,56 19,56" stroke="rgba(255,138,92,0.92)" stroke-width="1.4"/>
            <text x="32" y="51.6" font-size="15" font-weight="700" text-anchor="middle" fill="rgba(200,150,255,0.85)" stroke="none">4</text>
            <text x="32" y="63.6" font-size="15" font-weight="700" text-anchor="middle" fill="rgba(200,150,255,0.85)" stroke="none">4</text>
          </svg>
        </div>

        <div style="margin-top:26px;font-size:26px;font-weight:600;color:#ccd2e6;
          text-shadow:0 2px 14px rgba(0,0,0,.9);">
          ${数}のジャンルを、つながりの地図でたどる
        </div>
        <div style="margin-top:10px;font-size:18px;color:#8a92b0;
          text-shadow:0 2px 10px rgba(0,0,0,.9);">
          ふらっと、音楽の旅に出る　／　代表曲はその場で聴ける
        </div>
      </div>`;
    document.body.appendChild(層);
  }, 数);
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'ogp.png' });
  console.log('作った（' + 数 + 'ジャンル）');
  await b.close();
})();
