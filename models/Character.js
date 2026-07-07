const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
    name: { type: String, required: true },
    alternativeName: { type: String },
    title: { type: String, required: true },
    category: { type: String, enum: ['waifu', 'husbu'], required: true }, // NEW
    imageBase64: { type: String, required: true } // NEW
});

module.exports = mongoose.model('Character', characterSchema);