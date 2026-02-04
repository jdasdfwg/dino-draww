// ============================================
// DINO RUNNER - UMBRELLA EDITION
// Chrome Dino-style game with asteroid defense
// ============================================

// Canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const currentScoreEl = document.getElementById('currentScore');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');
const gameContainer = document.getElementById('game-container');

// ============================================
// FIREBASE LEADERBOARD
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyAzLOElssndIfehCs8X10Az61aO9SBl9Ak",
    authDomain: "dino-runner-leaderboard.firebaseapp.com",
    projectId: "dino-runner-leaderboard",
    storageBucket: "dino-runner-leaderboard.firebasestorage.app",
    messagingSenderId: "1042204481478",
    appId: "1:1042204481478:web:815bfdd337f19c9134c4c7",
    measurementId: "G-V1R7S29F5H"
};

// Initialize Firebase
let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch (e) {
    console.log('Firebase initialization error:', e);
}

// Get today's date string for daily leaderboard (PST timezone)
function getTodayString() {
    const now = new Date();
    // Convert to PST/PDT (America/Los_Angeles)
    const pstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const year = pstDate.getFullYear();
    const month = String(pstDate.getMonth() + 1).padStart(2, '0');
    const day = String(pstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD in PST
}

// Submit score to leaderboard
async function submitScore(playerName, playerScore, isVictory = false) {
    if (!db) return null;
    
    const scoreData = {
        name: playerName.toUpperCase().substring(0, 3),
        score: playerScore,
        date: getTodayString(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        victory: isVictory
    };
    
    try {
        const docRef = await db.collection('scores').add(scoreData);
        return docRef.id;
    } catch (e) {
        console.error('Error submitting score:', e);
        return null;
    }
}

// Get leaderboard (today or all-time)
async function getLeaderboard(type = 'today', limit = 10) {
    if (!db) return [];
    
    try {
        // Get all scores sorted by score (works without index)
        const snapshot = await db.collection('scores')
            .orderBy('score', 'desc')
            .limit(100) // Get more to filter
            .get();
        
        let scores = [];
        snapshot.forEach(doc => {
            scores.push({ id: doc.id, ...doc.data() });
        });
        
        // Filter for today if needed
        if (type === 'today') {
            const today = getTodayString();
            scores = scores.filter(s => s.date === today);
        }
        
        // Return top entries
        return scores.slice(0, limit);
    } catch (e) {
        console.error('Error getting leaderboard:', e);
        return [];
    }
}

// Get player's rank
async function getPlayerRank(playerScore, type = 'today') {
    if (!db) return null;
    
    try {
        // Get all scores and count how many are higher
        const snapshot = await db.collection('scores')
            .where('score', '>', playerScore)
            .get();
        
        let higherScores = [];
        snapshot.forEach(doc => {
            higherScores.push({ id: doc.id, ...doc.data() });
        });
        
        // Filter for today if needed
        if (type === 'today') {
            const today = getTodayString();
            higherScores = higherScores.filter(s => s.date === today);
        }
        
        return higherScores.length + 1;
    } catch (e) {
        console.error('Error getting rank:', e);
        return null;
    }
}

// Display leaderboard in UI
async function displayLeaderboard(containerId, type = 'today', playerScore = null, playerName = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading...</div>';
    
    const scores = await getLeaderboard(type, 10);
    
    if (scores.length === 0) {
        container.innerHTML = '<div class="no-scores">No scores yet. Be the first!</div>';
        return;
    }
    
    let html = '';
    scores.forEach((entry, index) => {
        const isPlayer = playerName && entry.name === playerName.toUpperCase() && entry.score === playerScore;
        html += `
            <div class="leaderboard-entry ${isPlayer ? 'highlight' : ''}">
                <span class="leaderboard-rank">${index + 1}.</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-score">${entry.score.toString().padStart(5, '0')}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Initialize leaderboard UI event listeners
function initLeaderboard() {
    // Game Over screen
    const nameInput = document.getElementById('name-input');
    const submitBtn = document.getElementById('btn-submit-score');
    const nameEntry = document.getElementById('name-entry');
    const leaderboard = document.getElementById('leaderboard');
    const tabToday = document.getElementById('tab-today');
    const tabAlltime = document.getElementById('tab-alltime');
    
    // Victory screen
    const victoryNameInput = document.getElementById('victory-name-input');
    const victorySubmitBtn = document.getElementById('btn-victory-submit');
    const victoryNameEntry = document.getElementById('victory-name-entry');
    const victoryLeaderboard = document.getElementById('victory-leaderboard');
    const victoryTabToday = document.getElementById('victory-tab-today');
    const victoryTabAlltime = document.getElementById('victory-tab-alltime');
    
    // Load saved name
    const savedName = localStorage.getItem('dinoPlayerName') || '';
    if (nameInput) nameInput.value = savedName;
    if (victoryNameInput) victoryNameInput.value = savedName;
    
    // Submit score handler (game over)
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim() || 'AAA';
            localStorage.setItem('dinoPlayerName', name);
            
            submitBtn.textContent = '...';
            submitBtn.disabled = true;
            nameInput.disabled = true;
            
            try {
                await submitScore(name, score, false);
                submitBtn.textContent = 'DONE!';
                
                // Refresh leaderboard to show new score
                await displayLeaderboard('leaderboard-list', 'today', score, name);
                
                // Update rank
                const todayRank = await getPlayerRank(score, 'today');
                const rankDisplay = document.getElementById('rank-display');
                if (rankDisplay && todayRank) {
                    rankDisplay.textContent = `Your rank: #${todayRank} today`;
                }
            } catch (e) {
                console.error('Submit error:', e);
                submitBtn.textContent = 'ERROR';
            }
        });
    }
    
    // Submit score handler (victory)
    if (victorySubmitBtn) {
        victorySubmitBtn.addEventListener('click', async () => {
            const name = victoryNameInput.value.trim() || 'AAA';
            localStorage.setItem('dinoPlayerName', name);
            
            victorySubmitBtn.textContent = '...';
            victorySubmitBtn.disabled = true;
            victoryNameInput.disabled = true;
            
            try {
                await submitScore(name, score, true);
                victorySubmitBtn.textContent = 'DONE!';
                
                // Refresh leaderboard to show new score
                await displayLeaderboard('victory-leaderboard-list', 'today', score, name);
                
                // Update rank
                const todayRank = await getPlayerRank(score, 'today');
                const rankDisplay = document.getElementById('victory-rank-display');
                if (rankDisplay && todayRank) {
                    rankDisplay.textContent = `Your rank: #${todayRank} today`;
                }
            } catch (e) {
                console.error('Submit error:', e);
                victorySubmitBtn.textContent = 'ERROR';
            }
        });
    }
    
    // Tab handlers (game over)
    if (tabToday) {
        tabToday.addEventListener('click', () => {
            tabToday.classList.add('active');
            tabAlltime.classList.remove('active');
            displayLeaderboard('leaderboard-list', 'today', score, nameInput.value);
        });
    }
    
    if (tabAlltime) {
        tabAlltime.addEventListener('click', () => {
            tabAlltime.classList.add('active');
            tabToday.classList.remove('active');
            displayLeaderboard('leaderboard-list', 'alltime', score, nameInput.value);
        });
    }
    
    // Tab handlers (victory)
    if (victoryTabToday) {
        victoryTabToday.addEventListener('click', () => {
            victoryTabToday.classList.add('active');
            victoryTabAlltime.classList.remove('active');
            displayLeaderboard('victory-leaderboard-list', 'today', score, victoryNameInput.value);
        });
    }
    
    if (victoryTabAlltime) {
        victoryTabAlltime.addEventListener('click', () => {
            victoryTabAlltime.classList.add('active');
            victoryTabToday.classList.remove('active');
            displayLeaderboard('victory-leaderboard-list', 'alltime', score, victoryNameInput.value);
        });
    }
    
    // Auto-uppercase name inputs
    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        });
    }
    if (victoryNameInput) {
        victoryNameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        });
    }
}

