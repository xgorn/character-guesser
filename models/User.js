const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    guessedCharacters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Character' }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Character' }]
});

module.exports = mongoose.model('User', userSchema);