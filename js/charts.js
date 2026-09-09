const Charts = {
  _instances: {},

  _destroy(key) {
    if (Charts._instances[key]) {
      Charts._instances[key].destroy();
      delete Charts._instances[key];
    }
  },

  _colors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      text: dark ? '#94a3b8' : '#475569',
      grid: dark ? 'rgba(148,163,184,0.1)' : 'rgba(71,85,105,0.1)',
      palette: ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16', '#f97316']
    };
  },

  async renderExpensePie(containerId, records) {
    const el = document.getElementById(containerId);
    if (!el) return;
    Charts._destroy(containerId);

    const c = Charts._colors();
    const byCat = {};

    for (const r of records) {
      const cat = r.category || 'Otros';
      const value = r.type === 'gold'
        ? await Gold.goldToBRL(parseFloat(r.goldAmount || 0))
        : parseFloat(r.amount || 0);
      if (!byCat[cat]) byCat[cat] = 0;
      byCat[cat] += value;
    }

    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>Sin gastos</p></div>';
      return;
    }

    const labels = entries.map(e => e[0]);
    const data = entries.map(e => Math.round(e[1] * 100) / 100);
    const backgroundColors = data.map((_, i) => c.palette[i % c.palette.length]);

    Charts._instances[containerId] = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: labels.map(l => {
          const cat = Expense.CATEGORIES.find(x => x.name === l);
          return cat ? cat.icon + ' ' + cat.name : l;
        }),
        datasets: [{
          data,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: 'transparent'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: c.text,
              boxWidth: 12,
              padding: 10
            }
          }
        }
      }
    });
  },

  async renderMonthlyBar(containerId, records, type = 'income') {
    const el = document.getElementById(containerId);
    if (!el) return;
    Charts._destroy(containerId);

    const c = Charts._colors();
    const byMonth = {};

    for (const r of records) {
      if (!r.date) continue;
      const key = r.date.slice(0, 7);
      const value = r.type === 'gold'
        ? await Gold.goldToBRL(parseFloat(r.goldAmount || 0))
        : parseFloat(r.amount || 0);
      if (!byMonth[key]) byMonth[key] = 0;
      byMonth[key] += value;
    }

    const sortedKeys = Object.keys(byMonth).sort();
    const lastMonths = sortedKeys.slice(-6);

    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const labels = lastMonths.map(k => {
      const [, m] = k.split('-');
      return monthNames[parseInt(m) - 1] || k;
    });
    const data = lastMonths.map(k => Math.round(byMonth[k] * 100) / 100);

    const color = type === 'income' ? '#22c55e' : '#ef4444';

    Charts._instances[containerId] = new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: type === 'income' ? 'Ingresos' : 'Gastos',
          data,
          backgroundColor: color + 'cc',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: c.text },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: c.text,
              callback: v => 'R$ ' + v.toFixed(0)
            },
            grid: { color: c.grid }
          }
        }
      }
    });
  },

  async renderInvestmentDoughnut(containerId, records) {
    const el = document.getElementById(containerId);
    if (!el) return;
    Charts._destroy(containerId);

    const c = Charts._colors();
    const byType = {};

    for (const r of records) {
      const t = r.type || 'Otro';
      if (!byType[t]) byType[t] = 0;
      byType[t] += parseFloat(r.currentAmount || 0);
    }

    const entries = Object.entries(byType);
    if (entries.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>Sin inversiones</p></div>';
      return;
    }

    const labels = entries.map(e => e[0]);
    const data = entries.map(e => Math.round(e[1] * 100) / 100);

    Charts._instances[containerId] = new Chart(el, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: data.map((_, i) => c.palette[i % c.palette.length]),
          borderWidth: 2,
          borderColor: 'transparent'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: c.text, boxWidth: 12, padding: 10 }
          }
        }
      }
    });
  }
};