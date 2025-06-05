const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema(
    {
        user_id: { type: String, requird: true },
        id: { type: String, required: true },
        amount: { type: Number, required: true },
        staking_id: { type: String, required: false },
        from: { type: String, required: false },
        rank_achieved: { type: String, required: false },
        currency: { type: String, required: false, default: 'USDT' },
        self: { type: Number, required: false },
        first_leg: { type: Number, required: false },
        second_leg: { type: Number, required: false },
        rest_legs: { type: Number, required: false },
        total: { type: Number, required: false },
        carry_forward_business: { type: Number, required: false },
        type: { type: String, required: true, enum: ['sng_roi_income', 'sng_direct_referral', 'sng_royalty_income', 'sng_level_income', 'sng_rewards_income']   },
        transaction_type: { type: String, required: true,  },
        status: { type: String, default: 'PENDING', requried: false }
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

module.exports = mongoose.model("transactions", transactionSchema);