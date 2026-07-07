const express = require('express');
const CharacterRequest = require('../models/CharacterRequest');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

// POST: Users submit a new character request
router.post('/submit', verifyToken, async (req, res) => {
    try {
        const { name, alternativeName, title, category, imageBase64 } = req.body;
        
        // Get the username of the person submitting
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found." });

        const newRequest = new CharacterRequest({
            name,
            alternativeName,
            title,
            category,
            imageBase64,
            submittedBy: user.username
        });

        await newRequest.save();
        res.status(201).json({ message: "Character submitted for admin review!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;