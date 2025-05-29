const mongoose = require("mongoose");

const stakingSchema = mongoose.Schema(
    {
        user_id: { type: String, requird: true },
        id: { type: String, required: true },
        amount: { type: Number, required: true },
        currency: { type: String, required: false, default: 'USDT' },
        paid: { type: Number, required: false, default: 0},
        // cctpaid: { type: Number, required: false, default: 0},
        total: { type: Number, required: false, default: 0},
        chain: { type: String, required: false, default: 'BEP20'},
        status: { type: String, required: false, default: 'RUNNING'},
        roi: { type: Number, required: true },
        // phase: { type: String, required: true },
        deduct_amount: { type: Number, required: false, default : 0 },
        type: {type : String, required: false, enum : ['USER_STAKING', 'ADMIN_STAKING', 'ADMIN_DEDUCT_STAKING'], default : 'USER_STAKING'},

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