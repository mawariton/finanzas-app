const Charts = {
  PALETTE: ['#8a8f98', '#b8860b', '#5a8070', '#9a6a72', '#6a78a8', '#7a8f6a', '#8a6aa8', '#b08050', '#5c767a'],
  _opts() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#a1a1a6' : '#6e6e73',
      grid: dark ? 'rgba(161,161,166,0.12)' : 'rgba(110,110,115,0.12)',
      bar: dark ? 'rgba(245,245,247,0.65)' : 'rgba(28,28,30,0.55)',
      ink: dark ? '#f5f5f7' : '#1c1c1e',
      gold: dark ? '#d4af37' : '#b8860b'
    };
  },

  _fit(canvas) {
    const parent = canvas.parentElement;
    const cssW = parent.clientWidth;
    const cssH = parent.clientHeight || 200;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssW, h: cssH };
  },

  donut(canvas, items, centerLabel) {
    const { ctx, w, h } = Charts._fit(canvas);
    ctx.clearRect(0, 0, w, h);
    const total = items.reduce((s, it) => s + (it.value || 0), 0);
    if (total <= 0) {
      ctx.fillStyle = Charts._opts().text;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos', w / 2, h / 2);
      return;
    }

    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 18;
    const r = R * 0.66;
    const start = -Math.PI / 2;

    let angle = start;
    items.forEach((it, idx) => {
      const frac = (it.value || 0) / total;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2;
      angle = a1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1);
      ctx.arc(cx, cy, r, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = it.color || Charts.PALETTE[idx % Charts.PALETTE.length];
      ctx.fill();
    });

    ctx.fillStyle = Charts._opts().ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 15px sans-serif';
    ctx.fillText(centerLabel || '', cx, cy - 8);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = Charts._opts().text;
    ctx.fillText(total.toLocaleString('pt-BR') + ' BRL', cx, cy + 12);

    Charts._legend(canvas, items);
  },

  bars(canvas, labels, values, highlightIndex) {
    const { ctx, w, h } = Charts._fit(canvas);
    ctx.clearRect(0, 0, w, h);
    const o = Charts._opts();
    if (!labels.length) {
      ctx.fillStyle = o.text;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos', w / 2, h / 2);
      return;
    }

    const max = Math.max(...values, 1);
    const padL = 4, padR = 4, padT = 18, padB = 26;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const slot = chartW / labels.length;
    const barW = Math.min(slot * 0.56, 42);

    for (let i = 0; i < labels.length; i++) {
      const x = padL + slot * i + (slot - barW) / 2;
      const bh = (values[i] / max) * chartH;
      const y = padT + chartH - bh;
      const isHi = highlightIndex != null && i === highlightIndex;

      ctx.fillStyle = isHi ? o.gold : o.bar;
      Charts._roundRect(ctx, x, y, barW, Math.max(bh, 2), 6);
      ctx.fill();

      ctx.fillStyle = o.text;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(labels[i], x + barW / 2, h - 8);
    }

    ctx.fillStyle = o.text;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('R$', 2, 12);
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  _legend(canvas, items) {
    const parent = canvas.parentElement;
    let legend = parent.querySelector('.chart-legend');
    if (!legend) {
      legend = document.createElement('div');
      legend.className = 'chart-legend';
      parent.appendChild(legend);
    }
    const existing = parent.querySelectorAll('.chart-legend .leg-item');
    existing.forEach(e => e.remove());
    items.forEach((it, idx) => {
      const item = document.createElement('span');
      item.className = 'leg-item';
      item.innerHTML = `<span class="leg-dot" style="background:${it.color || Charts.PALETTE[idx % Charts.PALETTE.length]}"></span>${esc(it.label)}`;
      legend.appendChild(item);
    });
  }
};