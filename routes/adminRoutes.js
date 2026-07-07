const express = require('express');
const Character = require('../models/Character');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const router = express.Router();
const CharacterRequest = require('../models/CharacterRequest');

// PUT: Edit an existing character
router.put('/edit-character/:id', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { name, alternativeName, title, category, imageBase64 } = req.body;

        // 1. Build the update object with the new text fields
        const updateFields = { name, alternativeName, title, category };

        // 2. Only update the image if a new Base64 string was sent
        if (imageBase64) {
            updateFields.imageBase64 = imageBase64;
        }

        // 3. Find and update the character
        const updatedCharacter = await Character.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true } // Returns the updated document
        );

        if (!updatedCharacter) {
            return res.status(404).json({ message: "Character not found." });
        }

        res.status(200).json({ message: "Character updated successfully!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET: Fetch all pending requests
router.get('/requests', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const requests = await CharacterRequest.find().sort({ createdAt: 1 });
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST: Approve a request
router.post('/requests/:id/approve', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const request = await CharacterRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: "Request not found." });

        // 1. Move to official Characters collection
        const newCharacter = new Character({
            name: request.name,
            alternativeName: request.alternativeName,
            title: request.title,
            category: request.category,
            imageBase64: request.imageBase64
        });
        await newCharacter.save();

        // 2. Delete from pending requests to save DB space
        await CharacterRequest.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: "Character approved and added to the game!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST: Reject a request
router.post('/requests/:id/reject', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        await CharacterRequest.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Request rejected and deleted." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


router.post('/add-character', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { name, alternativeName, title, category, imageBase64 } = req.body;
        
        const newCharacter = new Character({
            name,
            alternativeName,
            title,
            category,
            imageBase64
        });

        await newCharacter.save();
        res.status(201).json({ message: "Character added successfully!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;