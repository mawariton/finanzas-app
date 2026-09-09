const Gold = {
  DEFAULT_PRICE_PER_GRAM: 400,

  async getPricePerGram() {
    const price = await DB.getSetting('goldPricePerGram', Gold.DEFAULT_PRICE_PER_GRAM);
    return parseFloat(price) || Gold.DEFAULT_PRICE_PER_GRAM;
  },

  async setPricePerGram(price) {
    await DB.setSetting('goldPricePerGram', parseFloat(price));
  },

  async goldToBRL(grams) {
    const price = await Gold.getPricePerGram();
    return grams * price;
  },

  async brlToGold(brl) {
    const price = await Gold.getPricePerGram();
    return price > 0 ? brl / price : 0;
  },

  formatGrams(grams) {
    return `${parseFloat(grams).toFixed(3)} g`;
  },

  async getTotalGold() {
    const incomes = await DB.getAll(StoreNames.INCOMES);
    const expenses = await DB.getAll(StoreNames.EXPENSES);

    let totalGold = 0;
    for (const inc of incomes) {
      if (inc.type === 'gold') totalGold += parseFloat(inc.goldAmount || 0);
      if (inc.type === 'brl') totalGold += await Gold.brlToGold(parseFloat(inc.amount || 0));
    }
    for (const exp of expenses) {
      if (exp.type === 'gold') totalGold -= parseFloat(exp.goldAmount || 0);
      if (exp.type === 'brl') totalGold -= await Gold.brlToGold(parseFloat(exp.amount || 0));
    }
    return totalGold;
  },

  async getTotalBRL() {
    const incomes = await DB.getAll(StoreNames.INCOMES);
    const expenses = await DB.getAll(StoreNames.EXPENSES);
    const investments = await DB.getAll(StoreNames.INVESTMENTS);

    let totalBRL = 0;
    for (const inc of incomes) {
      if (inc.type === 'brl') totalBRL += parseFloat(inc.amount || 0);
      if (inc.type === 'gold') totalBRL += await Gold.goldToBRL(parseFloat(inc.goldAmount || 0));
    }
    for (const exp of expenses) {
      if (exp.type === 'brl') totalBRL -= parseFloat(exp.amount || 0);
      if (exp.type === 'gold') totalBRL -= await Gold.goldToBRL(parseFloat(exp.goldAmount || 0));
    }
    return totalBRL;
  },

  async getFinancialSummary() {
    const totalBRL = await Gold.getTotalBRL();
    const totalGold = await Gold.getTotalGold();
    const price = await Gold.getPricePerGram();
    return { totalBRL, totalGold, price };
  },

  async initialize() {
    const price = await Gold.getPricePerGram();
    if (price === Gold.DEFAULT_PRICE_PER_GRAM) {
      await Gold.setPricePerGram(Gold.DEFAULT_PRICE_PER_GRAM);
    }
  }
};