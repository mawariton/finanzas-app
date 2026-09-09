const Gold = {
  DEFAULT_PRICE: 400,

  async getPricePerGram() {
    const p = await DB.getSetting('goldPricePerGram', Gold.DEFAULT_PRICE);
    return parseFloat(p) || Gold.DEFAULT_PRICE;
  },

  async setPricePerGram(p) {
    await DB.setSetting('goldPricePerGram', parseFloat(p));
  },

  async goldToBRL(grams) {
    return (parseFloat(grams) || 0) * (await Gold.getPricePerGram());
  },

  async brlToGold(brl) {
    const p = await Gold.getPricePerGram();
    return p > 0 ? (parseFloat(brl) || 0) / p : 0;
  },

  isGold(r) {
    return r && r.type === 'gold';
  },

  amountOf(r) {
    return Gold.isGold(r) ? parseFloat(r.goldAmount || 0) : parseFloat(r.amount || 0);
  },

  async valueOf(r) {
    return Gold.isGold(r) ? await Gold.goldToBRL(r.goldAmount) : parseFloat(r.amount || 0);
  },

  async getMonthlyTotal(records, ym) {
    let brl = 0, gold = 0;
    for (const r of records) {
      if (monthKey(r.date) !== ym) continue;
      if (Gold.isGold(r)) gold += parseFloat(r.goldAmount || 0);
      else brl += parseFloat(r.amount || 0);
    }
    return { brl, gold };
  },

  async initialize() {
    const p = await Gold.getPricePerGram();
    if (isNaN(p)) await Gold.setPricePerGram(Gold.DEFAULT_PRICE);
  }
};