// Reset leaderboard UI for new game
function resetLeaderboardUI() {
    const nameInput = document.getElementById('name-input');
    const submitBtn = document.getElementById('btn-submit-score');
    const rankDisplay = document.getElementById('rank-display');
    
    const victoryNameInput = document.getElementById('victory-name-input');
    const victorySubmitBtn = document.getElementById('btn-victory-submit');
    const victoryRankDisplay = document.getElementById('victory-rank-display');
    
    // Reset game over inputs
    if (nameInput) nameInput.disabled = false;
    if (submitBtn) {
        submitBtn.textContent = 'SUBMIT';
        submitBtn.disabled = false;
    }
    if (rankDisplay) rankDisplay.textContent = '';
    
    // Reset victory inputs
    if (victoryNameInput) victoryNameInput.disabled = false;
    if (victorySubmitBtn) {
        victorySubmitBtn.textContent = 'SUBMIT';
        victorySubmitBtn.disabled = false;
    }
    if (victoryRankDisplay) victoryRankDisplay.textContent = '';
    
    // Reset tabs
    document.querySelectorAll('.tab-btn').forEach(tab => {
        if (tab.id.includes('today')) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// ============================================
// GAME CONSTANTS
// ============================================
const GROUND_Y = 325;           // Ground level (canvas is 375 tall)
const GRAVITY = 0.8;            // Gravity strength
const JUMP_FORCE = -15;         // Jump velocity
const BASE_SPEED = 5;           // Starting game speed
const MAX_SPEED = 18;           // Maximum game speed
const SPEED_INCREMENT = 0.002;  // Speed increase per frame (faster ramp up)

// ============================================
// GAME STATE
// ============================================
let gameState = 'start'; // 'start', 'playing', 'paused', 'gameover', 'victory'
let score = 0;
let highScore = parseInt(localStorage.getItem('dinoHighScore')) || 0;
let gameSpeed = BASE_SPEED;
let frameCount = 0;

// Era system based on levels
// Level 1: Normal
// Level 2-3: Volcano Era
// Level 4-5: Ice Age (Iceberg)
// Level 6-7: Beach (Palm Tree)
// Level 8-10: Civilization (Empire State Building)
let currentEra = 'normal'; // 'normal', 'volcano', 'ice', 'beach', 'civilization'

// Level system
let currentLevel = 1;
const POINTS_PER_LEVEL = 250;
const MAX_LEVEL = 10;
const WIN_SCORE = (MAX_LEVEL * POINTS_PER_LEVEL) + POINTS_PER_LEVEL; // 2750 points to win
let freePlayMode = false;
let levelUpAnimation = 0; // Timer for level up animation

// Bonus text popups
const bonusTexts = [];

// ============================================
// SOUND SYSTEM (Web Audio API)
// ============================================
let audioCtx = null;
let isMuted = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(frequency, duration, type = 'square', volume = 0.3) {
    if (isMuted || !audioCtx) return;
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

// Sound effects
function playJumpSound() {
    if (isMuted || !audioCtx) return;
    playTone(400, 0.1, 'square', 0.2);
    setTimeout(() => playTone(600, 0.1, 'square', 0.15), 50);
}

function playUmbrellaOpenSound() {
    if (isMuted || !audioCtx) return;
    playTone(300, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(450, 0.1, 'sine', 0.15), 50);
}

function playBlockSound() {
    if (isMuted || !audioCtx) return;
    playTone(800, 0.05, 'square', 0.25);
    setTimeout(() => playTone(600, 0.1, 'square', 0.2), 30);
    setTimeout(() => playTone(400, 0.15, 'square', 0.15), 60);
}

function playUmbrellaBreakSound() {
    if (isMuted || !audioCtx) return;
    playTone(200, 0.1, 'sawtooth', 0.3);
    setTimeout(() => playTone(150, 0.15, 'sawtooth', 0.25), 50);
    setTimeout(() => playTone(100, 0.2, 'sawtooth', 0.2), 100);
}

function playBonusSound() {
    if (isMuted || !audioCtx) return;
    playTone(880, 0.08, 'sine', 0.2);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.15), 60);
}

function playLevelUpSound() {
    if (isMuted || !audioCtx) return;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.15, 'square', 0.2), i * 100);
    });
}

function playGameOverSound() {
    if (isMuted || !audioCtx) return;
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, 'square', 0.25), i * 150);
    });
}

function playVictorySound() {
    if (isMuted || !audioCtx) return;
    const notes = [523, 659, 784, 1047, 1047, 784, 1047]; // Fanfare
    const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.15, 0.4];
    let time = 0;
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, durations[i], 'square', 0.25), time);
        time += durations[i] * 700;
    });
}

function playStartSound() {
    if (isMuted || !audioCtx) return;
    playTone(440, 0.1, 'square', 0.2);
    setTimeout(() => playTone(550, 0.1, 'square', 0.2), 80);
    setTimeout(() => playTone(660, 0.15, 'square', 0.2), 160);
}

function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('btn-mute');
    btn.textContent = '♪';
    btn.style.textDecoration = isMuted ? 'line-through' : 'none';
}

// ============================================
// INPUT STATE
// ============================================
const keys = {
    jump: false,      // Space or J
    umbrella: false   // U key
};

