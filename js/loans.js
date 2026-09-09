const Loan = {
  DIRECTION: {
    GIVEN: 'given',
    RECEIVED: 'received'
  },

  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    data.status = data.status || 'active';
    return DB.add(StoreNames.LOANS, data);
  },

  async getAll() {
    return DB.getAll(StoreNames.LOANS);
  },

  async update(id, data) {
    const record = await DB.get(StoreNames.LOANS, id);
    if (!record) return;
    await DB.put(StoreNames.LOANS, { ...record, ...data });
  },

  async delete(id) {
    return DB.delete(StoreNames.LOANS, id);
  },

  calculate(record) {
    const total = parseFloat(record.totalAmount || 0);
    const totalInstallments = parseInt(record.totalInstallments || 0);
    const paidInstallments = parseInt(record.paidInstallments || 0);
    const installmentValue = totalInstallments > 0 ? total / totalInstallments : 0;
    const remaining = total - (paidInstallments * installmentValue);
    const progress = totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;
    const isReceived = record.direction === Loan.DIRECTION.RECEIVED;
    return { total, totalInstallments, paidInstallments, installmentValue, remaining, progress, isReceived };
  }
};

function renderLoanPage() {
  const container = document.getElementById('page-loans');
  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Préstamos</h3></div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value stat-positive" id="loan-given">R$ 0,00</div>
          <div class="stat-label">Prestado a otros</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stat-negative" id="loan-received">R$ 0,00</div>
          <div class="stat-label">Debo a otros</div>
        </div>
      </div>
      <div class="stat-card" style="margin-top:12px">
        <div class="stat-value" id="loan-net">R$ 0,00</div>
        <div class="stat-label">Balance neto</div>
      </div>
    </div>
    <div id="loan-list"></div>
  `;

  Loan.getAll().then(records => {
    const list = document.getElementById('loan-list');
    if (records.length === 0) {
      list.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="icon">&#128179;</div>
            <p>No tienes préstamos registrados.<br>Toca el botón + para agregar.</p>
          </div>
        </div>`;
      return;
    }

    let totalGiven = 0;
    let totalReceived = 0;

    list.innerHTML = records.map(r => {
      const c = Loan.calculate(r);
      if (r.direction === Loan.DIRECTION.GIVEN) totalGiven += c.remaining;
      else totalReceived += c.remaining;

      const icon = c.isReceived ? '&#128181;' : '&#128182;';
      const directionLabel = c.isReceived ? 'He recibido' : 'He prestado';
      const dueBadge = r.dueDate && r.dueDate < new Date().toISOString().slice(0, 10) && r.status !== 'closed'
        ? '<span class="chip chip-danger" style="margin-left:4px">Vencido</span>'
        : '';
      const progressClass = c.remaining <= 0 ? 'success' : (c.progress > 60 ? 'warning' : 'danger');

      return `
        <div class="card">
          <div class="transaction-item" style="border:none; padding:0">
            <div class="transaction-icon" style="background: rgba(37,99,235,0.15)">${icon}</div>
            <div class="transaction-info">
              <div class="name">${esc(r.person || 'Persona')} ${r.status === 'closed' ? '<span class="chip chip-success">Cerrado</span>' : ''}</div>
              <div class="date">${directionLabel} · ${formatDate(r.date)} ${dueBadge}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:600">R$ ${c.remaining.toFixed(2).replace('.', ',')}</div>
              <div class="stat-label">pendiente de ${c.total.toFixed(2)}</div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${progressClass}" style="width:${c.progress}%"></div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.85rem">
            <span class="stat-label">Cuota: R$ ${c.installmentValue.toFixed(2)}</span>
            <span class="stat-label">${c.paidInstallments}/${c.totalInstallments} cuotas</span>
          </div>
          <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
            <button class="btn btn-sm btn-primary loan-pay" data-id="${r.id}" ${r.status === 'closed' || c.paidInstallments >= c.totalInstallments ? 'disabled' : ''}>&#10004; Pagar cuota</button>
            <button class="btn btn-sm btn-outline loan-edit" data-id="${r.id}">&#9998; Editar</button>
            <button class="btn btn-sm btn-danger loan-delete" data-id="${r.id}">&#128465;</button>
          </div>
        </div>`;
    }).join('');

    const net = totalGiven - totalReceived;
    const netColor = net >= 0 ? 'stat-positive' : 'stat-negative';
    document.getElementById('loan-given').textContent = `R$ ${totalGiven.toFixed(2).replace('.', ',')}`;
    document.getElementById('loan-received').textContent = `R$ ${totalReceived.toFixed(2).replace('.', ',')}`;
    document.getElementById('loan-net').innerHTML = `<span class="${netColor}">${net >= 0 ? '+' : ''}R$ ${net.toFixed(2).replace('.', ',')}</span>`;

    list.querySelectorAll('.loan-pay').forEach(btn => {
      if (btn.disabled) return;
      btn.addEventListener('click', async () => {
        const record = records.find(r => r.id === parseInt(btn.dataset.id));
        const c = Loan.calculate(record);
        const newPaid = c.paidInstallments + 1;
        const newStatus = newPaid >= c.totalInstallments ? 'closed' : record.status;
        await Loan.update(record.id, { paidInstallments: newPaid, status: newStatus });
        Toast.success(newStatus === 'closed' ? '¡Préstamo pagado por completo!' : 'Cuota registrada');
        renderLoanPage();
      });
    });
    list.querySelectorAll('.loan-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const record = records.find(r => r.id === parseInt(btn.dataset.id));
        if (record) showLoanModal(record);
      });
    });
    list.querySelectorAll('.loan-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        await Loan.delete(parseInt(btn.dataset.id));
        Toast.success('Préstamo eliminado');
        renderLoanPage();
      });
    });
  });
}

