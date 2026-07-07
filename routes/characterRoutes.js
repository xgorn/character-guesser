const express = require('express');
const Character = require('../models/Character');
const User = require('../models/User');
const router = express.Router();

// NEW: Global Search Route (Must be ABOVE /:id)
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ message: "Search query required." });

        // Search by name or title, case-insensitive. Exclude images!
        const characters = await Character.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { title: { $regex: query, $options: 'i' } },
                { alternativeName: { $regex: query, $options: 'i' } }
            ]
        }).select('-imageBase64').limit(50); // Limit to 50 results max

        res.status(200).json(characters);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Existing Route: Fetch character details
router.get('/:id', async (req, res) => {
    try {
        // Exclude imageBase64 from the single character fetch too!
        const character = await Character.findById(req.params.id).select('-imageBase64');
        if (!character) return res.status(404).json({ message: "Character not found." });

        const guessers = await User.find({ guessedCharacters: character._id })
            .select('username score').sort({ score: -1 });

        res.status(200).json({ character, guessers });
    } catch (error) {
        res.status(500).json({ message: "Invalid character ID." });
    }
});

module.exports = router;