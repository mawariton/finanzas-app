const Budget = {
  async get() {
    const b = await DB.getSetting('budget', null);
    if (!b) return { total: 0, cats: {} };
    return { total: parseFloat(b.total) || 0, cats: b.cats || {} };
  },

  async set(total, cats) {
    await DB.setSetting('budget', { total: parseFloat(total) || 0, cats: cats || {} });
  },

  getCatsTitleList(cats) {
    return Object.entries(cats)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([k, v]) => ({ name: k, amount: parseFloat(v) || 0 }));
  },

  async monthSpent(expenses, ym) {
    let total = 0;
    const byCat = {};
    for (const e of expenses) {
      if (monthKey(e.date) !== ym) continue;
      const v = await Gold.valueOf(e);
      total += v;
      const cat = e.category || 'Otros';
      byCat[cat] = (byCat[cat] || 0) + v;
    }
    return { total, byCat };
  },

  status(spent, limit) {
    if (!limit || limit <= 0) return { pct: 0, cls: 'ok' };
    const pct = Math.min(spent / limit * 100, 100);
    let cls = 'ok';
    if (pct >= 100) cls = 'over';
    else if (pct >= 80) cls = 'warn';
    return { pct, cls };
  },

  async autoAlert(expenses, ym) {
    const cfg = await Budget.get();
    if (cfg.total <= 0) return;
    const spent = await Budget.monthSpent(expenses, ym);
    const limit = cfg.total;
    const prev = await DB.getSetting('budgetAlert', {});
    const now = { warned: prev.warned >= 80, over: prev.over };
    const pct = (spent.total / limit) * 100;

    if (pct >= 100 && !now.over) {
      Toast.error('Presupuesto mensual superado');
      await DB.setSetting('budgetAlert', { warned: true, over: true });
    } else if (pct >= 80 && !now.warned) {
      Toast.info('Cuidado: llegaste al 80% del presupuesto del mes');
      await DB.setSetting('budgetAlert', { warned: true, over: false });
    }
  },

  async resetAlert(newMonth) {
    await DB.setSetting('budgetAlert', { warned: false, over: false });
  }
};