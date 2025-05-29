const mongoose = require('mongoose');

const NotificationSchema = mongoose.Schema(
    {
        title: { type: String, required: true },
        message: { type: String, required: true },
    }, { timestamps: true }
)

module.exports = mongoose.model('Notification', NotificationSchema);