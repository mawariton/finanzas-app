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

  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    if (data.type === 'gold') {
      data.goldAmount = parseFloat(data.goldAmount) || 0;
      data.brlEquivalent = await Gold.goldToBRL(data.goldAmount);
    } else {
      data.amount = parseFloat(data.amount) || 0;
    }
    return DB.add(StoreNames.EXPENSES, data);
  },

  async getAll() {
    return DB.getAll(StoreNames.EXPENSES);
  },

  async delete(id) {
    return DB.delete(StoreNames.EXPENSES, id);
  },

  async getMonthlyTotal(year, month) {
    const all = await DB.getAll(StoreNames.EXPENSES);
    let totalBRL = 0;
    let totalGold = 0;
    for (const exp of all) {
      if (exp.type === 'gold') totalGold += parseFloat(exp.goldAmount || 0);
      else totalBRL += parseFloat(exp.amount || 0);
    }
    return { totalBRL, totalGold };
  },

  getTotalForMonth(records, yearMonth) {
    let total = { brl: 0, gold: 0 };
    for (const r of records) {
      if (r.date && r.date.startsWith(yearMonth)) {
        if (r.type === 'gold') total.gold += parseFloat(r.goldAmount || 0);
        else total.brl += parseFloat(r.amount || 0);
      }
    }
    return total;
  },

  getCategoriesSummary(records, dateFrom, dateTo) {
    const byCategory = {};
    for (const r of records) {
      if (dateFrom && r.date < dateFrom) continue;
      if (dateTo && r.date > dateTo) continue;
      const cat = r.category || 'Otros';
      if (!byCategory[cat]) byCategory[cat] = { brl: 0, gold: 0 };
      if (r.type === 'gold') byCategory[cat].gold += parseFloat(r.goldAmount || 0);
      else byCategory[cat].brl += parseFloat(r.amount || 0);
    }
    return byCategory;
  }
};

function renderExpensePage() {
  const container = document.getElementById('page-expenses');
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Resumen de gastos</h3></div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="expense-total-brl">R$ 0,00</div>
          <div class="stat-label">Total en BRL</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stat-gold" id="expense-total-gold">0,000 g</div>
          <div class="stat-label">Total en Oro</div>
        </div>
      </div>
      <form class="form-row" style="margin-top:12px" id="expense-filter-form">
        <div class="form-group" style="margin-bottom:0">
          <label>Desde</label>
          <input type="date" id="expense-filter-from">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Hasta</label>
          <input type="date" id="expense-filter-to">
        </div>
      </form>
    </div>
    <div class="card">
      <div class="card-header"><h3>Gastos registrados</h3></div>
      <ul class="transaction-list" id="expense-list"></ul>
    </div>
  `;

  const fromInput = document.getElementById('expense-filter-from');
  const toInput = document.getElementById('expense-filter-to');
  let records = [];

  const applyFilters = () => {
    const from = fromInput.value;
    const to = toInput.value;
    const filtered = records.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
    renderExpenseList(filtered);
  };

  fromInput.addEventListener('change', applyFilters);
  toInput.addEventListener('change', applyFilters);

  Expense.getAll().then(all => {
    records = all;
    const totals = records.reduce((acc, r) => {
      if (r.type === 'gold') acc.gold += parseFloat(r.goldAmount || 0);
      else acc.brl += parseFloat(r.amount || 0);
      return acc;
    }, { brl: 0, gold: 0 });

    document.getElementById('expense-total-brl').textContent = `R$ ${totals.brl.toFixed(2).replace('.', ',')}`;
    document.getElementById('expense-total-gold').textContent = `${totals.gold.toFixed(3)} g`;
    applyFilters();
  });
}

function renderExpenseList(filtered) {
  const list = document.getElementById('expense-list');
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">&#128184;</div>
        <p>No hay gastos en este rango.<br>Toca el botón + para agregar.</p>
      </div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  list.innerHTML = sorted.map(r => {
    const icon = Expense.CATEGORIES.find(c => c.name === r.category)?.icon || '&#128203;';
    return `
      <li class="transaction-item">
        <div class="transaction-icon" style="background: rgba(239,68,68,0.12)">${icon}</div>
        <div class="transaction-info">
          <div class="name">${esc(r.title || 'Gasto')}</div>
          <div class="date">${formatDate(r.date)} · ${esc(r.category || 'Otros')}</div>
        </div>
        <div class="transaction-amount expense">
          ${r.type === 'gold'
            ? `<span class="chip chip-gold">${parseFloat(r.goldAmount).toFixed(3)} g</span>`
            : `R$ ${parseFloat(r.amount).toFixed(2).replace('.', ',')}`}
        </div>
        <button class="btn btn-sm btn-outline expense-delete" data-id="${r.id}">&#128465;</button>
      </li>
    `;
  }).join('');

  list.querySelectorAll('.expense-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await Expense.delete(parseInt(btn.dataset.id));
      Toast.success('Gasto eliminado');
      renderExpensePage();
      renderDashboard();
    });
  });
}

function showExpenseModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Nuevo gasto';
  document.getElementById('modal-body').innerHTML = `
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
    <div class="form-group" id="expense-field-brl">
      <label>Monto (R$)</label>
      <input type="number" id="expense-amount" step="0.01" placeholder="0.00">
    </div>
    <div class="form-group" style="display:none" id="expense-field-gold">
      <label>Gramos de oro</label>
      <input type="number" id="expense-gold" step="0.001" placeholder="0.000">
    </div>
    <div class="form-group">
      <label>Descripción</label>
      <input type="text" id="expense-title" placeholder="Ej: Supermercado">
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="date" id="expense-date" value="${new Date().toISOString().slice(0, 10)}">
    </div>
    <button class="btn btn-primary" id="expense-save">Guardar gasto</button>
  `;

  const typeSelect = document.getElementById('expense-type');
  const toggleFields = () => {
    const isGold = typeSelect.value === 'gold';
    document.getElementById('expense-field-brl').style.display = isGold ? 'none' : 'block';
    document.getElementById('expense-field-gold').style.display = isGold ? 'block' : 'none';
  };
  typeSelect.addEventListener('change', toggleFields);

  document.getElementById('expense-save').addEventListener('click', async () => {
    const category = document.getElementById('expense-category').value;
    const type = typeSelect.value;
    const title = document.getElementById('expense-title').value.trim() || 'Gasto';
    const date = document.getElementById('expense-date').value;

    if (type === 'gold') {
      const grams = parseFloat(document.getElementById('expense-gold').value);
      if (!grams || grams <= 0) { Toast.error('Ingresa gramos válidos'); return; }
      await Expense.add({ type, goldAmount: grams, title, date, category });
    } else {
      const amount = parseFloat(document.getElementById('expense-amount').value);
      if (!amount || amount <= 0) { Toast.error('Ingresa un monto válido'); return; }
      await Expense.add({ type, amount, title, date, category });
    }
    Toast.success('Gasto guardado');
    closeModal();
    renderExpensePage();
    renderDashboard();
  });
}