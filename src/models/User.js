const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  balance: { type: Number, default: 0 },
  referralCode: String,
  state: { type: Object, default: null },
  pendingWithdraws: { type: Array, default: [] }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
