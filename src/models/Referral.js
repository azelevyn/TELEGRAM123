const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Referral', ReferralSchema);