// ============================================
// PLAYER (DINOSAUR)
// ============================================
const player = {
    x: 80,
    y: GROUND_Y,
    width: 40,
    height: 50,
    velocityY: 0,
    isJumping: false,
    isUmbrellaActive: false,
    umbrellaBroken: false, // When true, umbrella can't be used until button released
    
    // Umbrella hitbox (above player)
    umbrellaWidth: 60,
    umbrellaHeight: 15,
    
    reset() {
        this.y = GROUND_Y;
        this.velocityY = 0;
        this.isJumping = false;
        this.isUmbrellaActive = false;
        this.umbrellaBroken = false;
    },
    
    update() {
        // Handle umbrella - can be used anytime (including mid-air)
        // If umbrella is broken, must release button before using again
        if (keys.umbrella) {
            if (!this.umbrellaBroken) {
                if (!this.isUmbrellaActive) {
                    playUmbrellaOpenSound();
                }
                this.isUmbrellaActive = true;
            }
        } else {
            this.isUmbrellaActive = false;
            this.umbrellaBroken = false; // Reset broken state when button released
        }
        
        // Handle jump - can only START a jump when on ground and not using umbrella
        // (once in the air, umbrella can be activated)
        if (keys.jump && !this.isJumping && !this.isUmbrellaActive) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            playJumpSound();
        }
        
        // Apply gravity
        this.velocityY += GRAVITY;
        
        // Umbrella slows falling (parachute effect)
        if (this.isUmbrellaActive && this.velocityY > 0) {
            this.y += this.velocityY * 0.5; // Half speed when falling with umbrella
        } else {
            this.y += this.velocityY;
        }
        
        // Ground collision
        if (this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.velocityY = 0;
            this.isJumping = false;
        }
    },
    
    draw() {
        ctx.fillStyle = '#535353';
        
        // Draw dinosaur body
        const drawY = this.y - this.height;
        
        // Body
        ctx.fillRect(this.x, drawY + 15, 30, 35);
        
        // Head
        ctx.fillRect(this.x + 15, drawY, 25, 20);
        
        // Eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x + 32, drawY + 5, 5, 5);
        
        ctx.fillStyle = '#535353';
        
        // Legs (animated)
        const legOffset = Math.sin(frameCount * 0.3) * 5;
        if (!this.isJumping) {
            ctx.fillRect(this.x + 5, drawY + 45, 8, 10 + legOffset);
            ctx.fillRect(this.x + 18, drawY + 45, 8, 10 - legOffset);
        } else {
            // Tucked legs when jumping
            ctx.fillRect(this.x + 5, drawY + 42, 8, 8);
            ctx.fillRect(this.x + 18, drawY + 42, 8, 8);
        }
        
        // Tail
        ctx.fillRect(this.x - 15, drawY + 20, 18, 10);
        
        // Draw umbrella if active
        if (this.isUmbrellaActive) {
            this.drawUmbrella(drawY);
        }
    },
    
    drawUmbrella(dinoY) {
        const umbrellaX = this.x - 10;
        const umbrellaY = dinoY - 30;
        
        ctx.fillStyle = '#535353';
        
        // Umbrella canopy (dome shape using arc)
        ctx.beginPath();
        ctx.arc(umbrellaX + 30, umbrellaY + 15, 35, Math.PI, 0, false);
        ctx.fill();
        
        // Umbrella handle
        ctx.fillRect(this.x + 18, dinoY - 5, 4, 25);
        
        // Umbrella edge decorations
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(umbrellaX + 5 + i * 13, umbrellaY + 15, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    
    // Get umbrella hitbox for collision detection
    // Made wider and taller to catch asteroids falling straight down
    getUmbrellaHitbox() {
        return {
            x: this.x - 25,
            y: this.y - this.height - 60,
            width: 90,
            height: 80
        };
    },
    
    // Get player hitbox
    getHitbox() {
        return {
            x: this.x,
            y: this.y - this.height + 10,
            width: this.width - 5,
            height: this.height - 10
        };
    }
};

// ============================================
// OBSTACLES - CACTUS
// ============================================
const cacti = [];

let cactusIdCounter = 0;

function spawnCactus() {
    const types = [
        { width: 20, height: 40 },  // Small
        { width: 25, height: 50 },  // Medium
        { width: 35, height: 45 }   // Wide
    ];
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    cacti.push({
        id: cactusIdCounter++,
        x: canvas.width + 50,
        y: GROUND_Y - type.height,
        width: type.width,
        height: type.height
    });
}

function updateCacti() {
    for (let i = cacti.length - 1; i >= 0; i--) {
        cacti[i].x -= gameSpeed;
        
        // Remove off-screen cacti
        if (cacti[i].x + cacti[i].width < 0) {
            cacti.splice(i, 1);
        }
    }
}

function drawCacti() {
    cacti.forEach(obstacle => {
        // Draw different obstacles based on current era
        if (currentEra === 'ice') {
            drawSpikyIceberg(obstacle);
        } else if (currentEra === 'beach') {
            drawCoconutPile(obstacle);
        } else if (currentEra === 'civilization') {
            drawFireHydrant(obstacle);
        } else {
            drawCactus(obstacle);
        }
    });
}

function drawCactus(cactus) {
    ctx.fillStyle = '#535353';
    // Main trunk
    ctx.fillRect(cactus.x, cactus.y, cactus.width, cactus.height);
    
    // Arms
    if (cactus.width > 22) {
        // Left arm
        ctx.fillRect(cactus.x - 8, cactus.y + 10, 10, 5);
        ctx.fillRect(cactus.x - 8, cactus.y + 5, 5, 15);
        
        // Right arm
        ctx.fillRect(cactus.x + cactus.width - 2, cactus.y + 15, 10, 5);
        ctx.fillRect(cactus.x + cactus.width + 3, cactus.y + 10, 5, 15);
    }
}

function drawSpikyIceberg(obstacle) {
    const x = obstacle.x;
    const y = obstacle.y;
    const w = obstacle.width;
    const h = obstacle.height;
    
    // Main iceberg body (darker grey)
    ctx.fillStyle = '#5a6a70';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w * 0.2, y + h * 0.3);
    ctx.lineTo(x + w * 0.4, y + h * 0.5);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.6, y + h * 0.4);
    ctx.lineTo(x + w * 0.8, y + h * 0.2);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    
    // Ice highlights (medium grey)
    ctx.fillStyle = '#7a8a90';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.55, y + h * 0.25);
    ctx.lineTo(x + w * 0.45, y + h * 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Dark edges for spiky look
    ctx.fillStyle = '#3a4a50';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.8, y + h * 0.2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w * 0.85, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
}

