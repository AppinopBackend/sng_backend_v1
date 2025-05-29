const mongoose = require("mongoose");

const tokenSchema = mongoose.Schema(
    {
        name: { type: String, default: 'CARNIVAL CORPORATE TOKEN'},
        short_name: { type: String, default: 'CCT'},
        chain: { type: String, default: 'BEP20'},
        contract_address: { type: String, default: '0xd28747232ED5654446FBb8f73e8375b648E8D761'},
        total_supply: { type: Number, default: 100000},
        circulating_supply: { type: Number, default: 100000},
        withdrawal_fee: { type: Number, default: 15 },
        minimum_withdrawal: { type: Number, default: 10 },
        minimum_stake: { type: Number, default: 25 },
        super_bonus_roi: { type: Number, default: 0.4 },
        cct_roi: { type: Number, default: 2 },
        cct_price: { type: Number, default: 100 }
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

module.exports = mongoose.model("tokendetails", tokenSchema);