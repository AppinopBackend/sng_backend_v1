const mongoose = require("mongoose");

const walletSchema = mongoose.Schema(
    {
        user_id: { type: String, requird: true },
        id: { type: String, requird: true },
        usdt_balance: { type: Number, required: false, default: 0 },
        sng_balance: { type: Number, required: false, default: 0 }
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

module.exports = mongoose.model("wallet", walletSchema);