function drawCoconutPile(obstacle) {
    const x = obstacle.x;
    const y = obstacle.y;
    const w = obstacle.width;
    const h = obstacle.height;
    
    ctx.fillStyle = '#5a4a3a';
    
    // Bottom row of coconuts
    const coconutR = Math.min(w / 3, h / 3);
    ctx.beginPath();
    ctx.arc(x + coconutR, y + h - coconutR, coconutR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h - coconutR, coconutR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - coconutR, y + h - coconutR, coconutR, 0, Math.PI * 2);
    ctx.fill();
    
    // Top coconut
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h - coconutR * 2.5, coconutR * 0.9, 0, Math.PI * 2);
    ctx.fill();
    
    // Coconut details (three dots on each)
    ctx.fillStyle = '#3a2a1a';
    const dots = [[x + coconutR, y + h - coconutR], [x + w / 2, y + h - coconutR], [x + w - coconutR, y + h - coconutR], [x + w / 2, y + h - coconutR * 2.5]];
    dots.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy + 3, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFireHydrant(obstacle) {
    const x = obstacle.x;
    const y = obstacle.y;
    const w = obstacle.width;
    const h = obstacle.height;
    
    // Main body (dark grey for monochrome theme)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.7);
    
    // Top dome
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.3, w * 0.3, Math.PI, 0, false);
    ctx.fill();
    
    // Top cap
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + w * 0.25, y, w * 0.5, h * 0.15);
    
    // Side nozzles
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(x, y + h * 0.4, w * 0.25, h * 0.15);
    ctx.fillRect(x + w * 0.75, y + h * 0.4, w * 0.25, h * 0.15);
    
    // Base
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + w * 0.1, y + h * 0.85, w * 0.8, h * 0.15);
    
    // Center bolt
    ctx.fillStyle = '#6a6a6a';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.55, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================
// OBSTACLES - ASTEROIDS
// ============================================
const asteroids = [];

function spawnAsteroid() {
    const size = 25 + Math.random() * 15;
    
    // Difficulty progression
    const difficultyProgress = Math.min(1, frameCount / 3000);
    
    // Fall speed - slower for first 5 levels, then normal
    let baseFallSpeed = 3.5 + difficultyProgress * 2.5;
    if (currentLevel <= 5) {
        baseFallSpeed = 2.5 + difficultyProgress * 1.5; // Slower fall for levels 1-5
    }
    
    let spawnX, spawnY, speedX, speedY;
    
    // 10% chance: spawn from right side, dino runs into them as they fall
    if (Math.random() < 0.1) {
        spawnX = canvas.width - 50 + Math.random() * 100; // Spawn near right edge
        spawnY = -size - 20; // Start from top like normal
        speedX = -(3 + Math.random() * 2); // Travel left at -3 to -5 (towards dino)
        speedY = baseFallSpeed * 0.8; // Fall slightly slower so dino runs into them
    } else {
        // 90%: spawn above player, fall mostly straight down
        spawnX = player.x + (Math.random() - 0.5) * 60; // -30 to +30 from player center
        spawnY = -size - 20;
        speedX = (Math.random() - 0.5) * 0.8; // -0.4 to +0.4 (nearly straight)
        speedY = baseFallSpeed + Math.random() * 1;
    }
    
    // Pre-generate asteroid shape (so it doesn't flicker)
    const shapeVariance = [];
    for (let i = 0; i < 8; i++) {
        shapeVariance.push(0.7 + Math.random() * 0.3);
    }
    
    asteroids.push({
        x: spawnX,
        y: spawnY,
        width: size,
        height: size,
        speedY: speedY,
        speedX: speedX,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        shape: shapeVariance
    });
}

function updateAsteroids() {
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        asteroid.x += asteroid.speedX;
        asteroid.y += asteroid.speedY;
        asteroid.rotation += asteroid.rotationSpeed;
        
        // Remove off-screen asteroids
        if (asteroid.y > canvas.height + 50 || asteroid.x < -50) {
            asteroids.splice(i, 1);
        }
    }
}

