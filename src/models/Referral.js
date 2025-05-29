const mongoose = require("mongoose");

const referralSchema = mongoose.Schema(
    {
        user_id: { type: String, requird: true },
        user_code: { type: String, required: true },
        sponser_id: { type: String, required: false, default: null },
        sponser_code: { type: String, required: false, default: null },
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

module.exports = mongoose.model("referral", referralSchema);