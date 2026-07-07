const express = require('express');
const User = require('../models/User');
const router = express.Router();


// Get top 50 users
router.get('/', async (req, res) => {
    try {
        const topUsers = await User.find({}, 'username score')
            .sort({ score: -1 })
            .limit(50);
        res.status(200).json(topUsers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 1. Get user profile and Favorites (Optimized: No Images)
router.get('/profile/:username', async (req, res) => {
    try {
        const searchRegex = new RegExp(`^${req.params.username}$`, 'i');
        
        const user = await User.findOne({ username: searchRegex })
            .select('-password') 
            // FIX: Only use the exclusion flag!
            .populate('favorites', '-imageBase64'); 

        if (!user) return res.status(404).json({ message: "User not found" });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. NEW: Get paginated guessed characters
router.get('/profile/:username/guessed', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;

        const user = await User.findOne({ username: req.params.username })
            .populate({
                path: 'guessedCharacters',
                select: '-imageBase64', // Strip images out!
                options: {
                    skip: (page - 1) * limit,
                    limit: limit
                }
            });

        if (!user) return res.status(404).json({ message: "User not found" });

        // We need the raw user again just to count the total for pagination
        const totalUser = await User.findOne({ username: req.params.username });
        const total = totalUser.guessedCharacters.length;

        res.status(200).json({
            characters: user.guessedCharacters,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalCharacters: total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;