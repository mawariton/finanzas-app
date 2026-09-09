const App = {
  currentPage: 'dashboard',
  currentModal: null,

  async init() {
    await DB.init();
    await Gold.initialize();

    const savedTheme = await DB.getSetting('theme', 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');

    App.setupTopbar();
    App.setupSidebar();
    App.setupModal();
    App.setupFab();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  setupTopbar() {
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('hidden');
    });

    document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

    document.getElementById('theme-toggle').addEventListener('click', async () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      await DB.setSetting('theme', next);
      App.navigate(App.currentPage);
    });
  },

  setupSidebar() {
    document.querySelectorAll('#sidebar li').forEach(li => {
      li.addEventListener('click', () => {
        App.navigate(li.dataset.page);
        closeSidebar();
      });
    });
  },

  setupModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
  },

  setupFab() {
    document.getElementById('fab').addEventListener('click', () => {
      switch (App.currentPage) {
        case 'income': showIncomeModal(); break;
        case 'expenses': showExpenseModal(); break;
        case 'investments': showInvestmentModal(); break;
        case 'loans': showLoanModal(); break;
        case 'dashboard':
        case 'gold':
        case 'settings':
          if (App.currentPage === 'gold') showGoldModal();
          break;
      }
    });
  },

  navigate(page) {
    App.currentPage = page;

    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');

    document.querySelectorAll('#sidebar li').forEach(li => {
      li.classList.toggle('active', li.dataset.page === page);
    });

    const titles = {
      dashboard: 'Dashboard',
      income: 'Ingresos',
      expenses: 'Gastos',
      investments: 'Inversiones',
      loans: 'Préstamos',
      gold: 'Oro',
      settings: 'Configuración'
    };
    document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

    const fabVisible = ['income', 'expenses', 'investments', 'loans', 'gold'].includes(page);
    document.getElementById('fab').style.display = fabVisible ? 'flex' : 'none';

    switch (page) {
      case 'dashboard': renderDashboard(); break;
      case 'income': renderIncomePage(); break;
      case 'expenses': renderExpensePage(); break;
      case 'investments': renderInvestmentPage(); break;
      case 'loans': renderLoanPage(); break;
      case 'gold': renderGoldPage(); break;
      case 'settings': renderSettingsPage(); break;
    }
  }
};

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}

function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

function showGoldModal() {
  openModal('Precio del oro', `
    <div class="form-group">
      <label>Precio por gramo (R$/g)</label>
      <input type="number" id="gold-price-input" step="0.01" placeholder="0.00">
    </div>
    <button class="btn btn-primary" id="gold-price-save">Guardar precio</button>
    <hr class="divider">
    <div class="form-group">
      <label>Conversión rápida</label>
      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group"><input type="number" id="gold-convert-input" step="0.001" placeholder="gramos"></div>
        <div class="form-group"><input type="number" id="gold-convert-output" step="0.01" placeholder="R$" readonly></div>
      </div>
      <p style="font-size:0.85rem; color:var(--text-muted)">1 g = R$ <span id="gold-convert-price">0,00</span></p>
    </div>
  `);

  Gold.getPricePerGram().then(price => {
    document.getElementById('gold-price-input').value = price;
    document.getElementById('gold-convert-price').textContent = price.toFixed(2).replace('.', ',');
  });

  document.getElementById('gold-price-save').addEventListener('click', async () => {
    const price = parseFloat(document.getElementById('gold-price-input').value);
    if (!price || price <= 0) { Toast.error('Ingresa un precio válido'); return; }
    await Gold.setPricePerGram(price);
    App.navigate('gold');
    Toast.success('Precio actualizado');
  });

  const convertInput = document.getElementById('gold-convert-input');
  convertInput.addEventListener('input', async () => {
    const grams = parseFloat(convertInput.value);
    const price = await Gold.getPricePerGram();
    document.getElementById('gold-convert-output').value = (grams * price).toFixed(2);
  });
}

