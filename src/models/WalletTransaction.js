const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema(
    {
        user_id: { type: String, requird: true },
        id: { type: String, required: true },
        amount: { type: Number, required: true },
        currency: { type: String, required: false, default: 'USDT' },
        chain: { type: String, required: false, default: 'BEP20'},
        transaction_hash: { type: String, required: false, default: '' },
        withdrawal_address: { type: String, required: false },
        deposit_slip: { type: String, required: false },
        status: { type: String, default: 'PENDING', requried: false },
        type: { type: String, required: true }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
        },
        toObject: {
            virtuals: true,
        },
    }
);

module.exports = mongoose.model("wallettransaction", transactionSchema);