require('dotenv').config();
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const CoinPayments = require('./helpers/coinpayments');
const User = require('./models/User');
const Referral = require('./models/Referral');

const TOKEN = process.env.TELEGRAM_TOKEN;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err.message));

let bot;
if (WEBHOOK_URL) {
  bot = new TelegramBot(TOKEN);
  bot.setWebHook(`${WEBHOOK_URL}`);
} else {
  bot = new TelegramBot(TOKEN, { polling: true });
}

const app = express();
app.use(bodyParser.json());
if (WEBHOOK_URL) {
  app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

app.get('/', (_, res) => res.send('USDT→Fiat Bot Running'));

bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const payload = match[1];
  const userFrom = msg.from;

  let user = await User.findOne({ telegramId: userFrom.id });
  if (!user) {
    user = await User.create({
      telegramId: userFrom.id,
      username: userFrom.username || '',
      firstName: userFrom.first_name || '',
      lastName: userFrom.last_name || '',
      balance: 0,
      referralCode: uuidv4().slice(0, 8)
    });

    if (payload && payload.startsWith('ref_')) {
      const refUser = await User.findOne({ referralCode: payload.slice(4) });
      if (refUser && refUser.telegramId !== user.telegramId) {
        await Referral.create({
          fromUser: user._id,
          toUser: refUser._id,
          amount: parseFloat(process.env.REFERRAL_BONUS || '1.5')
        });
        refUser.balance += parseFloat(process.env.REFERRAL_BONUS || '1.5');
        await refUser.save();
      }
    }
  }

  const menu = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💸 Sell USDT', callback_data: 'sell' }],
        [{ text: '🏦 Withdraw (Fiat)', callback_data: 'withdraw' }],
        [{ text: '💰 Deposit', callback_data: 'deposit' }],
        [{ text: '🎁 Referral', callback_data: 'referral' }],
        [{ text: '👤 Profile', callback_data: 'profile' }]
      ]
    }
  };
  await bot.sendMessage(chatId, `Hello ${user.firstName} ${user.lastName}! Welcome.\nBalance: ${user.balance} USDT`, menu);
});

// handle callback buttons
bot.on('callback_query', async cq => {
  const data = cq.data;
  const chatId = cq.message.chat.id;
  const user = await User.findOne({ telegramId: cq.from.id });

  if (data === 'deposit') {
    const kb = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'USDT TRC20', callback_data: 'deposit_TRC20' }],
          [{ text: 'USDT ERC20', callback_data: 'deposit_ERC20' }]
        ]
      }
    };
    return bot.sendMessage(chatId, 'Choose your network:', kb);
  }

  if (data.startsWith('deposit_')) {
    const network = data.split('_')[1];
    const invoice = await CoinPayments.createTransaction({
      amount: 10,
      currency1: 'USD',
      currency2: 'USDT',
      network
    });

    const msg = `Send ${invoice.amount} USDT (${network})\nAddress: ${invoice.address}`;
    const qr = `/tmp/${uuidv4()}.png`;
    await qrcode.toFile(qr, invoice.address);
    await bot.sendPhoto(chatId, qr, { caption: msg });
    fs.unlinkSync(qr);
  }

  if (data === 'referral') {
    const refLink = `https://t.me/${(await bot.getMe()).username}?start=ref_${user.referralCode}`;
    return bot.sendMessage(chatId, `Your referral link:\n${refLink}\nEarn ${process.env.REFERRAL_BONUS} USDT per signup.`);
  }

  if (data === 'profile') {
    return bot.sendMessage(chatId, `👤 Profile\nName: ${user.firstName} ${user.lastName}\nUsername: ${user.username}\nBalance: ${user.balance} USDT`);
  }

  await bot.answerCallbackQuery(cq.id);
});

app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