function drawAsteroids() {
    asteroids.forEach(asteroid => {
        ctx.save();
        ctx.translate(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2);
        ctx.rotate(asteroid.rotation);
        
        ctx.fillStyle = '#535353';
        
        // Draw jagged asteroid shape using pre-generated variance
        ctx.beginPath();
        const points = 8;
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const radius = asteroid.width / 2 * asteroid.shape[i];
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Crater details
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(-3, -2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, 4, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
}

// ============================================
// BACKGROUND ELEMENTS
// ============================================
const clouds = [];
const groundLines = [];

// Era landmarks - all at same X position, rise/fall based on era
const LANDMARK_X = 700;

// Volcano (Level 2-3)
const volcano = {
    x: LANDMARK_X,
    baseY: GROUND_Y,
    width: 80,
    height: 100,
    currentHeight: 0,
    targetHeight: 0,
    eruptionParticles: [],
    lavaGlow: 0
};

// Iceberg (Level 4-5 - Ice Age)
const iceberg = {
    x: LANDMARK_X,
    baseY: GROUND_Y,
    width: 90,
    height: 120,
    currentHeight: 0,
    targetHeight: 0
};

// Palm Tree (Level 6-7 - Beach)
const palmTree = {
    x: LANDMARK_X + 20,
    baseY: GROUND_Y,
    width: 50,
    height: 110,
    currentHeight: 0,
    targetHeight: 0
};

// Empire State Building (Level 8-10 - Civilization)
const empireState = {
    x: LANDMARK_X,
    baseY: GROUND_Y,
    width: 60,
    height: 140,
    currentHeight: 0,
    targetHeight: 0
};

// Fire trail particles (behind asteroids in volcano era)
const fireParticles = [];

function initBackground() {
    // Initialize clouds
    for (let i = 0; i < 5; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: 30 + Math.random() * 50,
            width: 40 + Math.random() * 30
        });
    }
    
    // Initialize ground texture lines
    for (let i = 0; i < 20; i++) {
        groundLines.push({
            x: Math.random() * canvas.width,
            width: 10 + Math.random() * 30
        });
    }
}

function updateBackground() {
    // Update clouds
    clouds.forEach(cloud => {
        cloud.x -= gameSpeed * 0.2;
        if (cloud.x + cloud.width < 0) {
            cloud.x = canvas.width + 50;
            cloud.y = 30 + Math.random() * 50;
        }
    });
    
    // Update ground lines
    groundLines.forEach(line => {
        line.x -= gameSpeed;
        if (line.x + line.width < 0) {
            line.x = canvas.width + Math.random() * 100;
        }
    });
    
    // Update all landmarks (they rise/fall based on era)
    updateLandmarks();
    updateFireParticles();
}

function updateLandmarks() {
    const riseSpeed = 0.8;
    const fallSpeed = 1.2;
    
    // Update volcano height
    if (volcano.currentHeight < volcano.targetHeight) {
        volcano.currentHeight = Math.min(volcano.targetHeight, volcano.currentHeight + riseSpeed);
    } else if (volcano.currentHeight > volcano.targetHeight) {
        volcano.currentHeight = Math.max(volcano.targetHeight, volcano.currentHeight - fallSpeed);
    }
    
    // Update iceberg height
    if (iceberg.currentHeight < iceberg.targetHeight) {
        iceberg.currentHeight = Math.min(iceberg.targetHeight, iceberg.currentHeight + riseSpeed);
    } else if (iceberg.currentHeight > iceberg.targetHeight) {
        iceberg.currentHeight = Math.max(iceberg.targetHeight, iceberg.currentHeight - fallSpeed);
    }
    
    // Update palm tree height
    if (palmTree.currentHeight < palmTree.targetHeight) {
        palmTree.currentHeight = Math.min(palmTree.targetHeight, palmTree.currentHeight + riseSpeed);
    } else if (palmTree.currentHeight > palmTree.targetHeight) {
        palmTree.currentHeight = Math.max(palmTree.targetHeight, palmTree.currentHeight - fallSpeed);
    }
    
    // Update empire state height
    if (empireState.currentHeight < empireState.targetHeight) {
        empireState.currentHeight = Math.min(empireState.targetHeight, empireState.currentHeight + riseSpeed);
    } else if (empireState.currentHeight > empireState.targetHeight) {
        empireState.currentHeight = Math.max(empireState.targetHeight, empireState.currentHeight - fallSpeed);
    }
    
    // Volcano eruption particles (only when visible)
    if (volcano.currentHeight > volcano.height * 0.8) {
        volcano.lavaGlow = 0.5 + Math.sin(frameCount * 0.1) * 0.3;
        
        if (Math.random() < 0.15) {
            volcano.eruptionParticles.push({
                x: volcano.x + volcano.width / 2 + (Math.random() - 0.5) * 20,
                y: volcano.baseY - volcano.currentHeight,
                vx: (Math.random() - 0.5) * 3,
                vy: -3 - Math.random() * 4,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                size: 4 + Math.random() * 6,
                type: Math.random() < 0.7 ? 'fire' : 'rock'
            });
        }
    }
    
    // Update eruption particles
    for (let i = volcano.eruptionParticles.length - 1; i >= 0; i--) {
        const p = volcano.eruptionParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        if (p.life <= 0 || p.y > GROUND_Y) {
            volcano.eruptionParticles.splice(i, 1);
        }
    }
}

function updateFireParticles() {
    // Only spawn fire behind asteroids in volcano era
    if (currentEra === 'volcano') {
        asteroids.forEach(asteroid => {
            if (Math.random() < 0.4) {
                fireParticles.push({
                    x: asteroid.x + asteroid.width / 2 + (Math.random() - 0.5) * 10,
                    y: asteroid.y - asteroid.height / 2 + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -1 - Math.random() * 2,
                    life: 15 + Math.random() * 10,
                    maxLife: 25,
                    size: 3 + Math.random() * 5
                });
            }
        });
    }
    
    // Update fire particles
    for (let i = fireParticles.length - 1; i >= 0; i--) {
        const p = fireParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.size *= 0.95;
        if (p.life <= 0) {
            fireParticles.splice(i, 1);
        }
    }
}

function drawVolcano() {
    if (volcano.currentHeight <= 0) return;
    
    // Draw volcano mountain
    ctx.fillStyle = '#3d3d3d';
    ctx.beginPath();
    ctx.moveTo(volcano.x, volcano.baseY);
    ctx.lineTo(volcano.x + volcano.width / 2 - 15, volcano.baseY - volcano.currentHeight);
    ctx.lineTo(volcano.x + volcano.width / 2 + 15, volcano.baseY - volcano.currentHeight);
    ctx.lineTo(volcano.x + volcano.width, volcano.baseY);
    ctx.closePath();
    ctx.fill();
    
    // Draw crater glow
    if (volcano.currentHeight >= volcano.height * 0.8) {
        const gradient = ctx.createRadialGradient(
            volcano.x + volcano.width / 2, volcano.baseY - volcano.currentHeight + 5, 5,
            volcano.x + volcano.width / 2, volcano.baseY - volcano.currentHeight + 5, 25
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${volcano.lavaGlow})`);
        gradient.addColorStop(0.5, `rgba(200, 200, 200, ${volcano.lavaGlow * 0.5})`);
        gradient.addColorStop(1, 'rgba(150, 150, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(volcano.x + volcano.width / 2, volcano.baseY - volcano.currentHeight + 5, 25, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw eruption particles
    volcano.eruptionParticles.forEach(p => {
        const alpha = p.life / p.maxLife;
        const grey = p.type === 'fire' ? 180 + Math.floor(Math.random() * 50) : 60;
        ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawIceberg() {
    if (iceberg.currentHeight <= 0) return;
    
    const h = iceberg.currentHeight;
    const x = iceberg.x;
    const y = iceberg.baseY;
    
    // Main iceberg body (jagged shape)
    ctx.fillStyle = '#d0d0d0';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 15, y - h * 0.7);
    ctx.lineTo(x + 30, y - h * 0.5);
    ctx.lineTo(x + 45, y - h);
    ctx.lineTo(x + 60, y - h * 0.6);
    ctx.lineTo(x + 75, y - h * 0.8);
    ctx.lineTo(x + 90, y);
    ctx.closePath();
    ctx.fill();
    
    // Ice highlights
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.moveTo(x + 45, y - h);
    ctx.lineTo(x + 50, y - h * 0.7);
    ctx.lineTo(x + 40, y - h * 0.75);
    ctx.closePath();
    ctx.fill();
    
    // Darker ice shadows
    ctx.fillStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.moveTo(x + 60, y - h * 0.6);
    ctx.lineTo(x + 75, y - h * 0.8);
    ctx.lineTo(x + 80, y - h * 0.3);
    ctx.lineTo(x + 70, y - h * 0.4);
    ctx.closePath();
    ctx.fill();
}

function drawPalmTree() {
    if (palmTree.currentHeight <= 0) return;
    
    const h = palmTree.currentHeight;
    const x = palmTree.x;
    const y = palmTree.baseY;
    
    // Trunk
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + 30, y);
    ctx.lineTo(x + 28, y - h * 0.85);
    ctx.lineTo(x + 22, y - h * 0.85);
    ctx.closePath();
    ctx.fill();
    
    // Trunk texture lines
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
        const ty = y - (h * 0.85 * i / 8);
        ctx.beginPath();
        ctx.moveTo(x + 20, ty);
        ctx.lineTo(x + 30, ty);
        ctx.stroke();
    }
    
    // Palm fronds (grey leaves)
    ctx.fillStyle = '#707070';
    const leafY = y - h;
    
    // Left fronds
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x - 10, leafY - 10, x - 20, leafY + 20);
    ctx.quadraticCurveTo(x, leafY + 5, x + 25, leafY + 15);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x - 5, leafY - 25, x - 15, leafY - 5);
    ctx.quadraticCurveTo(x + 5, leafY, x + 25, leafY + 15);
    ctx.fill();
    
    // Right fronds
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x + 60, leafY - 10, x + 70, leafY + 20);
    ctx.quadraticCurveTo(x + 50, leafY + 5, x + 25, leafY + 15);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x + 55, leafY - 25, x + 65, leafY - 5);
    ctx.quadraticCurveTo(x + 45, leafY, x + 25, leafY + 15);
    ctx.fill();
    
    // Top frond
    ctx.beginPath();
    ctx.moveTo(x + 25, leafY + 15);
    ctx.quadraticCurveTo(x + 25, leafY - 30, x + 30, leafY - 20);
    ctx.quadraticCurveTo(x + 25, leafY - 10, x + 25, leafY + 15);
    ctx.fill();
}

function drawEmpireState() {
    if (empireState.currentHeight <= 0) return;
    
    const h = empireState.currentHeight;
    const x = empireState.x;
    const y = empireState.baseY;
    
    // Main building body
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + 10, y - h * 0.65, 40, h * 0.65);
    
    // Middle section (narrower)
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(x + 15, y - h * 0.8, 30, h * 0.15);
    
    // Upper section (even narrower)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + 20, y - h * 0.9, 20, h * 0.1);
    
    // Spire
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.moveTo(x + 27, y - h * 0.9);
    ctx.lineTo(x + 30, y - h);
    ctx.lineTo(x + 33, y - h * 0.9);
    ctx.closePath();
    ctx.fill();
    
    // Windows (grid pattern)
    ctx.fillStyle = '#707070';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
            const wx = x + 14 + col * 9;
            const wy = y - h * 0.6 + row * (h * 0.07);
            ctx.fillRect(wx, wy, 5, 4);
        }
    }
}

function drawLandmarks() {
    drawVolcano();
    drawIceberg();
    drawPalmTree();
    drawEmpireState();
}

function drawFireTrails() {
    if (currentEra !== 'volcano') return;
    
    fireParticles.forEach(p => {
        const alpha = p.life / p.maxLife;
        // Grey smoke trail (lighter when fresh, darker as it fades)
        const grey = Math.floor(150 + (100 * alpha));
        ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawBackground() {
    // Draw all landmarks behind everything
    drawLandmarks();
    
    // Draw clouds
    ctx.fillStyle = '#e0e0e0';
    clouds.forEach(cloud => {
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, 15, 0, Math.PI * 2);
        ctx.arc(cloud.x + 20, cloud.y - 5, 18, 0, Math.PI * 2);
        ctx.arc(cloud.x + 40, cloud.y, 15, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw ground line
    ctx.fillStyle = '#535353';
    ctx.fillRect(0, GROUND_Y, canvas.width, 2);
    
    // Draw ground texture
    ctx.fillStyle = '#c0c0c0';
    groundLines.forEach(line => {
        ctx.fillRect(line.x, GROUND_Y + 5, line.width, 2);
    });
}

// ============================================
// COLLISION DETECTION
// ============================================
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Track cacti that have been checked for near miss (to avoid double bonus)
const passedCacti = new Set();

function checkCollisions() {
    const playerHitbox = player.getHitbox();
    const umbrellaHitbox = player.getUmbrellaHitbox();
    
    // Check cactus collisions and near misses
    for (let i = cacti.length - 1; i >= 0; i--) {
        const cactus = cacti[i];
        
        // Check for collision
        if (checkCollision(playerHitbox, cactus)) {
            return true; // Game over
        }
        
        // Check for near miss bonus (player just cleared the cactus)
        if (player.isJumping && !passedCacti.has(cactus.id)) {
            const playerBottom = playerHitbox.y + playerHitbox.height;
            const cactusTop = cactus.y;
            const horizontalOverlap = playerHitbox.x < cactus.x + cactus.width && 
                                      playerHitbox.x + playerHitbox.width > cactus.x;
            
            // If player is directly above cactus with small clearance (within 25 pixels)
            if (horizontalOverlap && playerBottom < cactusTop && cactusTop - playerBottom < 25) {
                passedCacti.add(cactus.id);
                score += 25;
                createBonusText(cactus.x + cactus.width / 2, cactus.y - 20, 'CLOSE! +25', '#333');
                playBonusSound();
            }
        }
        
        // Clean up passed cacti tracking when cactus goes off screen
        if (cactus.x + cactus.width < 0) {
            passedCacti.delete(cactus.id);
        }
    }
    
    // Check asteroid collisions
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        
        // Check if umbrella blocks asteroid (catches it above player)
        if (player.isUmbrellaActive && checkCollision(umbrellaHitbox, asteroid)) {
            // Asteroid blocked! Remove it (no points)
            asteroids.splice(i, 1);
            createBlockEffect(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2);
            playBlockSound();
            continue;
        }
        
        // Check if asteroid hits player
        if (checkCollision(playerHitbox, asteroid)) {
            // If umbrella is active, it breaks but saves the dino
            if (player.isUmbrellaActive) {
                asteroids.splice(i, 1);
                player.umbrellaBroken = true; // Umbrella breaks
                player.isUmbrellaActive = false;
                createBlockEffect(asteroid.x + asteroid.width / 2, asteroid.y + asteroid.height / 2);
                createBonusText(player.x + 20, player.y - 60, 'UMBRELLA BREAK!', '#333');
                playUmbrellaBreakSound();
                continue;
            }
            return true; // Game over (no umbrella protection)
        }
    }
    
    return false;
}

// ============================================
// VISUAL EFFECTS
// ============================================
const particles = [];

function createBlockEffect(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 20,
            size: 3 + Math.random() * 4
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vy += 0.3; // Gravity on particles
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    ctx.fillStyle = '#535353';
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 20;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

function screenShake() {
    gameContainer.classList.add('shake');
    setTimeout(() => gameContainer.classList.remove('shake'), 300);
}

// ============================================
// BONUS TEXT POPUPS
// ============================================
function createBonusText(x, y, text, color) {
    bonusTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: 60,
        vy: -2
    });
}

function updateBonusTexts() {
    for (let i = bonusTexts.length - 1; i >= 0; i--) {
        const bt = bonusTexts[i];
        bt.y += bt.vy;
        bt.vy *= 0.95;
        bt.life--;
        
        if (bt.life <= 0) {
            bonusTexts.splice(i, 1);
        }
    }
}

function drawBonusTexts() {
    bonusTexts.forEach(bt => {
        const alpha = Math.min(1, bt.life / 30);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = bt.color;
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bt.text, bt.x, bt.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

// ============================================
// SCORING
// ============================================
function updateScore() {
    score++;
    
    // Check for level up
    const newLevel = Math.min(MAX_LEVEL, Math.floor(score / POINTS_PER_LEVEL) + 1);
    if (newLevel > currentLevel && currentLevel < MAX_LEVEL) {
        currentLevel = newLevel;
        levelUpAnimation = 120; // 2 seconds of animation
        createBonusText(canvas.width / 2, 80, 'LEVEL ' + currentLevel, '#222');
        playLevelUpSound();
        updateLevelDisplay();
        updateEra();
    }
    
    // Check for victory (after completing level 10)
    if (!freePlayMode && score >= WIN_SCORE) {
        victory();
        return;
    }
    
    // Format score with leading zeros
    currentScoreEl.textContent = score.toString().padStart(5, '0');
    
    // Update high score if beaten
    if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore.toString().padStart(5, '0');
        localStorage.setItem('dinoHighScore', highScore);
    }
}

function updateLevelDisplay() {
    const levelEl = document.getElementById('levelDisplay');
    if (levelEl) {
        if (freePlayMode) {
            levelEl.textContent = 'FREE PLAY';
        } else {
            levelEl.textContent = 'LV ' + currentLevel;
        }
    }
}

function updateEra() {
    // Determine era based on current level
    let newEra = 'normal';
    if (currentLevel >= 8) {
        newEra = 'civilization';
    } else if (currentLevel >= 6) {
        newEra = 'beach';
    } else if (currentLevel >= 4) {
        newEra = 'ice';
    } else if (currentLevel >= 2) {
        newEra = 'volcano';
    }
    
    if (newEra !== currentEra) {
        currentEra = newEra;
        
        // Set target heights based on era
        // Previous era landmarks go down, new one rises
        volcano.targetHeight = (currentEra === 'volcano') ? volcano.height : 0;
        iceberg.targetHeight = (currentEra === 'ice') ? iceberg.height : 0;
        palmTree.targetHeight = (currentEra === 'beach') ? palmTree.height : 0;
        empireState.targetHeight = (currentEra === 'civilization') ? empireState.height : 0;
    }
}

// ============================================
// SPAWN MANAGEMENT
// ============================================
let lastCactusSpawn = 0;
let lastAsteroidSpawn = 0;

// Check if there's a cactus in the "jump zone" - where player needs to jump
function isCactusInJumpZone() {
    const jumpZoneStart = player.x + 50;  // Close enough that player needs to jump soon
    const jumpZoneEnd = player.x + 200;   // Far enough that asteroid would conflict
    
    for (const cactus of cacti) {
        if (cactus.x > jumpZoneStart && cactus.x < jumpZoneEnd) {
            return true;
        }
    }
    return false;
}

// Check if there's already an asteroid threatening the player
function isAsteroidAlreadyThreatening() {
    // Check if any asteroid is falling above the player
    for (const asteroid of asteroids) {
        if (asteroid.x > player.x - 40 && 
            asteroid.x < player.x + 60 && 
            asteroid.y < GROUND_Y) {
            return true;
        }
    }
    return false;
}

function manageSpawns() {
    // Early game (first 20 seconds / 1200 frames) - easier spawning
    const isEarlyGame = frameCount < 1200;
    
    // Spawn cacti - interval decreases as speed increases
    // In early game, add extra spacing between cacti
    let cactusInterval = Math.max(50, 140 - gameSpeed * 6);
    if (isEarlyGame) {
        cactusInterval += 40; // Extra spacing in first 20 seconds
    }
    if (frameCount - lastCactusSpawn > cactusInterval + Math.random() * 80) {
        spawnCactus();
        lastCactusSpawn = frameCount;
    }
    
    // Spawn asteroids - starts easy, ramps up over time
    // Don't spawn asteroid if:
    // 1. There's a cactus in the jump zone (would require jumping + umbrella simultaneously)
    // 2. There's already an asteroid threatening the player
    
    // Difficulty scaling based on time played (frameCount)
    // Start very easy, ramp up gradually
    const difficultyProgress = Math.min(1, frameCount / 3000); // Takes ~50 seconds to reach max difficulty
    
    // Level-based asteroid frequency adjustment
    // Before level 6, asteroids spawn much less frequently
    const isBeforeLevel6 = currentLevel < 6;
    
    // Min interval: starts at 180, goes down to 60 at max difficulty
    // Before level 6: add extra 80 frames between spawns
    let minAsteroidInterval = Math.max(60, 180 - difficultyProgress * 120);
    if (isBeforeLevel6) {
        minAsteroidInterval += 80;
    }
    
    // Spawn chance: starts at 0.008 (0.8%), goes up to 0.05 (5%) at max difficulty
    // Before level 6: halve the spawn chance
    let asteroidChance = 0.008 + difficultyProgress * 0.042;
    if (isBeforeLevel6) {
        asteroidChance *= 0.5;
    }
    
    const canSpawnAsteroid = 
        score >= 110 && // No asteroids until score reaches 110
        !isCactusInJumpZone() && // No cactus requiring a jump
        !isAsteroidAlreadyThreatening() && // No existing asteroid threat
        frameCount - lastAsteroidSpawn > minAsteroidInterval;
    
    if (canSpawnAsteroid && Math.random() < asteroidChance) {
        spawnAsteroid();
        lastAsteroidSpawn = frameCount;
    }
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        frameCount++;
        
        // Update level up animation
        if (levelUpAnimation > 0) {
            levelUpAnimation--;
        }
        
        // Increase difficulty over time
        gameSpeed = Math.min(MAX_SPEED, BASE_SPEED + frameCount * SPEED_INCREMENT);
        
        // Update game objects
        player.update();
        updateCacti();
        updateAsteroids();
        updateBackground();
        updateParticles();
        updateBonusTexts();
        manageSpawns();
        
        // Check for collisions
        if (checkCollisions()) {
            gameOver();
        }
        
        // Update score every 5 frames
        if (frameCount % 5 === 0) {
            updateScore();
        }
    }
    
    // Draw everything
    drawBackground();
    drawFireTrails(); // Draw fire behind asteroids
    drawCacti();
    drawAsteroids();
    player.draw();
    drawParticles();
    drawBonusTexts();
    drawLevelUpAnimation();
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

function drawLevelUpAnimation() {
    if (levelUpAnimation <= 0) return;
    
    // Flash effect for level up
    const alpha = Math.sin(levelUpAnimation * 0.2) * 0.3;
    if (alpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================
function startGame() {
    initAudio();
    playStartSound();
    resetLeaderboardUI();
    gameState = 'playing';
    score = 0;
    gameSpeed = BASE_SPEED;
    frameCount = 0;
    lastCactusSpawn = 0;
    lastAsteroidSpawn = 0;
    currentEra = 'normal';
    currentLevel = 1;
    freePlayMode = false;
    levelUpAnimation = 0;
    
    // Clear obstacles
    cacti.length = 0;
    asteroids.length = 0;
    particles.length = 0;
    bonusTexts.length = 0;
    fireParticles.length = 0;
    passedCacti.clear();
    cactusIdCounter = 0;
    
    // Reset all landmarks
    volcano.eruptionParticles.length = 0;
    volcano.currentHeight = 0;
    volcano.targetHeight = 0;
    volcano.lavaGlow = 0;
    iceberg.currentHeight = 0;
    iceberg.targetHeight = 0;
    palmTree.currentHeight = 0;
    palmTree.targetHeight = 0;
    empireState.currentHeight = 0;
    empireState.targetHeight = 0;
    
    // Reset player
    player.reset();
    
    // Update UI
    currentScoreEl.textContent = '00000';
    highScoreEl.textContent = highScore.toString().padStart(5, '0');
    updateLevelDisplay();
    
    // Hide all screens
    startScreen.style.display = 'none';
    gameOverScreen.classList.add('hidden');
    const pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) pauseScreen.classList.add('hidden');
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) victoryScreen.classList.add('hidden');
}

function gameOver() {
    gameState = 'gameover';
    screenShake();
    playGameOverSound();
    
    // Show game over screen
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
    
    // Load leaderboard immediately
    displayLeaderboard('leaderboard-list', 'today');
    
    // Show estimated rank
    getPlayerRank(score, 'today').then(rank => {
        const rankDisplay = document.getElementById('rank-display');
        if (rankDisplay && rank) {
            rankDisplay.textContent = `Your rank: #${rank} today`;
        }
    });
}

