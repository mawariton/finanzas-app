const Investment = {
  TYPES: [
    { name: 'Acciones', icon: '&#128186;' },
    { name: 'Fondos', icon: '&#127919;' },
    { name: 'Criptomonedas', icon: '&#128179;' },
    { name: 'Inmobiliario', icon: '&#127970;' },
    { name: 'Oro', icon: '&#129351;' },
    { name: 'Plazo fijo', icon: '&#128184;' },
    { name: 'Otro', icon: '&#128203;' }
  ],
  icon(name) {
    return (Investment.TYPES.find(t => t.name === name) || Investment.TYPES[Investment.TYPES.length - 1]).icon;
  },
  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    return DB.add(StoreNames.INVESTMENTS, data);
  },
  async getAll() {
    return DB.getAll(StoreNames.INVESTMENTS);
  },
  async update(id, data) {
    const rec = await DB.get(StoreNames.INVESTMENTS, id);
    if (rec) await DB.put(StoreNames.INVESTMENTS, { ...rec, ...data });
  },
  async delete(id) {
    return DB.delete(StoreNames.INVESTMENTS, id);
  },
  async addReturn(id, ret) {
    const rec = await DB.get(StoreNames.INVESTMENTS, id);
    if (!rec) return;
    const returns = Array.isArray(rec.returns) ? rec.returns : [];
    const nextId = returns.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
    returns.push({
      id: nextId,
      date: ret.date || new Date().toISOString().slice(0, 10),
      amount: parseFloat(ret.amount) || 0,
      currency: ret.currency,
      note: ret.note || ''
    });
    returns.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    await DB.put(StoreNames.INVESTMENTS, { ...rec, returns });
  },
  async deleteReturn(id, returnId) {
    const rec = await DB.get(StoreNames.INVESTMENTS, id);
    if (!rec) return;
    rec.returns = (Array.isArray(rec.returns) ? rec.returns : []).filter(r => r.id !== returnId);
    await DB.put(StoreNames.INVESTMENTS, rec);
  },
  /* Calcula el plan completo de una inversión usando el precio del oro actual. */
  normalize(rec, price) {
    const p = price > 0 ? price : Gold.DEFAULT_PRICE;
    const invested = parseFloat(rec.investedAmount) || 0;
    const current = parseFloat(rec.currentAmount) || 0;
    const pay = rec.payCurrency === 'brl' ? 'brl' : 'gold';
    const goalMode = rec.goalMode === 'total' ? 'total' : 'pct';
    const gainPct = parseFloat(rec.gainPct) || 0;
    const toPayUnits = v => (pay === 'gold' ? v / p : v);

    let expected = toPayUnits(invested * (1 + gainPct / 100));
    if (goalMode === 'total') {
      const t = parseFloat(rec.expectedTotal);
      if (t > 0) expected = t;
    }

    const returns = (Array.isArray(rec.returns) ? rec.returns : [])
      .map((r, i) => ({
        id: r.id != null ? r.id : i + 1,
        date: r.date || '',
        amount: parseFloat(r.amount) || 0,
        currency: r.currency === 'gold' ? 'gold' : 'brl',
        note: r.note || ''
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let collected = 0, collectedBrl = 0;
    for (const r of returns) {
      collected += pay === 'gold'
        ? (r.currency === 'gold' ? r.amount : r.amount / p)
        : (r.currency === 'brl' ? r.amount : r.amount * p);
      collectedBrl += r.currency === 'gold' ? r.amount * p : r.amount;
    }
    const remaining = Math.max(0, expected - collected);
    const collectedPct = expected > 0 ? Math.min(100, (collected / expected) * 100) : 0;
    const status = rec.status === 'collecting' || rec.status === 'closed'
      ? rec.status
      : (returns.length ? 'collecting' : 'invested');
    const diff = current - invested;
    const pct = invested > 0 ? (diff / invested) * 100 : 0;

    return {
      invested, current, diff, pct, pay, goalMode, gainPct,
      expected, returns, collected, collectedBrl, collectedPct,
      remaining,
      expectedBrl: expected * (pay === 'gold' ? p : 1),
      remainingBrl: remaining * (pay === 'gold' ? p : 1),
      status
    };
  }
};

const InvPay = {
  fmt(n) { return n.pay === 'gold' ? fmtGrams(n.collected) : fmtBRL(n.collected); },
  fmtTotal(n) { return n.pay === 'gold' ? fmtGrams(n.expected) : fmtBRL(n.expected); },
  fmtRemain(n) { return n.pay === 'gold' ? fmtGrams(n.remaining) : fmtBRL(n.remaining); }
};

async function renderInvestmentPage() {
  const container = document.getElementById('page-investments');
  const [records, price] = await Promise.all([Investment.getAll(), Gold.getPricePerGram()]);
  const items = records.map(r => ({ rec: r, n: Investment.normalize(r, price) }));

  const agg = items.reduce((a, it) => {
    a.invested += it.n.invested;
    a.current += it.n.current;
    a.collectedBrl += it.n.collectedBrl;
    a.remainingBrl += it.n.remainingBrl;
    return a;
  }, { invested: 0, current: 0, collectedBrl: 0, remainingBrl: 0 });
  const diff = agg.current - agg.invested;
  const pct = agg.invested > 0 ? diff / agg.invested * 100 : 0;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${App.mask(fmtBRL(agg.invested))}</div>
        <div class="stat-label">Total invertido</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${App.mask(fmtBRL(agg.current))}</div>
        <div class="stat-label">Valor actual</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="stat-value ${diff >= 0 ? 'stat-positive' : 'stat-negative'}">${App.mask((diff >= 0 ? '+' : '') + fmtBRL(diff))} <span style="font-size:0.8rem; font-weight:700">${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%</span></div>
      <div class="stat-label">Ganancia / pérdida</div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="kv-row"><span>Ya recuperado</span><b>${App.mask(fmtBRL(agg.collectedBrl))}</b></div>
      <div class="kv-row"><span>Te falta por cobrar</span><b class="stat-gold">${App.mask(fmtBRL(agg.remainingBrl))} <span style="color:var(--text-muted); font-size:0.75rem">≈ ${App.mask(fmtGrams(price > 0 ? agg.remainingBrl / price : 0))}</span></b></div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Portafolio</h3></div>
      ${
        items.length === 0
          ? `<div class="empty-state"><div class="icon">&#128200;</div><p>Sin inversiones registradas.<br>Toca + para agregar la primera.</p></div>`
          : items.map(({ rec, n }) => invCard(rec, n)).join('')
      }
      <div class="form-hint" style="margin:10px 0 0">Toca una inversión para ver su plan, cobrar retornos y seguir su historia.</div>
    </div>
  `;

  container.querySelectorAll('[data-inv-detail]').forEach(b => {
    b.addEventListener('click', () => openInvestmentDetail(parseInt(b.dataset.invDetail)));
  });
}

function invCard(r, n) {
  const cls = n.diff >= 0 ? 'stat-positive' : 'stat-negative';
  const statusLabel = n.status === 'closed' ? 'Cerrada' : n.status === 'collecting' ? 'En cobro' : 'Invertida';
  const statusCls = n.status === 'closed' ? 'st-closed' : n.status === 'collecting' ? 'st-collecting' : 'st-invested';
  return `
    <button class="inv-card-link" data-inv-detail="${r.id}">
      <div class="inv-card-head">
        <div class="tx-icon">${Investment.icon(r.type)}</div>
        <div style="flex:1; min-width:0; text-align:left">
          <div class="name" style="font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${esc(r.name || 'Inversión')}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">${esc(r.type || '')} · <span class="status-chip ${statusCls}" style="padding:1px 8px">${statusLabel}</span></div>
        </div>
        <div style="text-align:right">
          <div class="${cls}" style="font-weight:650">${App.mask((n.diff >= 0 ? '+' : '') + fmtBRL(n.diff))}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">${n.pct >= 0 ? '+' : ''}${n.pct.toFixed(1)}%</div>
        </div>
        <div class="inv-chev">&#8250;</div>
      </div>
      ${
        n.expected > 0 ? `
        <div class="inv-prog">
          <div class="budget-track"><div class="budget-fill" style="width:${n.collectedPct}%"></div></div>
          <div class="inv-prog-labels">
            <span>Cobrado ${App.mask(InvPay.fmt(n))} de ${App.mask(InvPay.fmtTotal(n))}</span>
            <span>Falta ${App.mask(InvPay.fmtRemain(n))}</span>
          </div>
        </div>` : `
        <div style="margin-top:8px; font-size:0.75rem; color:var(--text-muted)">Define tu meta esperada al abrir esta inversión.</div>`
      }
    </button>`;
}

async function openInvestmentDetail(id) {
  const rec = await DB.get(StoreNames.INVESTMENTS, id);
  if (!rec) return;
  const price = await Gold.getPricePerGram();
  const n = Investment.normalize(rec, price);
  const gold = n.pay === 'gold';
  const statusLabel = n.status === 'closed' ? 'Cerrada' : n.status === 'collecting' ? 'En cobro' : 'Invertida';
  const statusCls = n.status === 'closed' ? 'st-closed' : n.status === 'collecting' ? 'st-collecting' : 'st-invested';
  const goalLabel = n.goalMode === 'total'
    ? `Meta (total)`
    : `Meta ${n.gainPct >= 0 ? '+' : ''}${n.gainPct.toFixed(0)}%`;
  const planEmpty = !(n.invested > 0);

  const returnsHTML = n.returns.length ? `
    <ul class="tx-list">${n.returns.map(r => `
      <li class="tx-item" style="border-bottom:1px solid var(--border)">
        <div class="inv-ret">
          <div class="tx-icon" style="width:36px;height:36px;font-size:1rem">${r.currency === 'gold' ? '&#129351;' : '&#128176;'}</div>
          <div class="tx-info">
            <div class="name">${r.currency === 'gold' ? App.mask(fmtGrams(r.amount)) : App.mask(fmtBRL(r.amount))}</div>
            <div class="date">${formatDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}</div>
          </div>
          <button class="btn btn-sm btn-danger inv-ret-del" data-rid="${r.id}">Eliminar</button>
        </div>
      </li>`).join('')}</ul>` : `
    <div class="empty-state"><div class="icon">&#128233;</div><p>Aún no has cobrado.<br>Agrega el primer retorno para ver avances.</p></div>`;

  openSheet(esc(rec.name || 'Inversión'), `
    <div class="inv-detail-head">
      <div class="tx-icon">${Investment.icon(rec.type)}</div>
      <div class="inv-detail-title">
        <div class="name" style="font-weight:650; font-size:1rem">${esc(rec.name || 'Inversión')}</div>
        <div class="date">${esc(rec.type || '')} · desde ${formatDate(rec.date)}</div>
        <span class="status-chip ${statusCls}">${statusLabel}</span>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-header"><h3>Plan de retorno</h3></div>
      <div class="kv-row"><span>Invertido</span><b>${App.mask(fmtBRL(n.invested))}</b></div>
      <div class="kv-row"><span>Te pagan en</span><b>${gold ? '&#129351; Oro' : '&#128176; Reais'}</b></div>
      <div class="kv-row"><span>${goalLabel}</span><b class="stat-gold">${App.mask(InvPay.fmtTotal(n))}</b></div>
      <div class="kv-row"><span>Equivale a</span><b>${gold ? App.mask(fmtBRL(n.expectedBrl)) : App.mask(fmtGrams(n.expected / price))}</b></div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Valor actual</h3></div>
      <div class="kv-row"><span>Hoy</span><b>${App.mask(fmtBRL(n.current))} <span class="${n.diff >= 0 ? 'stat-positive' : 'stat-negative'}" style="font-size:0.8rem">${n.diff >= 0 ? '+' : ''}${n.pct.toFixed(1)}%</span></b></div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Cobrado</h3></div>
      ${
        planEmpty ? `
        <div class="form-hint" style="margin:8px 0 0">Completa la inversión (monto + meta) con el botón “Editar” para activar el seguimiento de cobros.</div>` : `
        <div class="budget-track"><div class="budget-fill" style="width:${n.collectedPct}%"></div></div>
        <div class="kv-row" style="margin-top:12px"><span>Recuperado</span><b>${App.mask(InvPay.fmt(n))} de ${App.mask(InvPay.fmtTotal(n))}</b></div>
        <div class="kv-row"><span>Te falta por cobrar</span><b class="stat-gold">${App.mask(InvPay.fmtRemain(n))} ≈ ${App.mask(fmtBRL(n.remainingBrl))}</b></div>
        <div class="kv-row" style="border-bottom:none"><span>Total cobrado ≈</span><b>${App.mask(fmtBRL(n.collectedBrl))}</b></div>`
      }
    </div>

    <div class="card">
      <div class="card-header"><h3>Historial de retornos</h3></div>
      ${returnsHTML}
    </div>

    <div class="btn-row">
      <button class="btn btn-dark" id="inv-add-ret">&#8645; Agregar retorno</button>
      <button class="btn btn-ghost" id="inv-edit">&#9998; Editar</button>
    </div>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn btn-ghost" id="inv-status">${n.status === 'closed' ? '&#8634; Reabrir inversión' : '&#128994; Marcar como cerrada'}</button>
      <button class="btn btn-danger" id="inv-del">Eliminar</button>
    </div>
  `);

  const refresh = () => openInvestmentDetail(rec.id);
  const reRenderPage = () => {
    renderInvestmentPage();
    if (App.pg === 'dashboard') renderDashboard();
  };

  document.getElementById('inv-add-ret').addEventListener('click', () => showReturnModal(rec.id));
  document.getElementById('inv-edit').addEventListener('click', () => showInvestmentModal(rec, price));
  document.getElementById('inv-status').addEventListener('click', async () => {
    await Investment.update(rec.id, { status: n.status === 'closed' ? 'collecting' : 'closed' });
    Toast.success(n.status === 'closed' ? 'Inversión reabierta' : 'Inversión cerrada');
    refresh();
  });
  document.getElementById('inv-del').addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta inversión y todo su historial?')) return;
    await Investment.delete(rec.id);
    closeSheet();
    Toast.success('Inversión eliminada');
    reRenderPage();
  });
  document.querySelectorAll('#sheet-root .inv-ret-del').forEach(b => {
    b.addEventListener('click', async () => {
      const rid = parseInt(b.dataset.rid);
      await Investment.deleteReturn(rec.id, rid);
      Toast.success('Retorno eliminado');
      refresh();
    });
  });
}

async function showReturnModal(id) {
  const rec = await DB.get(StoreNames.INVESTMENTS, id);
  if (!rec) return;
  const price = await Gold.getPricePerGram();
  const n = Investment.normalize(rec, price);

  openSheet('Agregar retorno', `
    <div style="text-align:center; color:var(--text-secondary); font-size:0.85rem; margin-top:-6px; margin-bottom:14px">${esc(rec.name || 'Inversión')} · te pagan en ${n.pay === 'gold' ? 'oro' : 'reais'}</div>
    <div class="form-group">
      <label>Moneda del retorno</label>
      <div class="seg">
        <button type="button" class="seg-btn ${n.pay === 'gold' ? 'on' : ''}" data-rcur="gold">&#129351; Oro</button>
        <button type="button" class="seg-btn ${n.pay === 'brl' ? 'on' : ''}" data-rcur="brl">&#128176; Reais</button>
      </div>
    </div>
    <div class="form-group">
      <label id="ret-amt-label">Monto en gramos de oro</label>
      <input type="number" id="ret-amount" step="0.001" placeholder="0,000" inputmode="decimal">
      <div class="form-hint" id="ret-conv"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="ret-date" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="form-group">
        <label>Nota (opcional)</label>
        <input type="text" id="ret-note" placeholder="Ej: primer pago">
      </div>
    </div>
    <button class="btn btn-dark" id="ret-save">Guardar retorno</button>
  `);

  let cur = n.pay;
  const updateConv = () => {
    const amt = document.getElementById('ret-amount');
    const conv = document.getElementById('ret-conv');
    const v = parseFloat(amt.value);
    if (!v || v <= 0) {
      conv.textContent = cur === 'gold'
        ? `1 g = ${App.mask(fmtBRL(price))}`
: `1 R$ = ${App.mask(fmtGrams(1 / price))}`;
      return;
    }
    conv.textContent = cur === 'gold'
      ? `= ${App.mask(fmtBRL(v * price))} en reais`
      : `= ${App.mask(fmtGrams(v / price))}`;
  };

  document.querySelectorAll('#sheet-root .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      cur = b.dataset.rcur;
      document.querySelectorAll('#sheet-root .seg-btn').forEach(x => x.classList.toggle('on', x === b));
      const amt = document.getElementById('ret-amount');
      const goldMode = cur === 'gold';
      amt.step = goldMode ? '0.001' : '0.01';
      amt.placeholder = goldMode ? '0,000' : '0,00';
      document.getElementById('ret-amt-label').textContent = goldMode ? 'Monto en gramos de oro' : 'Monto en reais';
      updateConv();
    });
  });
  document.getElementById('ret-amount').addEventListener('input', updateConv);
  updateConv();

  document.getElementById('ret-save').addEventListener('click', async () => {
    const v = parseFloat(document.getElementById('ret-amount').value);
    if (!v || v <= 0) { Toast.error('Ingresa un monto válido'); return; }
    await Investment.addReturn(rec.id, {
      date: document.getElementById('ret-date').value,
      amount: v,
      currency: cur,
      note: document.getElementById('ret-note').value.trim()
    });
    Toast.success('Retorno guardado');
    closeSheet();
    openInvestmentDetail(rec.id);
    if (App.pg === 'investments') renderInvestmentPage();
  });
}

