const express = require('express');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/toggle-favorite', verifyToken, async (req, res) => {
    try {
        const { characterId } = req.body;
        const user = await User.findById(req.userId);

        if (!user) return res.status(404).json({ message: "User not found" });

        // 1. Check if they actually guessed this character first
        if (!user.guessedCharacters.includes(characterId)) {
            return res.status(403).json({ message: "You must guess this character first before favoriting them!" });
        }

        const isFavorited = user.favorites.includes(characterId);

        // 2. If it's already a favorite, remove it (Toggle Off)
        if (isFavorited) {
            user.favorites = user.favorites.filter(id => id.toString() !== characterId);
            await user.save();
            return res.status(200).json({ message: "Removed from favorites.", isFavorited: false });
        } 
        
        // 3. If it's not a favorite, check the limit and add it (Toggle On)
        if (user.favorites.length >= 5) {
            return res.status(400).json({ message: "You can only have 5 favorites! Remove one first." });
        }

        user.favorites.push(characterId);
        await user.save();
        res.status(200).json({ message: "Added to favorites!", isFavorited: true });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;