function showLoanModal(record = null) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = record ? 'Editar préstamo' : 'Nuevo préstamo';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Dirección</label>
      <select id="loan-direction">
        <option value="given" ${record && record.direction === 'given' ? 'selected' : ''}>He prestado a alguien</option>
        <option value="received" ${record && record.direction === 'received' ? 'selected' : ''}>Me han prestado a mí</option>
      </select>
    </div>
    <div class="form-group">
      <label>Persona</label>
      <input type="text" id="loan-person" value="${record ? esc(record.person) : ''}" placeholder="Nombre">
    </div>
    <div class="form-group">
      <label>Monto total (R$)</label>
      <input type="number" id="loan-total" step="0.01" value="${record ? record.totalAmount : ''}" placeholder="0.00">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Número de cuotas</label>
        <input type="number" id="loan-installments" min="1" value="${record ? record.totalInstallments : ''}" placeholder="0">
      </div>
      <div class="form-group">
        <label>Cuotas pagadas</label>
        <input type="number" id="loan-paid" min="0" value="${record ? record.paidInstallments : '0'}" placeholder="0">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Fecha inicio</label>
        <input type="date" id="loan-date" value="${record ? record.date : new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="form-group">
        <label>Vence (opcional)</label>
        <input type="date" id="loan-due" value="${record ? (record.dueDate || '') : ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Nota (opcional)</label>
      <input type="text" id="loan-note" value="${record ? esc(record.note || '') : ''}" placeholder="Ej: Préstamo para el auto">
    </div>
    <button class="btn btn-primary" id="loan-save">${record ? 'Guardar cambios' : 'Agregar préstamo'}</button>
  `;

  document.getElementById('loan-save').addEventListener('click', async () => {
    const data = {
      direction: document.getElementById('loan-direction').value,
      person: document.getElementById('loan-person').value.trim() || 'Persona',
      totalAmount: parseFloat(document.getElementById('loan-total').value) || 0,
      totalInstallments: parseInt(document.getElementById('loan-installments').value) || 1,
      paidInstallments: parseInt(document.getElementById('loan-paid').value) || 0,
      date: document.getElementById('loan-date').value,
      dueDate: document.getElementById('loan-due').value || null,
      note: document.getElementById('loan-note').value.trim()
    };

    if (data.totalAmount <= 0) { Toast.error('El monto debe ser mayor a 0'); return; }
    data.status = data.paidInstallments >= data.totalInstallments ? 'closed' : 'active';

    if (record) {
      await Loan.update(record.id, data);
      Toast.success('Préstamo actualizado');
    } else {
      await Loan.add(data);
      Toast.success('Préstamo agregado');
    }
    closeModal();
    renderLoanPage();
  });
}