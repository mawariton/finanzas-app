const CSV = {
  async exportAll() {
    const [incomes, expenses, investments, loans] = await Promise.all([
      DB.getAll(StoreNames.INCOMES),
      DB.getAll(StoreNames.EXPENSES),
      DB.getAll(StoreNames.INVESTMENTS),
      DB.getAll(StoreNames.LOANS)
    ]);

    const rows = [];

    for (const i of incomes) {
      rows.push(['Ingreso', i.date || '', i.title || '', i.category || '', i.type === 'gold' ? '' : i.amount, i.type === 'gold' ? i.goldAmount : '', '']);
    }
    for (const e of expenses) {
      rows.push(['Gasto', e.date || '', e.title || '', e.category || '', e.type === 'gold' ? '' : e.amount, e.type === 'gold' ? e.goldAmount : '', '']);
    }
    for (const v of investments) {
      rows.push(['Inversión', v.date || '', v.name || '', v.type || '', v.investedAmount, '', v.currentAmount]);
    }
    for (const l of loans) {
      rows.push(['Préstamo', l.date || '', l.person || '', l.note || l.direction || '', l.totalAmount, '', '']);
    }

    const header = ['Tipo', 'Fecha', 'Detalle', 'Categoría', 'Monto BRL', 'Gramos oro', 'Valor actual'];
    const csv = [header, ...rows]
      .map(r => r.map(CSV.cell).join(';'))
      .join('\r\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finanzas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  cell(v) {
    const s = String(v == null ? '' : v).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  }
};