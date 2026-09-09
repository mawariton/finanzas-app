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

  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    return DB.add(StoreNames.INVESTMENTS, data);
  },

  async getAll() {
    return DB.getAll(StoreNames.INVESTMENTS);
  },

  async update(id, data) {
    const record = await DB.get(StoreNames.INVESTMENTS, id);
    if (!record) return;
    await DB.put(StoreNames.INVESTMENTS, { ...record, ...data });
  },

  async delete(id) {
    return DB.delete(StoreNames.INVESTMENTS, id);
  },

  calculate(result) {
    const invested = parseFloat(result.investedAmount || 0);
    const current = parseFloat(result.currentAmount || 0);
    const diff = current - invested;
    const percent = invested > 0 ? (diff / invested) * 100 : 0;
    return { invested, current, diff, percent };
  }
};

function renderInvestmentPage() {
  const container = document.getElementById('page-investments');
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Inversiones</h3></div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="inv-total-invested">R$ 0,00</div>
          <div class="stat-label">Total invertido</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="inv-total-current">R$ 0,00</div>
          <div class="stat-label">Valor actual</div>
        </div>
      </div>
      <div class="stat-card" style="margin-top:12px">
        <div class="stat-value" id="inv-total-profit">R$ 0,00 (0%)</div>
        <div class="stat-label">Ganancia / Pérdida total</div>
      </div>
    </div>
    <div id="investment-list"></div>
  `;

  Investment.getAll().then(records => {
    const list = document.getElementById('investment-list');
    if (records.length === 0) {
      list.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="icon">&#128178;</div>
            <p>No tienes inversiones registradas.<br>Toca el botón + para agregar.</p>
          </div>
        </div>`;
      return;
    }

    let totalInvested = 0;
    let totalCurrent = 0;

    list.innerHTML = records.map(r => {
      const calc = Investment.calculate(r);
      totalInvested += calc.invested;
      totalCurrent += calc.current;
      const icon = Investment.TYPES.find(t => t.name === r.type)?.icon || '&#128203;';
      const color = calc.diff >= 0 ? 'stat-positive' : 'stat-negative';
      return `
        <div class="card">
          <div class="transaction-item" style="border:none; padding:0">
            <div class="transaction-icon" style="background: rgba(37,99,235,0.15)">${icon}</div>
            <div class="transaction-info">
              <div class="name">${esc(r.name || 'Inversión')}</div>
              <div class="date">${r.type || ''} · desde ${formatDate(r.date)}</div>
            </div>
            <div style="text-align:right">
              <div class="${color}" style="font-weight:600">${calc.diff >= 0 ? '+' : ''}${calc.diff.toFixed(2)}</div>
              <div class="stat-label">${calc.percent >= 0 ? '+' : ''}${calc.percent.toFixed(1)}%</div>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid var(--border); font-size:0.85rem">
            <span class="stat-label">Invertido: R$ ${calc.invested.toFixed(2)}</span>
            <span class="stat-label">Actual: R$ ${calc.current.toFixed(2)}</span>
          </div>
          <div style="display:flex; gap:8px; margin-top:12px">
            <button class="btn btn-sm btn-outline inv-update" data-id="${r.id}">&#9998; Actualizar</button>
            <button class="btn btn-sm btn-danger inv-delete" data-id="${r.id}">&#128465; Eliminar</button>
          </div>
        </div>`;
    }).join('');

    const totalDiff = totalCurrent - totalInvested;
    const totalPct = totalInvested > 0 ? (totalDiff / totalInvested) * 100 : 0;
    const color = totalDiff >= 0 ? 'stat-positive' : 'stat-negative';

    document.getElementById('inv-total-invested').textContent = `R$ ${totalInvested.toFixed(2).replace('.', ',')}`;
    document.getElementById('inv-total-current').textContent = `R$ ${totalCurrent.toFixed(2).replace('.', ',')}`;
    document.getElementById('inv-total-profit').innerHTML = `<span class="${color}">${totalDiff >= 0 ? '+' : ''}R$ ${totalDiff.toFixed(2).replace('.', ',')} (${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(1)}%)</span>`;

    list.querySelectorAll('.inv-update').forEach(btn => {
      btn.addEventListener('click', () => {
        const record = records.find(r => r.id === parseInt(btn.dataset.id));
        if (record) showInvestmentModal(record);
      });
    });
    list.querySelectorAll('.inv-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        await Investment.delete(parseInt(btn.dataset.id));
        Toast.success('Inversión eliminada');
        renderInvestmentPage();
        renderDashboard();
      });
    });
  });
}

function showInvestmentModal(record = null) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = record ? 'Actualizar inversión' : 'Nueva inversión';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Tipo</label>
      <select id="inv-type">
        ${Investment.TYPES.map(t => `<option value="${t.name}" ${record && record.type === t.name ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="inv-name" value="${record ? esc(record.name) : ''}" placeholder="Ej: Petrobras, Bitcoin...">
    </div>
    <div class="form-group">
      <label>Monto invertido (R$)</label>
      <input type="number" id="inv-invested" step="0.01" value="${record ? record.investedAmount : ''}" placeholder="0.00">
    </div>
    <div class="form-group">
      <label>Valor actual (R$)</label>
      <input type="number" id="inv-current" step="0.01" value="${record ? record.currentAmount : ''}" placeholder="0.00">
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="date" id="inv-date" value="${record ? record.date : new Date().toISOString().slice(0, 10)}">
    </div>
    <button class="btn btn-primary" id="inv-save">${record ? 'Guardar cambios' : 'Agregar inversión'}</button>
  `;

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
    closeModal();
    renderInvestmentPage();
    renderDashboard();
  });
}