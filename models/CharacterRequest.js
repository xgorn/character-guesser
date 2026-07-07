const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    alternativeName: { type: String },
    title: { type: String, required: true },
    category: { type: String, enum: ['waifu', 'husbu'], required: true },
    imageBase64: { type: String, required: true },
    submittedBy: { type: String, required: true }, // Track who requested it
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CharacterRequest', requestSchema);