const socket = io();
let countdownInterval;
let currentCategory = null; // Track what room we are in

const currentUser = localStorage.getItem('username');
const isAdmin = localStorage.getItem('isAdmin');
let isOnCooldown = false; // Track cooldown state


async function fetchWithAuth(url, options = {}) {
    let token = localStorage.getItem('token');
    
    // Ensure headers exist
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = `Bearer ${token}`;

    // 1. Make the initial request
    let response = await fetch(url, options);
    let data = await response.clone().json().catch(() => ({}));

    // 2. If the token is expired, intercept and refresh
    if (response.status === 401 && data.message === "TokenExpired") {
        console.log("Token expired. Attempting automatic refresh...");
        
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            logout(); // No refresh token = force login
            return response;
        }

        // Ask server for a new token
        const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            
            // Save the new token
            localStorage.setItem('token', refreshData.token);
            
            // 3. Retry the original request with the NEW token
            options.headers['Authorization'] = `Bearer ${refreshData.token}`;
            return await fetch(url, options);
        } else {
            // Refresh token is dead too. Boot them out.
            logout();
        }
    }

    return response;
}


// --- THEME MANAGEMENT ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Dynamically create the floating button
    const btn = document.createElement('button');
    btn.id = 'themeToggleBtn';
    btn.className = 'theme-toggle-fab';
    btn.innerHTML = savedTheme === 'light' ? '🌙' : '☀️';
    btn.onclick = toggleTheme;
    document.body.appendChild(btn);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Apply theme and save to browser storage
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update the button icon
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
    }
}

// Run this immediately when app.js loads
initTheme();


window.onload = () => {
    const navLinks = document.getElementById('navLinks');
    document.querySelector('.brand a strong').innerText = "Character Guesser"; // Update title
    if (currentUser) {
        let adminLink = isAdmin === 'true' ? `<a href="admin.html" style="color: var(--accent);">Admin</a>` : '';
        navLinks.innerHTML = `
            ${adminLink}
            <a href="search.html" style="color: var(--primary-light);">Search</a>
            <a href="request.html" style="color: var(--secondary);">Submit Character</a>
            <a href="leaderboard.html">Leaderboard</a>
            <a href="profile.html?user=${currentUser}">${currentUser}</a>
            <a href="#" onclick="logout()">Logout</a>
        `;
    }
};

// --- ROOM LOGIC ---
function joinRoom(category) {
    currentCategory = category;
    document.getElementsByClassName('game-container')[0].style.marginTop = '80px'; // Adjust margin for game container
    document.getElementById('roomSelector').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    document.getElementById('roomTitle').innerText = category === 'female' ? "Female Guesser" : "Male Guesser";
    document.getElementById('roomTitle').style.color = category === 'female' ? "var(--accent)" : "var(--primary)";
    
    socket.emit('join_room', category);
}

function leaveRoom() {
    currentCategory = null;
    document.getElementById('roomSelector').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';
    clearInterval(countdownInterval);
}

function logout() {
    localStorage.clear();
    window.location.reload();
}

// --- GAME LOGIC ---
socket.on('new_character', (data) => {
    document.getElementById('message').innerText = "";
    document.getElementById('guessInput').value = "";

    // Clear the old hints!
    document.getElementById('hintDisplay').innerText = "";
    
    const canvas = document.getElementById('characterCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // 1. Let the browser cache the image for instant loading!
    img.src = data.imageUrl; 
    
    img.onload = () => {
        // 2. Use a smaller internal resolution so phones/weak PCs don't lag
        const FIXED_WIDTH = 800; 
        const aspectRatio = img.naturalHeight / img.naturalWidth;
        canvas.width = FIXED_WIDTH;
        canvas.height = FIXED_WIDTH * aspectRatio;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };

    startFrontendTimer(data.startTime, data.duration);
});


// NEW: Listen for hints from the server
socket.on('show_hint', (data) => {
    const hintEl = document.getElementById('hintDisplay');
    
    if (data.type === 'name') {
        // Shows: "Hint: S----- H-----"
        hintEl.innerText = data.text; 
    } else if (data.type === 'title') {
        // Appends the title to the next line
        hintEl.innerText += `\n${data.text}`; 
    }
});


socket.on('correct_guess', (data) => {
    const banner = document.getElementById('announcementBanner');
    banner.style.backgroundColor = "var(--success)";
    banner.innerText = `🎉 ${data.winner} guessed correctly! It was ${data.characterName}.`;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 5000);
});

socket.on('time_up', (data) => {
    const banner = document.getElementById('announcementBanner');
    banner.style.backgroundColor = "var(--danger)";
    banner.innerText = `⏰ Time's up! Switching character...`;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 5000);
});

socket.on('wrong_guess', () => {
    const msg = document.getElementById('message');
    msg.style.color = "var(--danger)";
    msg.innerText = "Incorrect! Try again.";
    msg.classList.add('shake');
    setTimeout(() => msg.classList.remove('shake'), 500);
});

function submitGuess() {
    if (!currentUser) {
        alert("You must be logged in to guess!");
        window.location.href = 'auth.html';
        return;
    }

    // Stop them from clicking if the cooldown is active
    if (isOnCooldown) return; 

    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    const guess = guessInput.value;
    if (guess.trim() !== "") {
        // Now we send BOTH the guess and which category we are guessing for
        socket.emit('submit_guess', { username: currentUser, guess: guess, category: currentCategory });
       
        // --- Trigger UI Cooldown ---
        isOnCooldown = true;
        const originalText = guessBtn.innerText;
        
        // Visually disable the button
        guessBtn.innerText = "Wait...";
        guessBtn.style.opacity = "0.5";
        guessBtn.style.cursor = "not-allowed";
        
        // Re-enable after 2 seconds
        setTimeout(() => {
            isOnCooldown = false;
            guessBtn.innerText = originalText;
            guessBtn.style.opacity = "1";
            guessBtn.style.cursor = "pointer";
            guessInput.focus(); // Put their cursor back in the box automatically!
        }, 2000);
    }
}


// Listen for the server's spam warning (in case a bot bypasses the UI)
socket.on('spam_warning', (data) => {
    const msg = document.getElementById('message');
    msg.style.color = "var(--warning)"; // Yellow/Orange warning color
    msg.innerText = data.message;
    msg.classList.add('shake');
    setTimeout(() => msg.classList.remove('shake'), 500);
});


function startFrontendTimer(startTime, duration) {
    clearInterval(countdownInterval);
    const timerDisplay = document.getElementById('timer');

    countdownInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = duration - elapsed;

        if (remaining <= 0) {
            clearInterval(countdownInterval);
            timerDisplay.innerText = "00:00";
        } else {
            const minutes = Math.floor(remaining / 60000);
            const seconds = ((remaining % 60000) / 1000).toFixed(0);
            timerDisplay.innerText = `${minutes}:${(seconds < 10 ? "0" : "")}${seconds}`;
        }
    }, 1000);
}