function restartGame() {
    startGame();
}

function victory() {
    gameState = 'victory';
    playVictorySound();
    
    // Show victory screen
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) {
        document.getElementById('victoryScore').textContent = score;
        victoryScreen.classList.remove('hidden');
    }
    
    // Load leaderboard immediately
    displayLeaderboard('victory-leaderboard-list', 'today');
    
    // Show estimated rank
    getPlayerRank(score, 'today').then(rank => {
        const rankDisplay = document.getElementById('victory-rank-display');
        if (rankDisplay && rank) {
            rankDisplay.textContent = `Your rank: #${rank} today`;
        }
    });
}

function continueFreePlay() {
    freePlayMode = true;
    gameState = 'playing';
    updateLevelDisplay();
    
    // Hide victory screen
    const victoryScreen = document.getElementById('victory-screen');
    if (victoryScreen) {
        victoryScreen.classList.add('hidden');
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) {
            pauseScreen.classList.remove('hidden');
        }
    } else if (gameState === 'paused') {
        gameState = 'playing';
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) {
            pauseScreen.classList.add('hidden');
        }
    }
}

// ============================================
// INPUT HANDLING
// ============================================
document.addEventListener('keydown', (e) => {
    // Ignore key presses when typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Jump keys: Space or J
    if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        keys.jump = true;
        
        // Handle game state transitions
        if (gameState === 'start') {
            startGame();
        } else if (gameState === 'paused') {
            togglePause(); // Unpause with space
        }
    }
    
    // Y key to play again from game over
    if (e.code === 'KeyY') {
        if (gameState === 'gameover') {
            restartGame();
        }
    }
    
    // Umbrella key: U
    if (e.code === 'KeyU') {
        keys.umbrella = true;
    }
    
    // Pause key: P
    if (e.code === 'KeyP') {
        if (gameState === 'playing' || gameState === 'paused') {
            togglePause();
        }
    }
    
    // Mute key: M
    if (e.code === 'KeyM') {
        toggleMute();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'KeyJ') {
        keys.jump = false;
    }
    
    if (e.code === 'KeyU') {
        keys.umbrella = false;
    }
});

