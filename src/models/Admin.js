const mongoose = require('mongoose');

const adminSchema = mongoose.Schema(
    {
        email: { type: String, required: true },
        name: { type: String, required: true },
        password: { type: String, required: true },
        admin_type: { type: Number, default: 0, required: true },
        status: { type: String, default: "ACTIVE", required: true },
        permissions: { type: Array, default: [], required: false }
    },
    { timestamps: true}
);
module.exports = mongoose.model('admin', adminSchema);