function showInvestmentModal(record = null) {
  Gold.getPricePerGram().then(price => {
    const pay = (record && record.payCurrency) ? record.payCurrency : 'gold';
    const goalMode = (record && record.goalMode === 'total') ? 'total' : 'pct';
    const gainPct = (record && record.gainPct != null) ? record.gainPct : 0;
    const expectedTotal = (record && record.expectedTotal != null) ? record.expectedTotal : '';

    openSheet(record ? 'Editar inversión' : 'Nueva inversión', `
      <div class="form-group">
        <label>Tipo</label>
        <select id="inv-type">
          ${Investment.TYPES.map(t => `<option value="${t.name}" ${record && record.type === t.name ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" id="inv-name" value="${record ? esc(record.name) : ''}" placeholder="Ej: Préstamo a Juan, Petrobras">
      </div>
      <div class="form-group">
        <label>Te pagan en</label>
        <select id="inv-pay">
          <option value="gold" ${pay === 'gold' ? 'selected' : ''}>&#129351; Oro (gramos)</option>
          <option value="brl" ${pay === 'brl' ? 'selected' : ''}>&#128176; Reais (R$)</option>
        </select>
        <div class="form-hint">Inviertes en R$ y recibes ${pay === 'gold' ? 'gramos de oro' : 'el pago en reais'}</div>
      </div>
      <div class="form-group">
        <label>Meta esperada</label>
        <select id="inv-goal">
          <option value="pct" ${goalMode === 'pct' ? 'selected' : ''}>Ganancia (%) sobre lo invertido</option>
          <option value="total" ${goalMode === 'total' ? 'selected' : ''}>Total a recibir</option>
        </select>
      </div>
      <div class="form-group ${goalMode === 'total' ? 'hidden' : ''}" id="inv-field-pct">
        <label>Ganancia esperada (%)</label>
        <input type="number" id="inv-gain" step="1" value="${gainPct}" placeholder="Ej: 50" inputmode="numeric">
        <div class="form-hint" id="gain-conv"></div>
      </div>
      <div class="form-group ${goalMode === 'total' ? '' : 'hidden'}" id="inv-field-total">
        <label id="tot-label">Total a recibir (gramos de oro)</label>
        <input type="number" id="inv-total" step="0.001" value="${expectedTotal}" placeholder="0" inputmode="decimal">
        <div class="form-hint" id="tot-conv"></div>
      </div>
      <div class="form-group">
        <label>Monto invertido (R$)</label>
        <input type="number" id="inv-invested" step="0.01" value="${record ? record.investedAmount : ''}" placeholder="0,00" inputmode="decimal">
      </div>
      <div class="form-group">
        <label>Valor actual (R$)</label>
        <input type="number" id="inv-current" step="0.01" value="${record ? record.currentAmount : ''}" placeholder="0,00" inputmode="decimal">
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="inv-date" value="${record ? record.date : new Date().toISOString().slice(0, 10)}">
      </div>
      <button class="btn btn-dark" id="inv-save">${record ? 'Guardar cambios' : 'Agregar inversión'}</button>
    `);

    const goalSel = document.getElementById('inv-goal');
    const paySel = document.getElementById('inv-pay');
    const gainInput = document.getElementById('inv-gain');
    const totalInput = document.getElementById('inv-total');

    const updateGainConv = () => {
      const conv = document.getElementById('gain-conv');
      const g = parseFloat(gainInput.value);
      const invested = parseFloat(document.getElementById('inv-invested').value);
      if (!isNaN(g) && invested > 0) {
        const totalBrl = invested * (1 + g / 100);
        if (paySel.value === 'gold') {
          conv.textContent = `Recibirás ${App.mask(fmtGrams(totalBrl / price))} (≈ ${App.mask(fmtBRL(totalBrl))})`;
        } else {
          conv.textContent = `Recibirás ${App.mask(fmtBRL(totalBrl))}`;
        }
      } else {
        conv.textContent = paySel.value === 'gold' ? `1 g = ${App.mask(fmtBRL(price))}` : '';
      }
    };
    const updateTotConv = () => {
      const conv = document.getElementById('tot-conv');
      const v = parseFloat(totalInput.value);
      if (paySel.value === 'gold') {
        document.getElementById('tot-label').textContent = 'Total a recibir (gramos de oro)';
        totalInput.step = '0.001';
        conv.textContent = v > 0 ? `≈ ${App.mask(fmtBRL(v * price))} en reais` : `1 g = ${App.mask(fmtBRL(price))}`;
      } else {
        document.getElementById('tot-label').textContent = 'Total a recibir (R$)';
        totalInput.step = '0.01';
        conv.textContent = v > 0 ? `≈ ${App.mask(fmtGrams(v / price))}` : `1 R$ = ${App.mask(fmtGrams(1 / price))}`;
      }
    };

    const toggleGoal = () => {
      const isTotal = goalSel.value === 'total';
      document.getElementById('inv-field-pct').classList.toggle('hidden', isTotal);
      document.getElementById('inv-field-total').classList.toggle('hidden', !isTotal);
      if (isTotal) updateTotConv(); else updateGainConv();
    };
    goalSel.addEventListener('change', toggleGoal);
    paySel.addEventListener('change', () => { toggleGoal(); });
    gainInput.addEventListener('input', updateGainConv);
    totalInput.addEventListener('input', updateTotConv);
    document.getElementById('inv-invested').addEventListener('input', updateGainConv);
    toggleGoal();

    document.getElementById('inv-save').addEventListener('click', async () => {
      const data = {
        type: document.getElementById('inv-type').value,
        name: document.getElementById('inv-name').value.trim() || 'Inversión',
        investedAmount: parseFloat(document.getElementById('inv-invested').value) || 0,
        currentAmount: parseFloat(document.getElementById('inv-current').value) || 0,
        date: document.getElementById('inv-date').value,
        payCurrency: paySel.value,
        goalMode: goalSel.value
      };
      if (data.investedAmount <= 0) { Toast.error('El monto invertido debe ser mayor a 0'); return; }
      const gain = parseFloat(gainInput.value);
      const total = parseFloat(totalInput.value);
      if (goalSel.value === 'pct') {
        data.gainPct = isNaN(gain) ? 0 : gain;
        data.expectedTotal = null;
      } else {
        if (!total || total <= 0) { Toast.error('Ingresa el total a recibir'); return; }
        data.expectedTotal = total;
        data.gainPct = null;
      }
      if (record) {
        await Investment.update(record.id, data);
        Toast.success('Inversión actualizada');
      } else {
        await Investment.add(data);
        Toast.success('Inversión agregada');
      }
      closeSheet();
      if (App.pg === 'investments') renderInvestmentPage();
      if (App.pg === 'dashboard') renderDashboard();
    });
  });
}