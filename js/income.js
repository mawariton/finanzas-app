const Income = {
  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    return DB.add(StoreNames.INCOMES, data);
  },
  async getAll() {
    return DB.getAll(StoreNames.INCOMES);
  },
  async delete(id) {
    return DB.delete(StoreNames.INCOMES, id);
  }
};

async function renderIncomePage() {
  const container = document.getElementById('page-income');
  const records = await Income.getAll();
  const [price, summary] = await Promise.all([
    Gold.getPricePerGram(),
    Gold.getMonthlyTotal(records, currentMonthKey())
  ]);
  const totalGold = records.reduce((s, r) =>
    s + (Gold.isGold(r) ? parseFloat(r.goldAmount || 0) : (parseFloat(r.amount || 0) / price)), 0);

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${App.mask(fmtBRL(summary.brl))}</div>
        <div class="stat-label">Ingresos este mes (BRL)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-gold">${App.mask(fmtGrams(summary.gold))}</div>
        <div class="stat-label">Ingresos este mes (Oro)</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-header">
        <div><h3>Historial</h3></div>
        <div style="color:var(--text-muted); font-size:0.8rem; font-weight:600">Total oro ${App.mask(fmtGrams(totalGold))}</div>
      </div>
      ${records.length === 0 ? `
        <div class="empty-state"><div class="icon">&#128176;</div><p>Sin ingresos todavía.<br>Toca + para agregar tu primera nómina.</p></div>` : `
        <ul class="tx-list">${records.map(r => incomeItem(r)).join('')}</ul>`}
    </div>
  `;

  Swipe.init(container, async el => {
    const id = parseInt(el.dataset.id);
    await Income.delete(id);
    Toast.success('Ingreso eliminado');
    renderIncomePage();
    if (App.pg === 'dashboard') renderDashboard();
  });
}

function incomeItem(r) {
  const isGold = Gold.isGold(r);
  const value = isGold
    ? App.mask(fmtGrams(r.goldAmount))
    : App.mask(fmtBRL(r.amount));
  return `
    <li class="tx-item">
      <div class="tx-swipe-bg">&#128465;</div>
      <div class="tx-main" data-id="${r.id}">
        <div class="tx-icon" style="${isGold ? 'background:var(--gold-soft)' : 'background:var(--positive-bg)'}">${isGold ? '&#129351;' : '&#8600;'}</div>
        <div class="tx-info">
          <div class="name">${esc(r.title || 'Ingreso')}</div>
          <div class="date">${formatDate(r.date)}${r.category ? ' · ' + esc(r.category) : ''}</div>
        </div>
        <div class="tx-amount income">${isGold ? `<span class="chip chip-gold">${value}</span>` : value}</div>
      </div>
    </li>`;
}

function showIncomeModal() {
  openSheet('Nuevo ingreso', `
    <div class="form-group">
      <label>Moneda</label>
      <select id="income-type">
        <option value="brl">BRL (R$)</option>
        <option value="gold">Oro (gramos)</option>
      </select>
    </div>
    <div class="form-group" id="inc-field-brl">
      <label>Monto (R$)</label>
      <input type="number" id="income-amount" step="0.01" placeholder="0,00" inputmode="decimal">
    </div>
    <div class="form-group hidden" id="inc-field-gold">
      <label>Gramos de oro</label>
      <input type="number" id="income-gold" step="0.001" placeholder="0,000" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Concepto</label>
      <input type="text" id="income-title" placeholder="Ej: Nómina mensual">
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="date" id="income-date" value="${new Date().toISOString().slice(0, 10)}">
    </div>
    <button class="btn btn-dark" id="income-save">Guardar ingreso</button>
  `);

  const typeSel = document.getElementById('income-type');
  const toggle = () => {
    const isGold = typeSel.value === 'gold';
    document.getElementById('inc-field-brl').classList.toggle('hidden', isGold);
    document.getElementById('inc-field-gold').classList.toggle('hidden', !isGold);
  };
  typeSel.addEventListener('change', toggle);
  toggle();

  document.getElementById('income-save').addEventListener('click', async () => {
    const isGold = typeSel.value === 'gold';
    const title = document.getElementById('income-title').value.trim() || 'Ingreso';
    const date = document.getElementById('income-date').value;
    const val = parseFloat(document.getElementById(isGold ? 'income-gold' : 'income-amount').value);
    if (!val || val <= 0) { Toast.error('Ingresa un monto válido'); return; }
    await Income.add({
      type: isGold ? 'gold' : 'brl',
      title, date,
      goldAmount: isGold ? val : null,
      amount: isGold ? null : val
    });
    closeSheet();
    Toast.success('Ingreso guardado');
    renderIncomePage();
    if (App.pg === 'dashboard') renderDashboard();
  });
}