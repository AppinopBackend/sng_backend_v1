const mongoose = require('mongoose');

const rewardLogSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  user_code: String,
  type: { type: String, required: true }, // 'rank', 'superBonus', 'roi', 'levelIncome', etc.
  timestamp: { type: Date, default: Date.now },
  details: mongoose.Schema.Types.Mixed // Flexible for each reward type
});

module.exports = mongoose.model('RewardLog', rewardLogSchema); 