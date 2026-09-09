const Loan = {
  async add(data) {
    data.date = data.date || new Date().toISOString().slice(0, 10);
    return DB.add(StoreNames.LOANS, data);
  },
  async getAll() {
    return DB.getAll(StoreNames.LOANS);
  },
  async update(id, data) {
    const rec = await DB.get(StoreNames.LOANS, id);
    if (rec) await DB.put(StoreNames.LOANS, { ...rec, ...data });
  },
  async delete(id) {
    return DB.delete(StoreNames.LOANS, id);
  },
  calc(rec) {
    const total = parseFloat(rec.totalAmount) || 0;
    const ni = parseInt(rec.totalInstallments) || 1;
    const np = parseInt(rec.paidInstallments) || 0;
    const cuota = total / ni;
    return {
      total, ni, np, cuota,
      remaining: total - np * cuota,
      progress: Math.min((np / ni) * 100, 100)
    };
  }
};

async function renderLoanPage() {
  const container = document.getElementById('page-loans');
  const records = await Loan.getAll();

  const agg = records.filter(r => r.status !== 'closed').reduce((a, r) => {
    const c = Loan.calc(r);
    if (r.direction === 'given') a.given += c.remaining;
    else a.received += c.remaining;
    return a;
  }, { given: 0, received: 0 });
  const net = agg.given - agg.received;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value stat-positive">${App.mask(fmtBRL(agg.given))}</div>
        <div class="stat-label">Prestado a otros</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-negative">${App.mask(fmtBRL(agg.received))}</div>
        <div class="stat-label">Debo a otros</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="stat-value ${net >= 0 ? 'stat-positive' : 'stat-negative'}">${App.mask((net >= 0 ? '+' : '') + fmtBRL(net))}</div>
      <div class="stat-label">Balance neto de préstamos</div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Préstamos</h3></div>
      ${records.length === 0 ? `
        <div class="empty-state"><div class="icon">&#128179;</div><p>Sin préstamos registrados.</p></div>` : records.map(r => loanCard(r)).join('')}
    </div>
  `;

  const now = new Date().toISOString().slice(0, 10);

  container.querySelectorAll('.loan-pay').forEach(b => {
    if (b.disabled) return;
    b.addEventListener('click', async () => {
      const rec = records.find(r => r.id === parseInt(b.dataset.id));
      const c = Loan.calc(rec);
      const np = c.np + 1;
      const closed = np >= c.ni ? 'closed' : 'active';
      await Loan.update(rec.id, { paidInstallments: np, status: closed });
      Toast.success(closed === 'closed' ? '¡Préstamo liquidado!' : 'Cuota registrada');
      renderLoanPage();
    });
  });
  container.querySelectorAll('.loan-edit').forEach(b => {
    b.addEventListener('click', () => {
      const rec = records.find(r => r.id === parseInt(b.dataset.id));
      if (rec) showLoanModal(rec);
    });
  });
  container.querySelectorAll('.loan-delete').forEach(b => {
    b.addEventListener('click', async () => {
      await Loan.delete(parseInt(b.dataset.id));
      Toast.success('Préstamo eliminado');
      renderLoanPage();
    });
  });
}

function loanCard(r) {
  const c = Loan.calc(r);
  const isGiven = r.direction === 'given';
  const now = new Date().toISOString().slice(0, 10);
  const overdue = r.dueDate && r.dueDate < now && r.status !== 'closed';
  const fillCls = c.remaining <= 0 ? 'ok' : c.progress >= 60 ? 'ok' : c.progress >= 30 ? 'warn' : 'over';
  return `
    <div style="padding:14px 0; border-bottom:1px solid var(--border)">
      <div style="display:flex; align-items:center; gap:12px">
        <div class="tx-icon" style="background:${isGiven ? 'var(--positive-bg)' : 'var(--negative-bg)'}">${isGiven ? '&#128182;' : '&#128181;'}</div>
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:center; gap:6px">
            <span class="name" style="font-weight:600; font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${esc(r.person || 'Persona')}</span>
            ${r.status === 'closed' ? '<span class="chip" style="background:var(--positive-bg); color:var(--positive)">Cerrado</span>' : ''}
            ${overdue ? '<span class="chip" style="background:var(--negative-bg); color:var(--negative)">Vencido</span>' : ''}
          </div>
          <div class="date" style="font-size:0.75rem; color:var(--text-muted)">${isGiven ? 'Presté' : 'Me prestaron'} · ${formatDate(r.date)}${r.dueDate ? ' · vence ' + formatDate(r.dueDate) : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:650">${App.mask(fmtBRL(c.remaining))}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">de ${App.mask(fmtBRL(c.total))}</div>
        </div>
      </div>
      <div class="budget-track"><div class="budget-fill ${fillCls}" style="width:${c.progress}%"></div></div>
      <div class="budget-caption">
        <span>Cuota: ${App.mask(fmtBRL(c.cuota))}</span>
        <span>${c.np}/${c.ni} cuotas</span>
      </div>
      <div class="inv-actions">
        <button class="btn btn-sm btn-dark loan-pay" data-id="${r.id}" ${r.status === 'closed' || c.np >= c.ni ? 'disabled style="opacity:0.4"' : ''}>&#10003; Pagar cuota</button>
        <button class="btn btn-sm btn-ghost loan-edit" data-id="${r.id}">&#9998;</button>
        <button class="btn btn-sm btn-danger loan-delete" data-id="${r.id}">&#128465;</button>
      </div>
    </div>`;
}

function showLoanModal(record = null) {
  openSheet(record ? 'Editar préstamo' : 'Nuevo préstamo', `
    <div class="form-group">
      <label>Dirección</label>
      <select id="loan-direction">
        <option value="given" ${record && record.direction === 'given' ? 'selected' : ''}>Yo presté</option>
        <option value="received" ${record && record.direction === 'received' ? 'selected' : ''}>A mí me prestaron</option>
      </select>
    </div>
    <div class="form-group">
      <label>Persona</label>
      <input type="text" id="loan-person" value="${record ? esc(record.person) : ''}" placeholder="Nombre">
    </div>
    <div class="form-group">
      <label>Monto total (R$)</label>
      <input type="number" id="loan-total" step="0.01" value="${record ? record.totalAmount : ''}" inputmode="decimal">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Cuotas</label>
        <input type="number" id="loan-installments" min="1" value="${record ? record.totalInstallments : ''}">
      </div>
      <div class="form-group">
        <label>Cuotas pagadas</label>
        <input type="number" id="loan-paid" min="0" value="${record ? record.paidInstallments : '0'}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Fecha inicio</label>
        <input type="date" id="loan-date" value="${record ? record.date : new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="form-group">
        <label>Vence</label>
        <input type="date" id="loan-due" value="${record && record.dueDate ? record.dueDate : ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Nota</label>
      <input type="text" id="loan-note" value="${record ? esc(record.note || '') : ''}" placeholder="Opcional">
    </div>
    <button class="btn btn-dark" id="loan-save">${record ? 'Guardar cambios' : 'Agregar préstamo'}</button>
  `);

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
    closeSheet();
    renderLoanPage();
  });
}