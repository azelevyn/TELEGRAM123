const Coinpayments = require('coinpayments');

const client = (process.env.COINPAYMENTS_KEY && process.env.COINPAYMENTS_SECRET)
  ? new Coinpayments({ key: process.env.COINPAYMENTS_KEY, secret: process.env.COINPAYMENTS_SECRET })
  : null;

module.exports = {
  async createTransaction({ amount, currency1 = 'USD', currency2 = 'USDT', network = 'USDT-TRC20' }) {
    if (!client) {
      return { id: 'mock-' + Date.now(), amount, address: 'T-MOCK-ADDRESS-12345', network };
    }

    return new Promise((resolve, reject) => {
      client.createTransaction({ amount, currency1, currency2 }, (err, tx) => {
        if (err) return reject(err);
        resolve(tx);
      });
    });
  }
};