// Prevent spacebar from scrolling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
    }
});

// ============================================
// INITIALIZATION
// ============================================
function init() {
    // Load high score
    highScoreEl.textContent = highScore.toString().padStart(5, '0');
    
    // Initialize background
    initBackground();
    
    // Initialize touch controls if on touch device
    initTouchControls();
    
    // Initialize leaderboard
    initLeaderboard();
    
    // Start game loop
    gameLoop();
}

// ============================================
// MOBILE TOUCH CONTROLS
// ============================================
function initTouchControls() {
    const btnJump = document.getElementById('btn-jump');
    const btnUmbrella = document.getElementById('btn-umbrella');
    const btnStart = document.getElementById('btn-start');
    const btnRestart = document.getElementById('btn-restart');
    
    // START button - tap to start game
    if (btnStart) {
        btnStart.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'start') {
                startGame();
            }
        }, { passive: false });
        
        btnStart.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'start') {
                startGame();
            }
        });
    }
    
    // RESTART button - tap to restart game
    if (btnRestart) {
        btnRestart.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'gameover') {
                restartGame();
            }
        }, { passive: false });
        
        btnRestart.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'gameover') {
                restartGame();
            }
        });
    }
    
    if (!btnJump || !btnUmbrella) return;
    
    // JUMP button - tap to jump (same as Space/J)
    btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.jump = true;
        
        // Handle game state transitions (same as keyboard)
        if (gameState === 'start') {
            startGame();
        } else if (gameState === 'gameover') {
            restartGame();
        }
    }, { passive: false });
    
    btnJump.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.jump = false;
    }, { passive: false });
    
    btnJump.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys.jump = false;
    }, { passive: false });
    
    // UMBRELLA button - hold to use (same as holding U)
    btnUmbrella.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        initAudio(); // Ensure audio is ready
        keys.umbrella = true;
        // Immediately activate umbrella if playing (more responsive on mobile)
        if (gameState === 'playing' && !player.umbrellaBroken) {
            player.isUmbrellaActive = true;
        }
    }, { passive: false });
    
    btnUmbrella.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.umbrella = false;
    }, { passive: false });
    
    btnUmbrella.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys.umbrella = false;
    }, { passive: false });
    
    // PAUSE button
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
        btnPause.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'playing' || gameState === 'paused') {
                togglePause();
            }
        }, { passive: false });
        
        btnPause.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'playing' || gameState === 'paused') {
                togglePause();
            }
        });
    }
    
    // RESUME button (on pause screen)
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
        btnResume.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameState === 'paused') {
                togglePause();
            }
        }, { passive: false });
        
        btnResume.addEventListener('click', (e) => {
            e.preventDefault();
            if (gameState === 'paused') {
                togglePause();
            }
        });
    }
    
    // FREE PLAY button (on victory screen)
    const btnFreePlay = document.getElementById('btn-freeplay');
    if (btnFreePlay) {
        btnFreePlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            continueFreePlay();
        }, { passive: false });
        
        btnFreePlay.addEventListener('click', (e) => {
            e.preventDefault();
            continueFreePlay();
        });
    }
    
    // PLAY AGAIN button (on victory screen)
    const btnPlayAgain = document.getElementById('btn-playagain');
    if (btnPlayAgain) {
        btnPlayAgain.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startGame();
        }, { passive: false });
        
        btnPlayAgain.addEventListener('click', (e) => {
            e.preventDefault();
            startGame();
        });
    }
    
    // MUTE button
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
        btnMute.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMute();
        });
    }
}

// Start the game
init();
