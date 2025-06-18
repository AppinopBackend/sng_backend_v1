const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
    {
        name: { type: String, required: true },
        user_id: { type: String, requird: true },
        phone: { type: Number, required: true },
        email: { type: String, required: true },
        country: { type: String, required: false, default: '+91'},
        password: { type: String, required: true },
        loginStatus: { type: String, required: false, default: "ACTIVE" }, 
        profilepicture: { type: String, required: false, default: ''},
        bsc_address: { type: String, required: false, defualt: ''},
        trc20_address: { type: String, required: false, defualt: ''},
        current_rank: { type: String, required: false, default: 'BEGINNER'},
        staking_status: { type: String, required: false, default: 'INACTIVE'},
        total_earning_potential: { type: Number, required: false, default: 200 }, // 200 for 0 Direct Referrals, else 300 (if DR > 0)
        self_staking: { type: Number, required: true, default : 0 },
        direct_referrals: { type: Number, required: true, default : 0},
        last_rank_achieve: { type: Date, required: false, default: null},
        activation_date: { type: Date, required: false },
        carry_forward_business: { type: Number, required: false, default: 0 },
        highest_team_remaining_business: { type: Number, required: false, default: 0 },
        other_team_remaining_business: { type: Number, required: false, default: 0 },
        highest_sng_reward_achieved: { type: String, required: false, default: null },
        // ranks: {
        //     SILVER: {
        //         staking_required: { type: Number, required: false, default: 100 },
        //         direct_required: { type: Number, required: false, default: 3 },
        //         team_business: { type: Number, required: false, default: 2500 },
        //         rank_reward: { type: Number, required: false, default: 0 },
        //         rank_status: { type: String, required: false, default: 'PENDING' },
        //     },
        //     GOLD: {
        //         staking_required: { type: Number, required: false, default: 501 },
        //         direct_required: { type: Number, required: false, default: 5 },
        //         team_business: { type: Number, required: false, default: 5000 },
        //         rank_reward: { type: Number, required: false, default: 0 },
        //         rank_status: { type: String, required: false, default: 'PENDING' },
        //     },
        //     PLATINUM: {
        //         staking_required: { type: Number, required: false, default: 1001 },
        //         direct_required: { type: Number, required: false, default: 7 },
        //         team_business: { type: Number, required: false, default: 25000 },
        //         rank_reward: { type: Number, required: false, default: 100 },
        //         rank_status: { type: String, required: false, default: 'PENDING' },
        //     },
        //     DIAMOND: {
        //         staking_required: { type: Number, required: false, default: 2501 },
        //         direct_required: { type: Number, required: false, default: 9 },
        //         team_business: { type: Number, required: false, default: 50000 },
        //         rank_reward: { type: Number, required: false, default: 200 },
        //         rank_status: { type: String, required: false, default: 'PENDING' },
        //     },
        //     CROWN: {
        //         staking_required: { type: Number, required: false, default: 5001 },
        //         direct_required: { type: Number, required: false, default: 11 },
        //         team_business: { type: Number, required: false, default: 100000 },
        //         rank_reward: { type: Number, required: false, default: 300 },
        //         rank_status: { type: String, required: false, default: 'PENDING' },
        //     },
           
        // }
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

module.exports = mongoose.model("users", userSchema);