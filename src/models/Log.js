const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    level: { type: String, default: 'info' }, // info, error, debug, etc.
    message: String,
    meta: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema); 