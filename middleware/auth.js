const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: "No token provided." });

    jwt.verify(token.split(" ")[1], process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            // Check specifically if the error is due to expiration
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "TokenExpired" });
            }
            return res.status(401).json({ message: "Unauthorized." });
        }
        
        req.userId = decoded.id;
        next();
    });
};

const verifyAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: "Require Admin Role!" });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { verifyToken, verifyAdmin };