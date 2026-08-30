// 図に矢印と枠と札を重ねるための道具。
// パソコン版の図と同じ見た目（黄色い枠・黄色い札・黄色い矢印）にそろえる。
const 仕込む = async p => p.evaluate(() => {
  if (window.__注) return;
  const 層 = document.createElement('div');
  層.id = '__chuu';
  層.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;');
  層.appendChild(svg);
  document.body.appendChild(層);

  const 位置 = 的 => {
    if (typeof 的 === 'string') {
      const el = document.querySelector(的);
      if (!el) throw new Error('見つからない: ' + 的);
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return 的;
  };

  window.__注 = {
    // 対象を黄色い枠で囲む
    枠(的, ふち = 5, 色 = '#ffc93c') {
      const r = 位置(的);
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${r.x - ふち}px;top:${r.y - ふち}px;`
        + `width:${r.w + ふち * 2}px;height:${r.h + ふち * 2}px;`
        + `border:2.5px solid ${色};border-radius:9px;box-shadow:0 0 10px ${色}88;`;
      層.appendChild(d);
      return r;
    },
    // 説明の札。x,y は左上。幅を決めると折り返す
    札(x, y, 文, o = {}) {
      const 色 = o.色 === '青' ? '#1565C0' : '#ffc93c';
      const 字 = o.色 === '青' ? '#ffffff' : '#1a1a22';
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${x}px;top:${y}px;`
        + (o.幅 ? `width:${o.幅}px;` : 'white-space:nowrap;')
        + `background:${色};color:${字};border-radius:9px;padding:8px 11px;`
        + `font:700 ${o.字 || 12.5}px/1.5 "Hiragino Sans","Noto Sans JP",system-ui,sans-serif;`
        + `box-shadow:0 3px 12px rgba(0,0,0,.55);`;
      d.textContent = 文;
      層.appendChild(d);
      const r = d.getBoundingClientRect();
      return { x, y, w: r.width, h: r.height };
    },
    // 矢印。札のふちから的へ引く
    矢(x1, y1, x2, y2, 色 = '#ffc93c') {
      const ns = 'http://www.w3.org/2000/svg';
      const 線 = document.createElementNS(ns, 'line');
      // 先端の三角のぶんだけ手前で止める
      const dx = x2 - x1, dy = y2 - y1, 長 = Math.hypot(dx, dy) || 1;
      const 止 = 9;
      線.setAttribute('x1', x1); 線.setAttribute('y1', y1);
      線.setAttribute('x2', x2 - dx / 長 * 止); 線.setAttribute('y2', y2 - dy / 長 * 止);
      線.setAttribute('stroke', 色); 線.setAttribute('stroke-width', 3.4);
      線.setAttribute('stroke-linecap', 'round');
      svg.appendChild(線);
      const 角 = Math.atan2(dy, dx) * 180 / Math.PI;
      const 三 = document.createElementNS(ns, 'polygon');
      三.setAttribute('points', '0,-7 13,0 0,7');
      三.setAttribute('fill', 色);
      三.setAttribute('transform', `translate(${x2},${y2}) rotate(${角}) translate(-13,0)`);
      svg.appendChild(三);
    },
    // 札を出して、そこから的へ矢印を引く（よく使う組み合わせ）
    札と矢(x, y, 文, 先, o = {}) {
      const s = this.札(x, y, 文, o);
      const 端 = o.出口 || '右';
      const p = 端 === '右' ? { x: s.x + s.w, y: s.y + s.h / 2 }
        : 端 === '左' ? { x: s.x, y: s.y + s.h / 2 }
        : 端 === '上' ? { x: s.x + s.w / 2, y: s.y }
        : { x: s.x + s.w / 2, y: s.y + s.h };
      this.矢(p.x, p.y, 先.x, 先.y, o.色 === '青' ? '#4a9bff' : '#ffc93c');
      return s;
    }
  };
});
module.exports = { 仕込む };