async function renderDashboard() {
  const container = document.getElementById('page-dashboard');

  const [incomes, expenses, investments, loans, goldPrice] = await Promise.all([
    DB.getAll(StoreNames.INCOMES),
    DB.getAll(StoreNames.EXPENSES),
    DB.getAll(StoreNames.INVESTMENTS),
    DB.getAll(StoreNames.LOANS),
    Gold.getPricePerGram()
  ]);

  let totalIncomeBRL = 0;
  let totalIncomeGold = 0;
  for (const inc of incomes) {
    if (inc.type === 'gold') totalIncomeGold += parseFloat(inc.goldAmount || 0);
    else totalIncomeBRL += parseFloat(inc.amount || 0);
  }

  let totalExpenseBRL = 0;
  let totalExpenseGold = 0;
  for (const exp of expenses) {
    if (exp.type === 'gold') totalExpenseGold += parseFloat(exp.goldAmount || 0);
    else totalExpenseBRL += parseFloat(exp.amount || 0);
  }

  const goldIncomeBRL = totalIncomeGold * goldPrice;
  const goldExpenseBRL = totalExpenseGold * goldPrice;
  const netBRL = (totalIncomeBRL - totalExpenseBRL) + (goldIncomeBRL - goldExpenseBRL);
  const netGold = totalIncomeGold - totalExpenseGold;

  let totalInvested = 0;
  let totalCurrent = 0;
  for (const inv of investments) {
    totalInvested += parseFloat(inv.investedAmount || 0);
    totalCurrent += parseFloat(inv.currentAmount || 0);
  }
  const invProfit = totalCurrent - totalInvested;

  let totalLoanGiven = 0;
  let totalLoanReceived = 0;
  for (const loan of loans) {
    if (loan.status === 'closed') continue;
    const paid = parseFloat(loan.paidInstallments || 0);
    const total = parseFloat(loan.totalInstallments || 1);
    const totalAmount = parseFloat(loan.totalAmount || 0);
    const remaining = totalAmount * (1 - paid / total);
    if (loan.direction === 'given') totalLoanGiven += remaining;
    else totalLoanReceived += remaining;
  }

  const colorFor = v => v >= 0 ? 'stat-positive' : 'stat-negative';
  const fmt = v => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const now = new Date().toISOString().slice(0, 10);
  const today = now.slice(0, 7);

  const thisMonthIncome = incomes.filter(i => i.date?.startsWith(today)).reduce((s, i) => {
    return s + (i.type === 'gold' ? parseFloat(i.goldAmount || 0) * goldPrice : parseFloat(i.amount || 0));
  }, 0);

  const thisMonthExpense = expenses.filter(e => e.date?.startsWith(today)).reduce((s, e) => {
    return s + (e.type === 'gold' ? parseFloat(e.goldAmount || 0) * goldPrice : parseFloat(e.amount || 0));
  }, 0);

  const upcomingLoans = loans
    .filter(l => l.status !== 'closed' && l.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);

  const recentActivity = [
    ...incomes.map(i => ({ ...i, kind: 'income' })),
    ...expenses.map(e => ({ ...e, kind: 'expense' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value ${colorFor(netBRL)}">${fmt(netBRL)}</div>
        <div class="stat-label">Balance neto (BRL)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-gold">${netGold.toFixed(3)} g</div>
        <div class="stat-label">Balance en oro</div>
      </div>
    </div>

    <div class="stats-grid" style="margin-top:12px">
      <div class="stat-card">
        <div class="stat-value" style="color:var(--success)">${fmt(thisMonthIncome)}</div>
        <div class="stat-label">Ingresos del mes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--danger)">${fmt(thisMonthExpense)}</div>
        <div class="stat-label">Gastos del mes</div>
      </div>
    </div>

    <div class="stats-grid" style="margin-top:12px">
      <div class="stat-card">
        <div class="stat-value ${colorFor(invProfit)}">${invProfit >= 0 ? '+' : ''}${fmt(invProfit)}</div>
        <div class="stat-label">Inversiones (${Math.round((totalInvested > 0 ? invProfit / totalInvested * 100 : 0))}%)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--text)">${fmt(totalLoanGiven - totalLoanReceived)}</div>
        <div class="stat-label">Préstamos netos (${fmt(totalLoanGiven)}/${fmt(totalLoanReceived)})</div>
      </div>
    </div>

    ${upcomingLoans.length > 0 ? `
    <div class="card" style="margin-top:12px">
      <div class="card-header"><h3>&#128197; Próximos vencimientos</h3></div>
      <ul class="transaction-list">
        ${upcomingLoans.map(l => `
          <li class="transaction-item">
            <div class="transaction-icon" style="background: rgba(245,158,11,0.15)">&#128197;</div>
            <div class="transaction-info">
              <div class="name">${esc(l.person || 'Préstamo')}</div>
              <div class="date">Vence: ${formatDate(l.dueDate)} ${l.dueDate < now ? '<span class="chip chip-danger">Vencido</span>' : ''}</div>
            </div>
            <div class="transaction-amount">R$ ${parseFloat(l.totalAmount || 0).toFixed(2)}</div>
          </li>`).join('')}
      </ul>
    </div>` : ''}

    <div class="card" style="margin-top:12px">
      <div class="card-header">
        <h3>&#128200; Actividad reciente</h3>
        <button class="btn btn-sm btn-outline" id="dash-view-all">Ver todo</button>
      </div>
      ${recentActivity.length > 0 ? `
        <ul class="transaction-list">
          ${recentActivity.map(a => {
            const isGold = a.type === 'gold';
            const value = isGold
              ? `${parseFloat(a.goldAmount).toFixed(3)} g`
              : `R$ ${parseFloat(a.amount).toFixed(2).replace('.', ',')}`;
            const icon = a.kind === 'income' ? (isGold ? '&#129351;' : '&#8595;') : (isGold ? '&#129351;' : '&#8593;');
            const bg = a.kind === 'income' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
            return `
              <li class="transaction-item">
                <div class="transaction-icon" style="background:${bg}">${icon}</div>
                <div class="transaction-info">
                  <div class="name">${esc(a.title || (a.kind === 'income' ? 'Ingreso' : 'Gasto'))}</div>
                  <div class="date">${formatDate(a.date)} · ${a.kind === 'income' ? 'Ingreso' : 'Gasto'}</div>
                </div>
                <div class="transaction-amount ${a.kind === 'income' ? 'income' : 'expense'}">
                  ${isGold ? `<span class="chip chip-gold">${value}</span>` : (a.kind === 'income' ? '+' : '-') + value}
                </div>
              </li>`;
          }).join('')}
        </ul>` : `
        <div class="empty-state">
          <div class="icon">&#128200;</div>
          <p>Sin actividad todavía.<br>Empieza registrando un ingreso o gasto.</p>
        </div>`}
    </div>

    <div class="card">
      <div class="card-header">
        <h3>&#128279; Distribución de gastos</h3>
      </div>
      <div class="chart-container"><canvas id="dash-expense-pie"></canvas></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>&#128202; Ingresos mensuales</h3>
      </div>
      <div class="chart-container"><canvas id="dash-income-bar"></canvas></div>
    </div>
  `;

  document.getElementById('dash-view-all')?.addEventListener('click', () => App.navigate('expenses'));

  const visibleExpenses = expenses.filter(e =>
    e.date && e.date >= `${(parseInt(today.slice(0,4)))}-01-01`
  );
  await Charts.renderExpensePie('dash-expense-pie', visibleExpenses);
  await Charts.renderMonthlyBar('dash-income-bar', incomes, 'income');
}

function renderGoldPage() {
  const container = document.getElementById('page-gold');

  Gold.getPricePerGram().then(async price => {
    const [incomes, expenses] = await Promise.all([
      DB.getAll(StoreNames.INCOMES),
      DB.getAll(StoreNames.EXPENSES)
    ]);

    let totalGoldIn = 0;
    let totalGoldOut = 0;
    for (const inc of incomes) {
      if (inc.type === 'gold') totalGoldIn += parseFloat(inc.goldAmount || 0);
      else totalGoldIn += parseFloat(inc.amount || 0) / price;
    }
    for (const exp of expenses) {
      if (exp.type === 'gold') totalGoldOut += parseFloat(exp.goldAmount || 0);
      else totalGoldOut += parseFloat(exp.amount || 0) / price;
    }

    const netGold = totalGoldIn - totalGoldOut;
    const netBRL = netGold * price;

    const goldTransactions = [
      ...incomes.map(i => ({ ...i, kind: 'income' })),
      ...expenses.map(e => ({ ...e, kind: 'expense' }))
    ].filter(t => t.type === 'gold' || true)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>&#129351; Valor del oro</h3>
          <button class="btn btn-sm btn-outline" id="gold-edit-price">&#9998; Editar</button>
        </div>
        <div class="stat-value stat-gold">R$ ${price.toFixed(2).replace('.', ',')}</div>
        <div class="stat-label">precio por gramo (configurable)</div>
        <hr class="divider">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value stat-positive">${totalGoldIn.toFixed(3)} g</div>
            <div class="stat-label">Oro recibido</div>
          </div>
          <div class="stat-card">
            <div class="stat-value stat-negative">${totalGoldOut.toFixed(3)} g</div>
            <div class="stat-label">Oro gastado</div>
          </div>
        </div>
        <div class="stat-card" style="margin-top:12px">
          <div class="stat-value stat-gold">${netGold.toFixed(3)} g</div>
          <div class="stat-label">Balance neto en oro (= R$ ${netBRL.toFixed(2).replace('.', ',')})</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Transacciones de oro</h3></div>
        <ul class="transaction-list">
          ${goldTransactions.length > 0 ? goldTransactions.map(t => {
            const isIn = t.kind === 'income';
            const showInGold = t.type === 'gold';
            const value = showInGold
              ? `${parseFloat(t.goldAmount).toFixed(3)} g`
              : `=/ ${parseFloat(t.amount).toFixed(2)} BRL`;
            return `
              <li class="transaction-item">
                <div class="transaction-icon" style="background:${isIn ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}">&#129351;</div>
                <div class="transaction-info">
                  <div class="name">${esc(t.title || (isIn ? 'Ingreso' : 'Gasto'))}</div>
                  <div class="date">${formatDate(t.date)} · ${isIn ? 'Ingreso' : 'Gasto'}</div>
                </div>
                <div class="transaction-amount ${isIn ? 'income' : 'expense'}">
                  ${isIn ? '+' : '-'}${showInGold ? `${parseFloat(t.goldAmount).toFixed(3)} g` : `R$ ${parseFloat(t.amount).toFixed(2)}`}
                </div>
              </li>`;
          }).join('') : `
            <div class="empty-state">
              <div class="icon">&#129351;</div>
              <p>No hay transacciones de oro aún.</p>
            </div>`}
        </ul>
      </div>
    `;

    document.getElementById('gold-edit-price').addEventListener('click', () => {
      App.navigate('gold');
      showGoldModal();
    });
  });
}

