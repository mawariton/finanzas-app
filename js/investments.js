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
  calc(rec) {
    const invested = parseFloat(rec.investedAmount) || 0;
    const current = parseFloat(rec.currentAmount) || 0;
    return {
      invested, current,
      diff: current - invested,
      pct: invested > 0 ? (current - invested) / invested * 100 : 0
    };
  }
};

async function renderInvestmentPage() {
  const container = document.getElementById('page-investments');
  const records = await Investment.getAll();

  const agg = records.reduce((a, r) => {
    const c = Investment.calc(r);
    a.invested += c.invested;
    a.current += c.current;
    return a;
  }, { invested: 0, current: 0 });
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
      <div class="stat-value ${diff >= 0 ? 'stat-positive' : 'stat-negative'}">${App.mask((diff >= 0 ? '+' : '') + fmtBRL(diff))} (${diff >= 0 ? '+' : ''}${pct.toFixed(1)}%)</div>
      <div class="stat-label">Ganancia / pérdida</div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Portafolio</h3></div>
      ${records.length === 0 ? `
        <div class="empty-state"><div class="icon">&#128200;</div><p>Sin inversiones registradas.</p></div>` : records.map(r => invCard(r)).join('')}
    </div>
  `;

  container.querySelectorAll('.inv-update').forEach(b => {
    b.addEventListener('click', () => {
      const rec = records.find(r => r.id === parseInt(b.dataset.id));
      if (rec) showInvestmentModal(rec);
    });
  });
  container.querySelectorAll('.inv-delete').forEach(b => {
    b.addEventListener('click', async () => {
      await Investment.delete(parseInt(b.dataset.id));
      Toast.success('Inversión eliminada');
      renderInvestmentPage();
      if (App.pg === 'dashboard') renderDashboard();
    });
  });
}

function invCard(r) {
  const c = Investment.calc(r);
  const cls = c.diff >= 0 ? 'stat-positive' : 'stat-negative';
  return `
    <div style="padding:14px 0; border-bottom:1px solid var(--border)">
      <div style="display:flex; align-items:center; gap:12px">
        <div class="tx-icon">${Investment.icon(r.type)}</div>
        <div style="flex:1; min-width:0">
          <div class="name" style="font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${esc(r.name || 'Inversión')}</div>
          <div class="date" style="font-size:0.75rem; color:var(--text-muted)">${esc(r.type || '')} · desde ${formatDate(r.date)}</div>
        </div>
        <div style="text-align:right">
          <div class="${cls}" style="font-weight:650">${App.mask((c.diff >= 0 ? '+' : '') + c.diff.toFixed(2))}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(1)}%</div>
        </div>
      </div>
      <div class="inv-foot">
        <span>Invertido: ${App.mask(fmtBRL(c.invested))}</span>
        <span>Actual: ${App.mask(fmtBRL(c.current))}</span>
      </div>
      <div class="inv-actions">
        <button class="btn btn-sm btn-ghost inv-update" data-id="${r.id}">&#9998; Actualizar</button>
        <button class="btn btn-sm btn-danger inv-delete" data-id="${r.id}">Eliminar</button>
      </div>
    </div>`;
}

function showInvestmentModal(record = null) {
  openSheet(record ? 'Actualizar inversión' : 'Nueva inversión', `
    <div class="form-group">
      <label>Tipo</label>
      <select id="inv-type">
        ${Investment.TYPES.map(t => `<option value="${t.name}" ${record && record.type === t.name ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="inv-name" value="${record ? esc(record.name) : ''}" placeholder="Ej: Petrobras, Bitcoin">
    </div>
    <div class="form-group">
      <label>Monto invertido (R$)</label>
      <input type="number" id="inv-invested" step="0.01" value="${record ? record.investedAmount : ''}" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Valor actual (R$)</label>
      <input type="number" id="inv-current" step="0.01" value="${record ? record.currentAmount : ''}" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="date" id="inv-date" value="${record ? record.date : new Date().toISOString().slice(0, 10)}">
    </div>
    <button class="btn btn-dark" id="inv-save">${record ? 'Guardar cambios' : 'Agregar inversión'}</button>
  `);

  document.getElementById('inv-save').addEventListener('click', async () => {
    const data = {
      type: document.getElementById('inv-type').value,
      name: document.getElementById('inv-name').value.trim() || 'Inversión',
      investedAmount: parseFloat(document.getElementById('inv-invested').value) || 0,
      currentAmount: parseFloat(document.getElementById('inv-current').value) || 0,
      date: document.getElementById('inv-date').value
    };
    if (data.investedAmount <= 0) { Toast.error('El monto invertido debe ser mayor a 0'); return; }
    if (record) {
      await Investment.update(record.id, data);
      Toast.success('Inversión actualizada');
    } else {
      await Investment.add(data);
      Toast.success('Inversión agregada');
    }
    closeSheet();
    renderInvestmentPage();
    if (App.pg === 'dashboard') renderDashboard();
  });
}