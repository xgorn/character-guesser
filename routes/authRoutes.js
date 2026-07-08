const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            username,
            password: hashedPassword,
            isAdmin: false // Make first user true manually in DB later
        });

        await newUser.save();
        res.status(201).json({ message: "User registered successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Username might already exist." });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // 1. Create a short-lived Access Token (7 days)
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        // 2. Create a long-lived Refresh Token (30 days)
        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, { expiresIn: '30d' });

        res.status(200).json({ 
            token: accessToken, 
            refreshToken: refreshToken, 
            username: user.username, 
            isAdmin: user.isAdmin 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/refresh', (req, res) => {
    // Expect the refresh token to be sent in the body
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(403).json({ message: "Refresh token is required." });
    }

    // Verify the refresh token
    jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired refresh token. Please log in again." });
        }

        // If valid, issue a brand new Access Token
        const newAccessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.status(200).json({ token: newAccessToken });
    });
});

module.exports = router;