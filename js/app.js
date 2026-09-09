/* ============ Helpers ============ */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const p = dateStr.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr;
}

function fmtBRL(v) {
  const n = parseFloat(v) || 0;
  const s = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${s}`;
}

function fmtGrams(v) {
  return `${(parseFloat(v) || 0).toFixed(3)} g`;
}

function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

/* ============ App state & shell ============ */
const App = {
  state: { theme: 'dark', hide: false },
  pg: 'dashboard',

  async init() {
    await DB.init();
    await Gold.initialize();

    const theme = await DB.getSetting('theme', 'dark');
    const hide = await DB.getSetting('hideAmounts', false);
    App.state.theme = theme === 'light' ? 'light' : 'dark';
    App.state.hide = !!hide;
    document.documentElement.setAttribute('data-theme', App.state.theme);
    App.syncHeaderButtons();

    App.bindHeader();
    App.bindTabs();
    App.bindFab();
    App.bindSheets();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    App.navigate('dashboard');
  },

  syncHeaderButtons() {
    document.getElementById('hide-toggle').textContent = App.state.hide ? '\u{1F576}\u{FE0F}' : '\u{1F441}\u{FE0F}';
  },

  bindHeader() {
    document.getElementById('theme-toggle').addEventListener('click', async () => {
      App.state.theme = App.state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', App.state.theme);
      await DB.setSetting('theme', App.state.theme);
      App.navigate(App.pg);
    });

    document.getElementById('hide-toggle').addEventListener('click', async () => {
      App.state.hide = !App.state.hide;
      await DB.setSetting('hideAmounts', App.state.hide);
      App.syncHeaderButtons();
      App.navigate(App.pg);
    });
  },

  bindTabs() {
    document.querySelectorAll('#tabbar .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const pg = tab.dataset.page;
        if (pg === 'more') { App.showMoreSheet(); return; }
        App.setTab(pg);
        App.navigate(pg);
      });
    });
  },

  setTab(pg) {
    document.querySelectorAll('#tabbar .tab').forEach(t => {
      const active = t.dataset.page === pg && pg !== 'more';
      t.classList.toggle('active', active);
    });
  },

  bindFab() {
    document.getElementById('fab').addEventListener('click', App.showQuickAdd);
  },

  bindSheets() {
    const root = document.getElementById('sheet-root');
    root.addEventListener('click', e => {
      if (e.target.classList && e.target.classList.contains('sheet-backdrop')) {
        closeSheet();
      }
    });
  },

  navigate(page) {
    App.pg = page;
    App.setTab(page);

    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`page-${page}`);
    if (el) el.classList.add('active');

    const titles = {
      dashboard: 'Inicio',
      income: 'Ingresos',
      expenses: 'Gastos',
      investments: 'Inversiones',
      loans: 'Préstamos',
      gold: 'Oro',
      settings: 'Configuración'
    };
    document.getElementById('page-title').textContent = titles[page] || 'Inicio';

    switch (page) {
      case 'dashboard': renderDashboard(); break;
      case 'income': renderIncomePage(); break;
      case 'expenses': renderExpensePage(); break;
      case 'investments': renderInvestmentPage(); break;
      case 'loans': renderLoanPage(); break;
      case 'gold': renderGoldPage(); break;
      case 'settings': renderSettingsPage(); break;
    }
  },

  showMoreSheet() {
    openSheet('Más opciones', `
      <div class="sheet-item" data-act="loans">
        <div class="si-ico">&#128179;</div>
        <div><div class="si-title">Préstamos</div><div class="si-sub">Dados, recibidos y cuotas</div></div>
      </div>
      <div class="sheet-item" data-act="gold">
        <div class="si-ico">&#129351;</div>
        <div><div class="si-title">Oro</div><div class="si-sub">Precio por gramo y conversión</div></div>
      </div>
      <div class="sheet-item" data-act="settings">
        <div class="si-ico">&#9881;</div>
        <div><div class="si-title">Configuración</div><div class="si-sub">Ajustes, presupuesto, respaldo</div></div>
      </div>
    `);
    document.querySelectorAll('#sheet-root [data-act]').forEach(item => {
      item.addEventListener('click', () => {
        const act = item.dataset.act;
        closeSheet();
        App.navigate(act);
      });
    });
  },

  showQuickAdd() {
    openSheet('Agregar', `
      <div class="sheet-item" data-q="income">
        <div class="si-ico" style="background:var(--positive-bg); color:var(--positive)">&#8600;</div>
        <div><div class="si-title">Ingreso</div><div class="si-sub">BRL u oro</div></div>
      </div>
      <div class="sheet-item" data-q="expense">
        <div class="si-ico" style="background:var(--negative-bg); color:var(--negative)">&#8599;</div>
        <div><div class="si-title">Gasto</div><div class="si-sub">Con categoría</div></div>
      </div>
      <div class="sheet-item" data-q="investment">
        <div class="si-ico">&#128200;</div>
        <div><div class="si-title">Inversión</div><div class="si-sub">Activos y rendimiento</div></div>
      </div>
      <div class="sheet-item" data-q="loan">
        <div class="si-ico">&#128179;</div>
        <div><div class="si-title">Préstamo</div><div class="si-sub">Cuotas y vencimientos</div></div>
      </div>
    `);
    document.querySelectorAll('#sheet-root [data-q]').forEach(item => {
      item.addEventListener('click', () => {
        const q = item.dataset.q;
        closeSheet();
        if (q === 'income') showIncomeModal();
        if (q === 'expense') showExpenseModal();
        if (q === 'investment') showInvestmentModal();
        if (q === 'loan') showLoanModal();
      });
    });
  },

  mask(value) {
    return App.state.hide ? '<span class="masked-amt">•••••</span>' : value;
  }
};

/* ============ Bottom sheet ============ */
function openSheet(title, bodyHTML) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = `
    <div class="sheet-backdrop"></div>
    <div class="sheet" role="dialog" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <div class="sheet-title">${esc(title)}</div>
      <div class="sheet-body">${bodyHTML}</div>
    </div>
  `;
}

function closeSheet() {
  const root = document.getElementById('sheet-root');
  const backdrop = root.querySelector('.sheet-backdrop');
  const sheet = root.querySelector('.sheet');
  if (!sheet) { root.innerHTML = ''; return; }
  backdrop.classList.add('closing');
  sheet.classList.add('closing');
  setTimeout(() => {
    if (root.contains(sheet)) root.innerHTML = '';
  }, 220);
}

/* ============ Swipe to delete ============ */
const Swipe = {
  init(scopeEl, onDelete, selector = '.tx-main') {
    scopeEl.querySelectorAll(selector).forEach(el => Swipe._bind(el, onDelete));
  },
  _bind(el, onDelete) {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, lockHorizontal = false;

    el.addEventListener('pointerdown', e => {
      startX = e.clientX; startY = e.clientY; dx = 0; dy = 0; dragging = true; lockHorizontal = false;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      if (!lockHorizontal && Math.abs(dy) > Math.abs(dx) * 1.2) { lockHorizontal = true; return; }
      if (!lockHorizontal) {
        el.style.transition = 'none';
        el.style.transform = dx < 0 ? `translateX(${Math.max(dx, -84)}px)` : 'translateX(0)';
      }
    });

    const end = () => {
      dragging = false;
      el.style.transition = '';
      el.style.transform = '';
      const swiped = dx < -40;
      el.classList.toggle('swiped', swiped);
      const bg = el.parentElement.querySelector('.tx-swipe-bg');
      if (bg) bg.style.pointerEvents = swiped ? 'auto' : 'none';
    };

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    const bg = el.parentElement.querySelector('.tx-swipe-bg');
    if (bg) {
      bg.style.pointerEvents = 'none';
      bg.addEventListener('click', () => {
        onDelete(el);
        el.classList.remove('swiped');
      });
    }
  },
  closeAll(scopeEl) {
    scopeEl.querySelectorAll('.tx-main.swiped').forEach(el => el.classList.remove('swiped'));
  }
};

/* ============ Toast ============ */
const Toast = {
  show(msg, type, icon) {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type || ''}`;
    el.innerHTML = `${icon || ''}${esc(msg)}`;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },
  success(msg) { Toast.show(msg, '', '&#10003; '); },
  error(msg) { Toast.show(msg, 'error', '&#10005; '); },
  info(msg) { Toast.show(msg, 'info', ''); }
};

document.addEventListener('DOMContentLoaded', () => App.init());