/* ============ Dashboard (Hero Balance) ============ */
let heroCurrency = 'brl';

async function renderDashboard() {
  const container = document.getElementById('page-dashboard');
  const [incomes, expenses, investments, loans, goldPrice] = await Promise.all([
    DB.getAll(StoreNames.INCOMES),
    DB.getAll(StoreNames.EXPENSES),
    DB.getAll(StoreNames.INVESTMENTS),
    DB.getAll(StoreNames.LOANS),
    Gold.getPricePerGram()
  ]);
  const includeInvestments = await DB.getSetting('includeInvestments', false);

  const ym = currentMonthKey();

  const sum = (arr, fn) => arr.reduce((s, r) => s + fn(r), 0);
  const goldOf = r => Gold.isGold(r) ? (parseFloat(r.goldAmount) || 0) : 0;
  const brlOf = r => Gold.isGold(r) ? goldOf(r) * goldPrice : (parseFloat(r.amount) || 0);

  const totalInBRL = sum(incomes, brlOf);
  const totalOutBRL = sum(expenses, brlOf);
  const totalInGold = sum(incomes, goldOf);
  const totalOutGold = sum(expenses, goldOf);
  const invBRL = sum(investments, r => parseFloat(r.investedAmount) || 0);
  const invGold = sum(investments, r => (parseFloat(r.investedAmount) || 0) / goldPrice);
  const netBRL = totalInBRL - totalOutBRL - (includeInvestments ? invBRL : 0);
  const netGold = totalInGold - totalOutGold - (includeInvestments ? invGold : 0);

  const monthIn = sum(incomes.filter(i => monthKey(i.date) === ym), brlOf);
  const monthOut = sum(expenses.filter(e => monthKey(e.date) === ym), brlOf);

  const cfg = await Budget.get();
  const spent = await Budget.monthSpent(expenses, ym);
  const st = Budget.status(spent.total, cfg.total);
  const hasBudget = cfg.total > 0;

  const heroValue = heroCurrency === 'gold'
    ? App.mask(fmtGrams(netGold))
    : App.mask(fmtBRL(netBRL));
  const heroSub = heroCurrency === 'gold' ? App.mask(fmtBRL(netGold * goldPrice)) : App.mask(fmtGrams(netGold));

  const upcoming = loans
    .filter(l => l.status !== 'closed' && l.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const now = new Date().toISOString().slice(0, 10);

  const recent = [...incomes.map(i => ({ ...i, kind: 'income' })), ...expenses.map(e => ({ ...e, kind: 'expense' }))]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 6);

  container.innerHTML = `
    <div class="hero">
      <div class="hero-top">
        <div class="hero-label">BALANCE TOTAL</div>
        <button class="hero-eye" id="hero-eye">${App.state.hide ? '&#128064;' : '&#128065;'}</button>
      </div>
      <div class="hero-amount num" id="hero-amount">${heroValue}</div>
      <div class="hero-row">
        <button class="chip ${heroCurrency === 'brl' ? 'chip-gold' : ''}" id="hero-toggle">
          ${heroCurrency === 'brl' ? '&#128176; BRL' : '&#129351; Oro'}
        </button>
        <span style="color:rgba(245,245,247,0.5); font-size:0.8rem; font-weight:500" id="hero-sub">≈ ${heroSub}</span>
      </div>
      <div class="hero-mini">
        <div>
          <div class="hm-value" style="color:${monthIn >= 0 ? '#7fc99a' : '#f5f5f7'}">${App.mask(fmtBRL(monthIn))}</div>
          <div class="hm-label">Ingresos del mes</div>
        </div>
        <div>
          <div class="hm-value" style="color:${monthOut > 0 ? '#e88f8f' : '#f5f5f7'}">${App.mask(fmtBRL(monthOut))}</div>
          <div class="hm-label">Gastos del mes</div>
        </div>
        ${hasBudget ? `<div style="flex:1">
          <div class="hm-value">${Math.round(st.pct)}%</div>
          <div class="hm-label">Presupuesto usado</div>
          <div class="budget-track" style="margin-top:6px; background:rgba(255,255,255,0.15)"><div class="budget-fill ${st.cls}" style="width:${st.pct}%"></div></div>
        </div>` : ''}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value ${netBRL >= 0 ? 'stat-positive' : 'stat-negative'}">${App.mask(fmtBRL(netBRL))}</div>
        <div class="stat-label">Balance en BRL</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-gold">${App.mask(fmtGrams(netGold))}</div>
        <div class="stat-label">Balance en oro</div>
      </div>
    </div>

    ${upcoming.length ? `
      <div class="card">
        <div class="card-header"><h3>Próximos vencimientos</h3></div>
        <ul class="tx-list">${upcoming.map(l => `
          <li class="tx-item">
            <div class="tx-main">
              <div class="tx-icon">&#128197;</div>
              <div class="tx-info">
                <div class="name">${esc(l.person || 'Préstamo')}</div>
                <div class="date">Vence ${formatDate(l.dueDate)}${l.dueDate < now ? ' <span class="chip" style="background:var(--negative-bg); color:var(--negative)">Vencido</span>' : ''}</div>
              </div>
              <div class="tx-amount">${App.mask(fmtBRL(l.totalAmount))}</div>
            </div>
          </li>`).join('')}</ul>
      </div>` : ''}

    <div class="card">
      <div class="card-header"><h3>Actividad reciente</h3></div>
      ${recent.length === 0 ? `
        <div class="empty-state"><div class="icon">&#128200;</div><p>Sin actividad todavía.<br>Toca + para empezar.</p></div>` : `
        <ul class="tx-list">${recent.map(a => {
          const isGold = Gold.isGold(a);
          const val = isGold ? App.mask(fmtGrams(a.goldAmount)) : App.mask(fmtBRL(a.amount));
          const icon = isGold ? '&#129351;' : (a.kind === 'income' ? '&#8600;' : '&#8599;');
          return `
            <li class="tx-item">
              <div class="tx-swipe-bg" data-kind="${a.kind}" data-id="${a.id}">&#128465;</div>
              <div class="tx-main" data-kind="${a.kind}" data-id="${a.id}">
                <div class="tx-icon" style="background:${a.kind === 'income' ? 'var(--positive-bg)' : 'var(--negative-bg)'}">${icon}</div>
                <div class="tx-info">
                  <div class="name">${esc(a.title || (a.kind === 'income' ? 'Ingreso' : 'Gasto'))}</div>
                  <div class="date">${formatDate(a.date)} · ${a.kind === 'income' ? 'Ingreso' : 'Gasto'}</div>
                </div>
                <div class="tx-amount ${a.kind === 'income' ? 'income' : 'expense'}">${isGold ? `<span class="chip chip-gold">${val}</span>` : (a.kind === 'income' ? '+' : '-') + ' ' + val}</div>
              </div>
            </li>`;
        }).join('')}</ul>`}
    </div>

    <div class="card">
      <div class="card-header"><h3>Gastos por categoría</h3></div>
      <div class="chart-container"><canvas id="dash-donut"></canvas></div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Ingresos mensuales</h3></div>
      <div class="chart-container bar"><canvas id="dash-bars"></canvas></div>
    </div>
  `;

  document.getElementById('hero-eye').addEventListener('click', async () => {
    App.state.hide = !App.state.hide;
    await DB.setSetting('hideAmounts', App.state.hide);
    App.syncHeaderButtons();
    renderDashboard();
  });

  document.getElementById('hero-toggle').addEventListener('click', () => {
    heroCurrency = heroCurrency === 'brl' ? 'gold' : 'brl';
    renderDashboard();
  });

  Swipe.init(container, async el => {
    const kind = el.dataset.kind;
    const id = parseInt(el.dataset.id);
    if (kind === 'income') await Income.delete(id);
    else await Expense.delete(id);
    Toast.success(kind === 'income' ? 'Ingreso eliminado' : 'Gasto eliminado');
    renderDashboard();
  });

  const today = new Date().toISOString().slice(0, 10);
  const yearStart = today.slice(0, 4) + '-01-01';
  const yearExpenses = expenses.filter(e => e.date && e.date >= yearStart);

  const catAgg = {};
  for (const e of yearExpenses) {
    const cat = e.category || 'Otros';
    catAgg[cat] = (catAgg[cat] || 0) + (await Gold.valueOf(e));
  }
  const donutItems = Object.entries(catAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  const donutEl = document.getElementById('dash-donut');
  if (donutEl) Charts.donut(donutEl, donutItems, '');

  const byMonth = {};
  for (const i of incomes) {
    const mk = monthKey(i.date);
    byMonth[mk] = (byMonth[mk] || 0) + (Gold.isGold(i) ? goldOf(i) * goldPrice : (parseFloat(i.amount) || 0));
  }
  const sortedM = Object.keys(byMonth).sort().slice(-6);
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const barLabels = sortedM.map(k => monthNames[parseInt(k.split('-')[1]) - 1]);
  const barValues = sortedM.map(k => Math.round(byMonth[k] || 0));
  const maxIdx = barValues.indexOf(Math.max(...barValues));

  const barEl = document.getElementById('dash-bars');
  if (barEl) Charts.bars(barEl, barLabels, barValues, maxIdx);

  Budget.autoAlert(expenses, ym);
}

/* ============ Página Oro ============ */
async function renderGoldPage() {
  const container = document.getElementById('page-gold');
  const [incomes, expenses, investments, price] = await Promise.all([
    DB.getAll(StoreNames.INCOMES),
    DB.getAll(StoreNames.EXPENSES),
    DB.getAll(StoreNames.INVESTMENTS),
    Gold.getPricePerGram()
  ]);
  const includeInvestments = await DB.getSetting('includeInvestments', false);

  let inGold = 0, outGold = 0, invGold = 0;
  const goldTx = [];
  for (const inc of incomes) {
    inGold += Gold.isGold(inc) ? (parseFloat(inc.goldAmount) || 0) : (parseFloat(inc.amount) || 0) / price;
    goldTx.push({ ...inc, kind: 'income' });
  }
  for (const exp of expenses) {
    outGold += Gold.isGold(exp) ? (parseFloat(exp.goldAmount) || 0) : (parseFloat(exp.amount) || 0) / price;
    goldTx.push({ ...exp, kind: 'expense' });
  }
  for (const inv of investments) {
    invGold += (parseFloat(inv.investedAmount) || 0) / price;
  }
  const netGold = inGold - outGold - (includeInvestments ? invGold : 0);
  goldTx.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recentGold = goldTx.slice(0, 8);

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Precio del oro</h3>
        <button class="chip chip-gold" id="gold-edit">&#9998; ${App.mask(fmtBRL(price))}/g</button>
      </div>
      <div style="display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:center; margin-top:6px">
        <div class="form-group" style="margin-bottom:0"><label>Gramos</label><input type="number" id="conv-grams" step="0.001" placeholder="0,000" inputmode="decimal"></div>
        <div class="form-group" style="margin-bottom:0"><label>BRL</label><input type="number" id="conv-brl" step="0.01" placeholder="0,00" inputmode="decimal"></div>
      </div>
      <div class="form-hint">1 gramo = ${App.mask(fmtBRL(price))} · teclear en cualquiera convierte al instante</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value stat-positive">${App.mask(fmtGrams(inGold))}</div><div class="stat-label">Oro recibido</div></div>
      <div class="stat-card"><div class="stat-value stat-negative">${App.mask(fmtGrams(outGold))}</div><div class="stat-label">Oro gastado</div></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="stat-value stat-gold">${App.mask(fmtGrams(netGold))}</div>
      <div class="stat-label">Balance neto en oro ≈ ${App.mask(fmtBRL(netGold * price))}</div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Movimientos</h3></div>
      ${recentGold.length === 0 ? `
        <div class="empty-state"><div class="icon">&#129351;</div><p>Sin movimientos de oro.</p></div>` : `
        <ul class="tx-list">${recentGold.map(t => {
          const isIn = t.kind === 'income';
          const v = Gold.isGold(t) ? fmtGrams(t.goldAmount) : '=' + fmtBRL(t.amount) + ' BRL';
          return `
            <li class="tx-item">
              <div class="tx-swipe-bg">&#128465;</div>
              <div class="tx-main" data-kind="${t.kind}" data-id="${t.id}">
                <div class="tx-icon" style="background:${isIn ? 'var(--positive-bg)' : 'var(--negative-bg)'}">&#129351;</div>
                <div class="tx-info">
                  <div class="name">${esc(t.title || (isIn ? 'Ingreso' : 'Gasto'))}</div>
                  <div class="date">${formatDate(t.date)} · ${isIn ? 'Ingreso' : 'Gasto'}</div>
                </div>
                <div class="tx-amount ${isIn ? 'income' : 'expense'}">${isIn ? '+' : '-'} ${App.mask(v)}</div>
              </div>
            </li>`;
        }).join('')}</ul>`}
    </div>
  `;

  const gramsEl = document.getElementById('conv-grams');
  const brlEl = document.getElementById('conv-brl');
  gramsEl.addEventListener('input', () => {
    if (gramsEl.value === '') { brlEl.value = ''; return; }
    brlEl.value = (parseFloat(gramsEl.value) * price).toFixed(2);
  });
  brlEl.addEventListener('input', () => {
    if (brlEl.value === '') { gramsEl.value = ''; return; }
    gramsEl.value = (parseFloat(brlEl.value) / price).toFixed(3);
  });

  document.getElementById('gold-edit').addEventListener('click', showGoldEditSheet);

  Swipe.init(container, async el => {
    const kind = el.dataset.kind;
    const id = parseInt(el.dataset.id);
    if (kind === 'income') await Income.delete(id);
    else await Expense.delete(id);
    Toast.success('Movimiento eliminado');
    renderGoldPage();
    if (App.pg === 'dashboard') renderDashboard();
  });
}

function showGoldEditSheet() {
  Gold.getPricePerGram().then(price => {
    openSheet('Precio del oro', `
      <div class="form-group">
        <label>Precio por gramo (R$)</label>
        <input type="number" id="gold-price" step="0.01" value="${price}" inputmode="decimal">
      </div>
      <button class="btn btn-dark" id="gold-price-save">Guardar</button>
    `);
    document.getElementById('gold-price-save').addEventListener('click', async () => {
      const p = parseFloat(document.getElementById('gold-price').value);
      if (!p || p <= 0) { Toast.error('Precio inválido'); return; }
      await Gold.setPricePerGram(p);
      closeSheet();
      Toast.success('Precio actualizado');
      renderGoldPage();
    });
  });
}

/* ============ Configuración ============ */
async function renderSettingsPage() {
  const container = document.getElementById('page-settings');
  const price = await Gold.getPricePerGram();
  const cfg = await Budget.get();
  const iconTheme = await Icon.current();

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Apariencia</h3></div>
      <div class="settings-item">
        <div><label>Tema oscuro</label><div class="si-desc">Personaliza el aspecto</div></div>
        <label class="switch"><input type="checkbox" id="set-theme" ${App.state.theme === 'dark' ? 'checked' : ''}><span class="slider"></span></label>
      </div>
      <div class="settings-item">
        <div><label>Ocultar montos</label><div class="si-desc">Muestra cifras enmascaradas</div></div>
        <label class="switch"><input type="checkbox" id="set-hide" ${App.state.hide ? 'checked' : ''}><span class="slider"></span></label>
      </div>
      <div style="margin-top:14px">
        <div class="settings-item">
          <div><label>Precio del oro</label><div class="si-desc">R$ por gramo</div></div>
          <input type="number" id="set-gold" step="0.01" value="${price}" style="width:110px; padding:10px; border-radius:12px; border:1px solid var(--border); background:var(--bg-input); color:var(--text); text-align:right">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Icono de la app</h3></div>
      <div class="icon-grid">
        ${Icon.themes.map(t => `
          <button class="icon-opt ${iconTheme === t.id ? 'selected' : ''}" data-icon="${t.id}">
            <img src="${t.file}" alt="${t.label}">
            <span>${t.label}</span>
          </button>`).join('')}
      </div>
      <div class="form-hint">Cambia el icono y aplícalo desde tu pantalla de inicio.</div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Balance</h3></div>
      <div class="settings-item">
        <div><label>Restar inversiones del balance</label><div class="si-desc">Trata el dinero invertido como gastado</div></div>
        <label class="switch"><input type="checkbox" id="set-inv" ${App.state.includeInvestments ? 'checked' : ''}><span class="slider"></span></label>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Presupuesto mensual</h3></div>
      <div class="set-row">
        <label for="b-total">Límite total (R$)</label>
        <input type="number" id="b-total" step="0.01" value="${cfg.total || ''}" placeholder="0,00" inputmode="decimal">
      </div>
      ${Expense.CATEGORIES.map(c => `
        <div class="set-row">
          <label for="b-${c.name}">${c.icon} ${c.name}</label>
          <input type="number" id="b-${c.name}" step="0.01" value="${cfg.cats[c.name] || ''}" placeholder="—" inputmode="decimal">
        </div>`).join('')}
      <div class="form-hint">Recibe avisos al llegar al 80% y al superar los límites.</div>
      <button class="btn btn-dark" id="budget-save">Guardar presupuesto</button>
    </div>

    <div class="card">
      <div class="card-header"><h3>Respaldo</h3></div>
      <div style="display:flex; flex-direction:column; gap:10px">
        <button class="btn btn-ghost" id="exp-csv">&#11015; Exportar CSV (Excel)</button>
        <div class="btn-row">
          <button class="btn btn-ghost" id="exp-json">JSON</button>
          <button class="btn btn-ghost" id="imp-json">Importar</button>
        </div>
        <input type="file" id="imp-file" accept=".json" class="hidden">
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Zona de peligro</h3></div>
      <button class="btn btn-danger" id="reset-data">Borrar todos los datos</button>
    </div>
  `;

  document.getElementById('set-theme').addEventListener('change', async e => {
    App.state.theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', App.state.theme);
    await DB.setSetting('theme', App.state.theme);
  });
  document.getElementById('set-hide').addEventListener('change', async e => {
    App.state.hide = e.target.checked;
    await DB.setSetting('hideAmounts', App.state.hide);
    App.syncHeaderButtons();
  });

  let goldSaveTimer;
  document.getElementById('set-gold').addEventListener('input', e => {
    clearTimeout(goldSaveTimer);
    goldSaveTimer = setTimeout(async () => {
      const p = parseFloat(e.target.value);
      if (p > 0) { await Gold.setPricePerGram(p); Toast.success('Precio actualizado'); }
    }, 600);
  });

  document.getElementById('set-inv').addEventListener('change', async e => {
    App.state.includeInvestments = e.target.checked;
    await DB.setSetting('includeInvestments', App.state.includeInvestments);
  });

  document.querySelectorAll('#page-settings [data-icon]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await Icon.apply(btn.dataset.icon);
      Toast.success('Icono actualizado');
      document.querySelectorAll('#page-settings [data-icon]').forEach(x => x.classList.toggle('selected', x === btn));
    });
  });

  document.getElementById('budget-save').addEventListener('click', async () => {
    const cats = {};
    Expense.CATEGORIES.forEach(c => {
      const v = parseFloat(document.getElementById(`b-${c.name}`).value);
      if (v > 0) cats[c.name] = v;
    });
    await Budget.set(document.getElementById('b-total').value, cats);
    await DB.setSetting('budgetAlert', { warned: false, over: false });
    Toast.success('Presupuesto guardado');
    renderSettingsPage();
    if (App.pg === 'dashboard') renderDashboard();
  });

  document.getElementById('exp-csv').addEventListener('click', () => CSV.exportAll());
  document.getElementById('exp-json').addEventListener('click', async () => {
    const json = JSON.stringify(await DB.exportAll(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.success('Respaldo exportado');
  });
  document.getElementById('imp-json').addEventListener('click', () => document.getElementById('imp-file').click());
  document.getElementById('imp-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Restaurar respaldo? Los datos actuales se mezclarán con el respaldo.')) return;
      await DB.importAll(data);
      Toast.success('Respaldo restaurado');
      App.navigate('dashboard');
    } catch { Toast.error('Archivo inválido'); }
  });

  document.getElementById('reset-data').addEventListener('click', async () => {
    if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
    for (const name of [StoreNames.INCOMES, StoreNames.EXPENSES, StoreNames.INVESTMENTS, StoreNames.LOANS]) {
      await DB.clear(name);
    }
    await DB.setSetting('budgetAlert', { warned: false, over: false });
    Toast.success('Datos borrados');
    App.navigate('dashboard');
  });
}