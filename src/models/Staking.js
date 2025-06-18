const mongoose = require("mongoose");

const stakingSchema = mongoose.Schema(
    {
        user_id: { type: String, requird: true },
        id: { type: String, required: true },
        total: { type: Number, required: false, default: 0 }, // 2x, 3x of amount (2x: roi income, 1x: other incomes)
        currency: { type: String, required: true, default: 'USDT' },
        sng_price: { type: Number, required: true, default: 1 },
        amount: { type: Number, required: true },
        reward_percentage: { type: Number, required: false, default: 0 },
        eqv_sng: { type: Number, required: true, default: function () { return (this.amount * this.sng_price) }},
        paid: { type: Number, required: true, default: 0 },
        roi_paid: { type: Number, required: true, default: 0 },
        total_roi: { type: Number, required: true, default: function () { return this.amount * 2 } }, // 2x of amount (Both Cases...)
        chain: { type: String, required: false, default: 'BEP20' },
        status: { type: String, required: true, default: 'RUNNING' },
        roi: { type: Number, required: true },
        booster_applicable: { type: Boolean, required: true, default: false },
        deduct_amount: { type: Number, required: false, default: 0 },
        type: { type: String, required: false, enum: ['USER_STAKING', 'ADMIN_STAKING', 'ADMIN_DEDUCT_STAKING'], default: 'USER_STAKING' },
        direct_bonus_paid: { type: Number, required: false, default: 0 },
        level_bonus_paid: { type: Number, required: false, default: 0 },
        rank_reward_counted: { type: Boolean, required: false, default: false }
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

module.exports = mongoose.model("staking", stakingSchema);