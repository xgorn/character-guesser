require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const Character = require('./models/Character');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const requestRoutes = require('./routes/requestRoutes');
const characterRoutes = require('./routes/characterRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); 
// CRITICAL: Increase JSON limit to handle Base64 image uploads!
app.use(express.json({ limit: '20mb' })); 
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/request', requestRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/user', userRoutes);


const userCooldowns = new Map();
const COOLDOWN_TIME = 2000; // 2 seconds in milliseconds


// --- BASE64 IMAGE ROUTE ---
app.get('/api/image/:id', async (req, res) => {
    try {
        const character = await Character.findById(req.params.id);
        if (!character) return res.status(404).send('Not found');
        
        // Split "data:image/jpeg;base64,....." and convert to buffer
        const base64Data = character.imageBase64.split(',')[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(imgBuffer);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// --- DUAL GAME STATE (Waifu & Husbu) ---
const gameState = {
    waifu: { current: null, timer: null, startTime: null },
    husbu: { current: null, timer: null, startTime: null }
};
const TIME_LIMIT = 5 * 60 * 1000; 

async function selectNewCharacter(category) {
    const count = await Character.countDocuments({ category });
    if (count === 0) return console.log(`No ${category}s in DB!`); 

    const random = Math.floor(Math.random() * count);
    gameState[category].current = await Character.findOne({ category }).skip(random);
    gameState[category].startTime = Date.now(); 

    // Emit ONLY to the specific room (Waifu room OR Husbu room)
    io.to(category).emit('new_character', {
        imageUrl: `/api/image/${gameState[category].current._id}`, 
        startTime: gameState[category].startTime,
        duration: TIME_LIMIT
    });

    startTimer(category);
}

function startTimer(category) {
    if (gameState[category].timer) clearTimeout(gameState[category].timer);
    gameState[category].timer = setTimeout(() => {
        io.to(category).emit('time_up', { message: 'Time is up!' });
        selectNewCharacter(category);
    }, TIME_LIMIT);
}

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    
    // User selects which room to join
    socket.on('join_room', (category) => {
        // Leave old rooms to prevent cross-contamination
        socket.leave('waifu');
        socket.leave('husbu');
        socket.join(category);
        
        // Send current state for that specific room
        const state = gameState[category];
        if (state.current && state.startTime) {
            socket.emit('new_character', {
                imageUrl: `/api/image/${state.current._id}`,
                startTime: state.startTime,
                duration: TIME_LIMIT
            });
        }
    });

    socket.on('submit_guess', async (data) => {
        const { username, guess, category } = data;

        // --- NEW: SPAM PROTECTION ---
        const now = Date.now();
        if (userCooldowns.has(username)) {
            const lastGuessTime = userCooldowns.get(username);
            if (now - lastGuessTime < COOLDOWN_TIME) {
                // User is guessing too fast. Warn them and stop processing.
                socket.emit('spam_warning', { message: "Whoa, slow down! Please wait 2 seconds between guesses." });
                return;
            }
        }
        // Record the time of this guess
        userCooldowns.set(username, now);
        // -----------------------------

        const state = gameState[category];
        
        if (!state.current) return;

        // 1. Clean up the user's guess (lowercase, remove extra spaces)
        const cleanGuess = guess.trim().toLowerCase();
        
        // 2. Clean up the database names
        const cleanName = state.current.name.trim().toLowerCase();
        const cleanAlt = state.current.alternativeName ? state.current.alternativeName.trim().toLowerCase() : "";

        // 3. Split the names into individual words (splitting by spaces or hyphens)
        // Example: "Audrey Hall" becomes ["audrey", "hall"]
        const nameWords = cleanName.split(/[\s-]+/);
        const altWords = cleanAlt ? cleanAlt.split(/[\s-]+/) : [];

        // 4. Check for a match
        const isMatch = 
            cleanGuess === cleanName ||            // Matches exact full name
            cleanGuess === cleanAlt ||             // Matches exact full alt name
            nameWords.includes(cleanGuess) ||      // Matches a single word (e.g. "audrey" or "hall")
            altWords.includes(cleanGuess);         // Matches a single word in the alt name

        if (isMatch) {
            await User.findOneAndUpdate(
                { username: username },
                { $inc: { score: 1 }, $addToSet: { guessedCharacters: state.current._id } }
            );

            io.to(category).emit('correct_guess', { 
                winner: username, 
                characterName: state.current.name 
            });

            selectNewCharacter(category);
        } else {
            socket.emit('wrong_guess');
        }
    });
});

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Database connected');
    selectNewCharacter('waifu'); 
    selectNewCharacter('husbu'); 
    server.listen(process.env.PORT || 3000, () => console.log(`Character Guesser running`));
});