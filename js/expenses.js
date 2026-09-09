const Expense = {
  CATEGORIES: [
    { name: 'Alimentación', icon: '&#127828;' },
    { name: 'Transporte', icon: '&#128662;' },
    { name: 'Servicios', icon: '&#128267;' },
    { name: 'Salud', icon: '&#127777;' },
    { name: 'Educación', icon: '&#127891;' },
    { name: 'Ocio', icon: '&#127912;' },
    { name: 'Ropa', icon: '&#128090;' },
    { name: 'Vivienda', icon: '&#127968;' },
    { name: 'Otros', icon: '&#128203;' }
  ],
  icon(name) {
    return (Expense.CATEGORIES.find(c => c.name === name) || Expense.CATEGORIES[Expense.CATEGORIES.length - 1]).icon;
  },
  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    return DB.add(StoreNames.EXPENSES, data);
  },
  async getAll() {
    return DB.getAll(StoreNames.EXPENSES);
  },
  async delete(id) {
    return DB.delete(StoreNames.EXPENSES, id);
  }
};

async function renderExpensePage() {
  const container = document.getElementById('page-expenses');
  const records = await Expense.getAll();
  const summary = await Gold.getMonthlyTotal(records, currentMonthKey());

  const cfg = await Budget.get();
  const spent = await Budget.monthSpent(records, currentMonthKey());
  const st = Budget.status(spent.total, cfg.total);

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Presupuesto del mes</h3></div>
      ${cfg.total > 0 ? `
        <div class="stat-value">${App.mask(fmtBRL(spent.total))}</div>
        <div class="stat-label">de ${App.mask(fmtBRL(cfg.total))} · ${spent.total > 0 ? Math.round(spent.total / cfg.total * 100) : 0}% usado</div>
        <div class="budget-track"><div class="budget-fill ${st.cls}" style="width:${st.pct}%"></div></div>
        ${Budget.getCatsTitleList(cfg.cats).map(c => `
          <div class="budget-caption">
            <span>${esc(c.name)}</span>
            <span>${App.mask(fmtBRL(spent.byCat[c.name] || 0))} / ${App.mask(fmtBRL(c.amount))}</span>
          </div>
          <div class="budget-track" style="height:5px"><div class="budget-fill ${Budget.status(spent.byCat[c.name] || 0, c.amount).cls}" style="width:${Budget.status(spent.byCat[c.name] || 0, c.amount).pct}%"></div></div>
        `).join('')}
      ` : `
        <div class="empty-state" style="padding:20px">
          <p>Sin presupuesto definido. Regístralo en <b>Configuración</b>.</p>
        </div>
      `}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${App.mask(fmtBRL(summary.brl))}</div>
        <div class="stat-label">Gastos este mes (BRL)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-gold">${App.mask(fmtGrams(summary.gold))}</div>
        <div class="stat-label">Gastos este mes (Oro)</div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-header"><h3>Gastos registrados</h3></div>
      <form style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:6px" id="exp-filter">
        <div class="form-group" style="margin-bottom:8px"><label>Desde</label><input type="date" id="exp-from"></div>
        <div class="form-group" style="margin-bottom:8px"><label>Hasta</label><input type="date" id="exp-to"></div>
      </form>
      <div id="exp-list-wrap"></div>
    </div>
  `;

  const renderList = (filtered) => {
    const wrap = document.getElementById('exp-list-wrap');
    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">&#128184;</div><p>No hay gastos en este rango.</p></div>`;
      return;
    }
    const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    wrap.innerHTML = `<ul class="tx-list">${sorted.map(r => expenseItem(r)).join('')}</ul>`;
    Swipe.init(wrap, async el => {
      await Expense.delete(parseInt(el.dataset.id));
      Toast.success('Gasto eliminado');
      renderExpensePage();
      if (App.pg === 'dashboard') renderDashboard();
    });
  };

  const from = document.getElementById('exp-from');
  const to = document.getElementById('exp-to');
  const apply = () => {
    renderList(records.filter(r => {
      if (from.value && r.date < from.value) return false;
      if (to.value && r.date > to.value) return false;
      return true;
    }));
  };
  from.addEventListener('change', apply);
  to.addEventListener('change', apply);
  apply();
  Budget.autoAlert(records, currentMonthKey());
}

function expenseItem(r) {
  const isGold = Gold.isGold(r);
  const value = isGold
    ? App.mask(fmtGrams(r.goldAmount))
    : App.mask(fmtBRL(r.amount));
  return `
    <li class="tx-item">
      <div class="tx-swipe-bg">&#128465;</div>
      <div class="tx-main" data-id="${r.id}">
        <div class="tx-icon" style="background:var(--negative-bg)">${Expense.icon(r.category)}</div>
        <div class="tx-info">
          <div class="name">${esc(r.title || 'Gasto')}</div>
          <div class="date">${formatDate(r.date)} · ${esc(r.category || 'Otros')}</div>
        </div>
        <div class="tx-amount expense">${isGold ? `<span class="chip chip-gold">${value}</span>` : value}</div>
      </div>
    </li>`;
}

function showExpenseModal() {
  openSheet('Nuevo gasto', `
    <div class="form-group">
      <label>Categoría</label>
      <select id="expense-category">
        ${Expense.CATEGORIES.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Moneda de pago</label>
      <select id="expense-type">
        <option value="brl">BRL (R$)</option>
        <option value="gold">Oro (gramos)</option>
      </select>
    </div>
    <div class="form-group" id="exp-field-brl">
      <label>Monto (R$)</label>
      <input type="number" id="expense-amount" step="0.01" placeholder="0,00" inputmode="decimal">
    </div>
    <div class="form-group hidden" id="exp-field-gold">
      <label>Gramos de oro</label>
      <input type="number" id="expense-gold" step="0.001" placeholder="0,000" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" id="expense-title" placeholder="Ej: Supermercado">
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="date" id="expense-date" value="${new Date().toISOString().slice(0, 10)}">
    </div>
    <button class="btn btn-dark" id="expense-save">Guardar gasto</button>
  `);

  const typeSel = document.getElementById('expense-type');
  const toggle = () => {
    const isGold = typeSel.value === 'gold';
    document.getElementById('exp-field-brl').classList.toggle('hidden', isGold);
    document.getElementById('exp-field-gold').classList.toggle('hidden', !isGold);
  };
  typeSel.addEventListener('change', toggle);

  document.getElementById('expense-save').addEventListener('click', async () => {
    const isGold = typeSel.value === 'gold';
    const category = document.getElementById('expense-category').value;
    const title = document.getElementById('expense-title').value.trim() || 'Gasto';
    const date = document.getElementById('expense-date').value;
    const val = parseFloat(document.getElementById(isGold ? 'expense-gold' : 'expense-amount').value);
    if (!val || val <= 0) { Toast.error('Ingresa un monto válido'); return; }
    await Expense.add({
      type: isGold ? 'gold' : 'brl',
      category, title, date,
      goldAmount: isGold ? val : null,
      amount: isGold ? null : val
    });
    closeSheet();
    Toast.success('Gasto guardado');
    renderExpensePage();
    if (App.pg === 'dashboard') renderDashboard();
  });
}