const mongoose = require('mongoose');

const ClassicNewsSchema = mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: false },
        news_image: { type: String, required: false },
    }, { timestamps: true }
)

module.exports = mongoose.model('ClassicNews', ClassicNewsSchema);