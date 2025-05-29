const mongoose = require('mongoose');

const AdminTransferSchema = mongoose.Schema(
    {   
        user_id: { type: String, required: true },
        amount: { type: Number, required: true },
        previous_balance : { type : Number, required : true},  // balance before transfer
        final_balance : { type : Number, required : true},  // balance after transfer
        type: { type: String, required: true, enum : ['CREDITED_BY_ADMIN', 'DEBITED_BY_ADMIN'] },
    }, { timestamps: true }
)

module.exports = mongoose.model('admintransfer', AdminTransferSchema);