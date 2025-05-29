const mongoose = require("mongoose");

const userToUserTransferSchema = mongoose.Schema(
  {
    sender_id: { type: String, requird: true },
    receiver_id: { type: String, requird: true },
    amount: { type: Number, required: false, default: 0 },
    currency: { type: String, required: false, default: "USDT" },
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

module.exports = mongoose.model("userToUserTransfer", userToUserTransferSchema);
