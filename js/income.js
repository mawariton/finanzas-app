const Income = {
  ICONS: {
    brl: '&#128176;',
    gold: '&#129351;'
  },

  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    if (data.type === 'gold') {
      data.goldAmount = parseFloat(data.goldAmount) || 0;
      data.brlEquivalent = await Gold.goldToBRL(data.goldAmount);
    } else {
      data.amount = parseFloat(data.amount) || 0;
      data.brlEquivalent = null;
    }
    return DB.add(StoreNames.INCOMES, data);
  },

  async getAll() {
    return DB.getAll(StoreNames.INCOMES);
  },

  async getMonthlyTotal(year, month) {
    const all = await DB.getAll(StoreNames.INCOMES);
    let totalBRL = 0;
    let totalGold = 0;
    for (const inc of all) {
      if (inc.type === 'gold') totalGold += parseFloat(inc.goldAmount || 0);
      if (inc.type === 'brl') totalBRL += parseFloat(inc.amount || 0);
    }
    return { totalBRL, totalGold };
  },

  async delete(id) {
    return DB.delete(StoreNames.INCOMES, id);
  },

  getMonthlySummary(records) {
    const byMonth = {};
    for (const r of records) {
      const key = r.date ? r.date.slice(0, 7) : 'unknown';
      if (!byMonth[key]) byMonth[key] = { brl: 0, gold: 0 };
      if (r.type === 'gold') byMonth[key].gold += parseFloat(r.goldAmount || 0);
      else byMonth[key].brl += parseFloat(r.amount || 0);
    }
    return byMonth;
  }
};

function renderIncomePage() {
  const container = document.getElementById('page-income');
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Resumen de ingresos</h3></div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="income-total-brl">R$ 0,00</div>
          <div class="stat-label">Total en BRL</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stat-gold" id="income-total-gold">0,000 g</div>
          <div class="stat-label">Total en Oro</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Ingresos registrados</h3>
        <button class="btn btn-sm btn-primary" id="income-refresh">&#8635;</button>
      </div>
      <ul class="transaction-list" id="income-list"></ul>
    </div>
  `;

  document.getElementById('income-refresh').addEventListener('click', renderIncomePage);

  Income.getAll().then(records => {
    const summary = Income.getMonthlySummary(records);
    let totalBRL = 0;
    let totalGold = 0;
    for (const key in summary) {
      totalBRL += summary[key].brl;
      totalGold += summary[key].gold;
    }

    document.getElementById('income-total-brl').textContent = `R$ ${totalBRL.toFixed(2).replace('.', ',')}`;
    document.getElementById('income-total-gold').textContent = `${totalGold.toFixed(3)} g`;

    const list = document.getElementById('income-list');
    if (records.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">&#128176;</div>
          <p>Aún no has registrado ingresos.<br>Toca el botón + para agregar.</p>
        </div>`;
      return;
    }

    const sorted = [...records].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    list.innerHTML = sorted.map(r => `
      <li class="transaction-item">
        <div class="transaction-icon" style="background: ${r.type === 'gold' ? 'rgba(234,179,8,0.15)' : 'rgba(37,99,235,0.15)'}">${Income.ICONS[r.type] || '&#128176;'}</div>
        <div class="transaction-info">
          <div class="name">${esc(r.title || 'Ingreso')}</div>
          <div class="date">${formatDate(r.date)} ${r.category ? '· ' + esc(r.category) : ''}</div>
        </div>
        <div class="transaction-amount income">
          ${r.type === 'gold'
            ? `<span class="chip chip-gold">${parseFloat(r.goldAmount).toFixed(3)} g</span>`
            : `R$ ${parseFloat(r.amount).toFixed(2).replace('.', ',')}`}
        </div>
        <button class="btn btn-sm btn-outline income-delete" data-id="${r.id}">&#128465;</button>
      </li>
    `).join('');

    list.querySelectorAll('.income-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        await Income.delete(parseInt(btn.dataset.id));
        Toast.success('Ingreso eliminado');
        renderIncomePage();
      });
    });
  });
}

function showIncomeModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Nuevo ingreso';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Tipo de ingreso</label>
      <select id="income-type">
        <option value="brl">BRL (R$)</option>
        <option value="gold">Oro (gramos)</option>
      </select>
    </div>
    <div class="form-group income-field" id="income-field-brl">
      <label>Monto (R$)</label>
      <input type="number" id="income-amount" step="0.01" placeholder="0.00">
    </div>
    <div class="form-group income-field" style="display:none" id="income-field-gold">
      <label>Gramos de oro</label>
      <input type="number" id="income-gold" step="0.001" placeholder="0.000">
    </div>
    <div class="form-group">
      <label>Concepto</label>
      <input type="text" id="income-title" placeholder="Ej: Nómina mensual">
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="date" id="income-date" value="${new Date().toISOString().slice(0, 10)}">
    </div>
    <button class="btn btn-primary" id="income-save">Guardar ingreso</button>
  `;

  const typeSelect = document.getElementById('income-type');
  const toggleFields = () => {
    const isGold = typeSelect.value === 'gold';
    document.getElementById('income-field-brl').style.display = isGold ? 'none' : 'block';
    document.getElementById('income-field-gold').style.display = isGold ? 'block' : 'none';
  };
  typeSelect.addEventListener('change', toggleFields);
  toggleFields();

  document.getElementById('income-save').addEventListener('click', async () => {
    const type = typeSelect.value;
    const title = document.getElementById('income-title').value.trim() || 'Ingreso';
    const date = document.getElementById('income-date').value;

    if (type === 'gold') {
      const grams = parseFloat(document.getElementById('income-gold').value);
      if (!grams || grams <= 0) { Toast.error('Ingresa gramos válidos'); return; }
      await Income.add({ type, goldAmount: grams, title, date });
    } else {
      const amount = parseFloat(document.getElementById('income-amount').value);
      if (!amount || amount <= 0) { Toast.error('Ingresa un monto válido'); return; }
      await Income.add({ type, amount, title, date });
    }
    Toast.success('Ingreso guardado');
    closeModal();
    renderIncomePage();
    renderDashboard();
  });
}