function renderSettingsPage() {
  const container = document.getElementById('page-settings');

  DB.getSetting('goldPricePerGram', 400).then(goldPrice => {
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>&#9881; Ajustes generales</h3></div>

        <div class="settings-item">
          <label for="theme-mode">Modo oscuro</label>
          <input type="checkbox" id="theme-mode" ${document.documentElement.getAttribute('data-theme') === 'dark' ? 'checked' : ''}>
        </div>

        <div class="settings-item">
          <label for="gold-price-setting">Precio del oro (R$/g)</label>
          <input type="number" id="gold-price-setting" value="${goldPrice}" step="0.01">
        </div>

        <button class="btn btn-primary" id="settings-save" style="margin-top:8px">Guardar ajustes</button>
      </div>

      <div class="card">
        <div class="card-header"><h3>&#128230; Datos</h3></div>
        <div style="display:flex; flex-direction:column; gap:8px">
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px">
            Los datos se guardan 100% en este teléfono. Puedes exportar un respaldo para guardarlo seguro.
          </p>
          <button class="btn btn-outline" id="btn-export">&#11015; Exportar respaldo (JSON)</button>
          <button class="btn btn-outline" id="btn-import">&#11014; Restaurar respaldo</button>
          <input type="file" id="import-file" accept=".json" style="display:none">
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>&#128273; Datos peligrosos</h3></div>
        <button class="btn btn-danger" id="btn-reset">&#9888; Borrar todos los datos</button>
      </div>
    `;

    document.getElementById('theme-mode').addEventListener('change', async e => {
      const theme = e.target.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      await DB.setSetting('theme', theme);
    });

    document.getElementById('settings-save').addEventListener('click', async () => {
      const price = parseFloat(document.getElementById('gold-price-setting').value);
      if (!price || price <= 0) { Toast.error('Precio de oro inválido'); return; }
      await Gold.setPricePerGram(price);
      Toast.success('Ajustes guardados');
      renderSettingsPage();
    });

    document.getElementById('btn-export').addEventListener('click', async () => {
      const data = await DB.exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      Toast.success('Respaldo exportado');
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const confirmMsg = '¿Restaurar respaldo? Los datos actuales se mezclarán con el respaldo.';
        if (!confirm(confirmMsg)) return;
        await DB.importAll(data);
        Toast.success('Respaldo restaurado');
        App.navigate('dashboard');
      } catch (err) {
        Toast.error('Archivo de respaldo inválido');
      }
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
      if (!confirm('¿Seguro? Esto borrará TODOS tus datos. Esta acción no se puede deshacer.')) return;
      for (const name of [StoreNames.INCOMES, StoreNames.EXPENSES, StoreNames.INVESTMENTS, StoreNames.LOANS]) {
        await DB.clear(name);
      }
      Toast.success('Datos borrados');
      App.navigate('dashboard');
    });
  });
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const Toast = {
  success(msg) {
    Toast.show(msg, 'success', '&#10004; ');
  },
  error(msg) {
    Toast.show(msg, 'error', '&#10060; ');
  },
  info(msg) {
    Toast.show(msg, 'info', '&#10005; ');
  },
  show(msg, type, icon) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon}${esc(msg)}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());