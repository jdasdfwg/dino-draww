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
    apiKey: "AIzaSyC1hRXnxfsZx2Cm8dZU-wgfPCZWDeaNU5M",
    authDomain: "dino-draww.firebaseapp.com",
    projectId: "dino-draww",
    storageBucket: "dino-draww.firebasestorage.app",
    messagingSenderId: "949718341915",
    appId: "1:949718341915:web:50c9c26cc73ab7c653dbbe"
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
    const savedName = localStorage.getItem('dinoDrawwPlayerName') || '';
    if (nameInput) nameInput.value = savedName;
    if (victoryNameInput) victoryNameInput.value = savedName;
    
    // Game Over submit button
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (name.length < 1) {
                nameInput.focus();
                return;
            }
            
            localStorage.setItem('dinoDrawwPlayerName', name);
            submitBtn.disabled = true;
            submitBtn.textContent = '...';
            
            await submitScore(name, score, false);
            
            // Hide name entry, show submitted state
            nameEntry.innerHTML = `<p class="submitted-msg">Submitted as ${name.toUpperCase()}</p>`;
            
            // Refresh leaderboard
            displayLeaderboard('leaderboard-list', 'today', score, name);
        });
    }
    
    // Victory submit button
    if (victorySubmitBtn) {
        victorySubmitBtn.addEventListener('click', async () => {
            const name = victoryNameInput.value.trim();
            if (name.length < 1) {
                victoryNameInput.focus();
                return;
            }
            
            localStorage.setItem('dinoDrawwPlayerName', name);
            victorySubmitBtn.disabled = true;
            victorySubmitBtn.textContent = '...';
            
            await submitScore(name, score, true);
            
            // Hide name entry, show submitted state
            victoryNameEntry.innerHTML = `<p class="submitted-msg">Submitted as ${name.toUpperCase()}</p>`;
            
            // Refresh leaderboard
            displayLeaderboard('victory-leaderboard-list', 'today', score, name);
        });
    }
    
    // Tab switching - Game Over
    if (tabToday) {
        tabToday.addEventListener('click', () => {
            tabToday.classList.add('active');
            tabAlltime.classList.remove('active');
            displayLeaderboard('leaderboard-list', 'today');
        });
    }
    if (tabAlltime) {
        tabAlltime.addEventListener('click', () => {
            tabAlltime.classList.add('active');
            tabToday.classList.remove('active');
            displayLeaderboard('leaderboard-list', 'alltime');
        });
    }
    
    // Tab switching - Victory
    if (victoryTabToday) {
        victoryTabToday.addEventListener('click', () => {
            victoryTabToday.classList.add('active');
            victoryTabAlltime.classList.remove('active');
            displayLeaderboard('victory-leaderboard-list', 'today');
        });
    }
    if (victoryTabAlltime) {
        victoryTabAlltime.addEventListener('click', () => {
            victoryTabAlltime.classList.add('active');
            victoryTabToday.classList.remove('active');
            displayLeaderboard('victory-leaderboard-list', 'alltime');
        });
    }
}

// ============================================
// GAME CONSTANTS
// ============================================
const GROUND_Y = 325;           // Ground level (canvas is 375 tall)
const GRAVITY = 0.8;            // Gravity strength
const JUMP_FORCE = -15;         // Jump velocity
const BASE_SPEED = 7;           // Starting game speed (faster start!)
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
// Level 1: Normal (desert)
// Level 2+: Volcano Era (volcano rises in background)
let currentEra = 'normal'; // 'normal', 'volcano'

// Level system
let currentLevel = 1;
const POINTS_PER_LEVEL = 250;
const MAX_LEVEL = 10;
const WIN_SCORE = (MAX_LEVEL * POINTS_PER_LEVEL) + POINTS_PER_LEVEL; // 2750 points to win
let freePlayMode = false;
let levelUpAnimation = 0; // Timer for level up animation

// Kill combo system
let killCombo = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 180; // 3 seconds at 60fps to keep combo alive

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

function playBonusSound() {
    if (isMuted || !audioCtx) return;
    playTone(880, 0.08, 'sine', 0.2);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.15), 60);
}

// Combo kill sound with pitch ramp!
function playComboKillSound(comboCount) {
    if (isMuted || !audioCtx) return;
    // Pitch increases with combo (1x=880, 2x=990, 3x=1100, 4x=1210, 5x=1320)
    const basePitch = 880;
    const pitchMultiplier = 1 + (Math.min(comboCount, 5) - 1) * 0.125;
    const pitch = basePitch * pitchMultiplier;
    
    playTone(pitch, 0.1, 'square', 0.25);
    setTimeout(() => playTone(pitch * 1.25, 0.12, 'square', 0.2), 50);
    
    // Extra zing for high combos
    if (comboCount >= 3) {
        setTimeout(() => playTone(pitch * 1.5, 0.08, 'sine', 0.15), 100);
    }
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

function playShootSound() {
    if (isMuted || !audioCtx) return;
    // Quick gunshot sound - low thud followed by sharp crack
    playTone(150, 0.08, 'square', 0.4);
    setTimeout(() => playTone(800, 0.05, 'sawtooth', 0.2), 20);
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
    jump: false,     // Space or J
    shoot: false     // O key
};

// Bullets array
const bullets = [];
let shootCooldown = 0;
const SHOOT_COOLDOWN = 20; // Frames between shots

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
    jumpCount: 0,        // Track jumps for double jump
    canDoubleJump: true, // Reset when key released
    isShooting: false,
    shootAnimFrame: 0,
    
    reset() {
        this.y = GROUND_Y;
        this.velocityY = 0;
        this.isJumping = false;
        this.jumpCount = 0;
        this.canDoubleJump = true;
        this.isShooting = false;
        this.shootAnimFrame = 0;
    },
    
    update() {
        // Handle jump (with double jump)
        if (keys.jump && this.canDoubleJump && this.jumpCount < 2) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            this.jumpCount++;
            this.canDoubleJump = false; // Must release key to jump again
            playJumpSound();
        }
        
        // Reset double jump ability when key released
        if (!keys.jump) {
            this.canDoubleJump = true;
        }
        
        // Handle shooting - cowboy draw style!
        if (keys.shoot && shootCooldown <= 0) {
            this.isShooting = true;
            this.shootAnimFrame = 15; // Animation frames
            shootCooldown = SHOOT_COOLDOWN;
            spawnBullet();
            playShootSound();
        }
        
        // Update shooting animation
        if (this.shootAnimFrame > 0) {
            this.shootAnimFrame--;
            if (this.shootAnimFrame === 0) {
                this.isShooting = false;
            }
        }
        
        // Apply gravity
        this.velocityY += GRAVITY;
        this.y += this.velocityY;
        
        // Ground collision
        if (this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.velocityY = 0;
            this.isJumping = false;
            this.jumpCount = 0; // Reset double jump when landing
        }
    },
    
    draw() {
        ctx.fillStyle = '#535353';
        
        // Draw dinosaur body
        const drawY = this.y - this.height;
        
        // === COWBOY HAT with curled brim and pinched crown ===
        ctx.fillStyle = '#535353';
        
        // Hat crown (top part) - with curved inward top like a real cowboy hat
        ctx.beginPath();
        ctx.moveTo(this.x + 12, drawY - 8);          // Bottom left of crown
        ctx.lineTo(this.x + 12, drawY - 16);         // Left side up
        ctx.quadraticCurveTo(this.x + 14, drawY - 22, this.x + 22, drawY - 18); // Left pinch curve inward
        ctx.quadraticCurveTo(this.x + 30, drawY - 22, this.x + 32, drawY - 16); // Right pinch curve inward
        ctx.lineTo(this.x + 32, drawY - 8);          // Right side down
        ctx.closePath();
        ctx.fill();
        
        // Crown crease detail (the indentation on top)
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(this.x + 16, drawY - 17);
        ctx.quadraticCurveTo(this.x + 22, drawY - 14, this.x + 28, drawY - 17);
        ctx.stroke();
        ctx.fillStyle = '#535353';
        
        // Hat band
        ctx.fillStyle = '#888';
        ctx.fillRect(this.x + 12, drawY - 10, 20, 3);
        ctx.fillStyle = '#535353';
        
        // Hat brim with curled up ends
        ctx.beginPath();
        ctx.moveTo(this.x + 2, drawY - 5);           // Left curl start
        ctx.quadraticCurveTo(this.x + 5, drawY - 12, this.x + 10, drawY - 7);  // Left curl up
        ctx.lineTo(this.x + 34, drawY - 7);          // Flat middle
        ctx.quadraticCurveTo(this.x + 39, drawY - 12, this.x + 42, drawY - 5); // Right curl up
        ctx.lineTo(this.x + 40, drawY - 3);          // Right edge down
        ctx.lineTo(this.x + 4, drawY - 3);           // Bottom of brim
        ctx.lineTo(this.x + 2, drawY - 5);           // Back to start
        ctx.fill();
        
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
        
        // === GUN & SHOOTING ===
        if (this.isShooting || this.shootAnimFrame > 0) {
            this.drawGun(drawY);
        }
    },
    
    drawGun(dinoY) {
        const gunX = this.x + 38;
        const gunY = dinoY + 14;
        
        ctx.fillStyle = '#535353';
        
        // Arm extended forward
        ctx.fillRect(this.x + 25, dinoY + 18, 15, 6);
        
        // === COWBOY REVOLVER ===
        
        // Grip/Handle - curved cowboy style
        ctx.beginPath();
        ctx.moveTo(gunX + 2, gunY + 8);
        ctx.lineTo(gunX + 8, gunY + 8);
        ctx.lineTo(gunX + 10, gunY + 18);
        ctx.quadraticCurveTo(gunX + 6, gunY + 22, gunX - 2, gunY + 20);
        ctx.quadraticCurveTo(gunX - 2, gunY + 14, gunX + 2, gunY + 8);
        ctx.fill();
        
        // Grip detail lines
        ctx.fillStyle = '#888';
        ctx.fillRect(gunX + 2, gunY + 12, 5, 1);
        ctx.fillRect(gunX + 1, gunY + 15, 5, 1);
        
        ctx.fillStyle = '#535353';
        
        // Frame/body of revolver
        ctx.fillRect(gunX, gunY + 2, 14, 7);
        
        // Cylinder (the round part that holds bullets)
        ctx.beginPath();
        ctx.arc(gunX + 8, gunY + 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Cylinder detail - bullet chambers hint
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(gunX + 8, gunY + 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#535353';
        ctx.beginPath();
        ctx.arc(gunX + 8, gunY + 5, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Barrel - long cowboy style
        ctx.fillRect(gunX + 12, gunY + 3, 18, 4);
        
        // Barrel top ridge
        ctx.fillStyle = '#888';
        ctx.fillRect(gunX + 12, gunY + 2, 18, 1);
        ctx.fillStyle = '#535353';
        
        // Front sight
        ctx.fillRect(gunX + 28, gunY, 2, 3);
        
        // Trigger guard
        ctx.beginPath();
        ctx.moveTo(gunX + 4, gunY + 8);
        ctx.quadraticCurveTo(gunX + 4, gunY + 14, gunX + 10, gunY + 12);
        ctx.lineTo(gunX + 10, gunY + 8);
        ctx.stroke();
        
        // Trigger
        ctx.fillRect(gunX + 6, gunY + 9, 2, 4);
        
        // Hammer (cocked back)
        ctx.fillRect(gunX - 2, gunY + 1, 4, 4);
        ctx.fillRect(gunX - 3, gunY - 1, 3, 3);
        
        // Muzzle flash when shooting
        if (this.shootAnimFrame > 12) {
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.moveTo(gunX + 30, gunY + 5);
            ctx.lineTo(gunX + 45, gunY - 2);
            ctx.lineTo(gunX + 40, gunY + 5);
            ctx.lineTo(gunX + 45, gunY + 12);
            ctx.lineTo(gunX + 30, gunY + 5);
            ctx.fill();
            
            // Inner flash
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.moveTo(gunX + 30, gunY + 5);
            ctx.lineTo(gunX + 38, gunY + 1);
            ctx.lineTo(gunX + 36, gunY + 5);
            ctx.lineTo(gunX + 38, gunY + 9);
            ctx.lineTo(gunX + 30, gunY + 5);
            ctx.fill();
        }
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
// BULLETS
// ============================================
function spawnBullet() {
    const bulletY = player.y - player.height + 19; // Gun barrel height
    bullets.push({
        x: player.x + 68, // End of revolver barrel
        y: bulletY,
        width: 10,
        height: 4,
        speed: 22 // Faster bullets!
    });
}

function updateBullets() {
    // Update cooldown
    if (shootCooldown > 0) {
        shootCooldown--;
    }
    
    // Move bullets and check collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].speed;
        
        // Check collision with cacti
        let hitCactus = false;
        for (let j = 0; j < cacti.length; j++) {
            const cactus = cacti[j];
            if (bullets[i].x + bullets[i].width > cactus.x &&
                bullets[i].x < cactus.x + cactus.width &&
                bullets[i].y + bullets[i].height > cactus.y &&
                bullets[i].y < cactus.y + cactus.height) {
                hitCactus = true;
                // Create impact particles
                for (let k = 0; k < 5; k++) {
                    particles.push({
                        x: bullets[i].x + bullets[i].width,
                        y: bullets[i].y + bullets[i].height / 2,
                        vx: -Math.random() * 3 - 1,
                        vy: (Math.random() - 0.5) * 4,
                        life: 20 + Math.random() * 10,
                        size: 2 + Math.random() * 2
                    });
                }
                break;
            }
        }
        
        // Remove bullet if hit cactus or off-screen
        if (hitCactus || bullets[i].x > canvas.width + 20) {
            bullets.splice(i, 1);
        }
    }
}

function drawBullets() {
    bullets.forEach(bullet => {
        // Bullet body - revolver round shape
        ctx.fillStyle = '#535353';
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x + bullet.width - 3, bullet.y);
        ctx.quadraticCurveTo(bullet.x + bullet.width + 2, bullet.y + bullet.height / 2, 
                            bullet.x + bullet.width - 3, bullet.y + bullet.height);
        ctx.lineTo(bullet.x, bullet.y + bullet.height);
        ctx.closePath();
        ctx.fill();
        
        // Bullet casing back
        ctx.fillStyle = '#888';
        ctx.fillRect(bullet.x - 2, bullet.y, 3, bullet.height);
        
        // Smoke trail
        ctx.fillStyle = 'rgba(136, 136, 136, 0.5)';
        ctx.fillRect(bullet.x - 12, bullet.y + 1, 10, 2);
    });
}

// ============================================
// ENEMY DINOS (Bad guys with masks)
// ============================================
const enemies = [];
const enemyBullets = [];
let lastEnemySpawn = 0;
const ENEMY_SPAWN_INTERVAL = 180; // Frames between enemy spawns (3 seconds at 60fps)
let enemyShootCooldown = 0;
const ENEMY_SHOOT_COOLDOWN = 90; // Frames between enemy shots

function spawnEnemy() {
    // Spawn enemy at right edge of screen, walks toward player
    enemies.push({
        x: canvas.width + 50,
        y: GROUND_Y,
        width: 35,
        height: 45,
        direction: -1, // Always facing/walking toward player
        speed: 2,
        canShoot: score >= 100,
        shootTimer: 10 + Math.random() * 15 // Quick first shot!
    });
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Move enemy with game speed (scrolling) plus their own walking speed toward player
        enemy.x -= gameSpeed; // Scroll with world
        enemy.x += enemy.direction * enemy.speed; // Walk toward player
        
        // Timer always counts down, but only shoot when in back 2/3 of screen
        if (score >= 100) {
            enemy.shootTimer--;
            if (enemy.shootTimer <= 0 && enemy.x > canvas.width / 3) {
                spawnEnemyBullet(enemy);
                enemy.shootTimer = 25 + Math.random() * 20; // Reload faster
            } else if (enemy.shootTimer <= 0) {
                enemy.shootTimer = 5; // Keep trying if past shooting zone
            }
        }
        
        // Remove if off screen (left side)
        if (enemy.x < -50) {
            enemies.splice(i, 1);
        }
    }
}

function spawnEnemyBullet(enemy) {
    enemyBullets.push({
        x: enemy.x - 10,
        y: enemy.y - enemy.height + 20,
        width: 10,
        height: 4,
        speed: 14 // Faster bullets!
    });
    playShootSound();
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        enemyBullets[i].x -= enemyBullets[i].speed;
        
        // Check collision with cacti
        let hitCactus = false;
        for (let j = 0; j < cacti.length; j++) {
            const cactus = cacti[j];
            if (enemyBullets[i].x < cactus.x + cactus.width &&
                enemyBullets[i].x + enemyBullets[i].width > cactus.x &&
                enemyBullets[i].y + enemyBullets[i].height > cactus.y &&
                enemyBullets[i].y < cactus.y + cactus.height) {
                hitCactus = true;
                // Impact particles
                for (let k = 0; k < 4; k++) {
                    particles.push({
                        x: enemyBullets[i].x,
                        y: enemyBullets[i].y + enemyBullets[i].height / 2,
                        vx: Math.random() * 3 + 1,
                        vy: (Math.random() - 0.5) * 4,
                        life: 15 + Math.random() * 10,
                        size: 2 + Math.random() * 2
                    });
                }
                break;
            }
        }
        
        // Remove if hit cactus or off screen
        if (hitCactus || enemyBullets[i].x < -20) {
            enemyBullets.splice(i, 1);
        }
    }
}

function drawEnemies() {
    enemies.forEach(enemy => {
        const drawY = enemy.y - enemy.height;
        const facingLeft = enemy.direction === -1;
        
        ctx.fillStyle = '#535353';
        
        // === RAPTOR BANDIT ===
        
        // Hunched body (raptor posture)
        ctx.beginPath();
        if (facingLeft) {
            ctx.moveTo(enemy.x + 25, drawY + 15);
            ctx.lineTo(enemy.x + 5, drawY + 10);
            ctx.lineTo(enemy.x, drawY + 25);
            ctx.lineTo(enemy.x + 5, drawY + 40);
            ctx.lineTo(enemy.x + 25, drawY + 40);
            ctx.lineTo(enemy.x + 28, drawY + 25);
        } else {
            ctx.moveTo(enemy.x, drawY + 15);
            ctx.lineTo(enemy.x + 20, drawY + 10);
            ctx.lineTo(enemy.x + 25, drawY + 25);
            ctx.lineTo(enemy.x + 20, drawY + 40);
            ctx.lineTo(enemy.x, drawY + 40);
            ctx.lineTo(enemy.x - 3, drawY + 25);
        }
        ctx.closePath();
        ctx.fill();
        
        // Long raptor snout/head
        ctx.beginPath();
        if (facingLeft) {
            // Head angled forward
            ctx.moveTo(enemy.x + 5, drawY + 8);
            ctx.lineTo(enemy.x - 18, drawY + 5);   // Long snout tip
            ctx.lineTo(enemy.x - 20, drawY + 12);  // Bottom of snout
            ctx.lineTo(enemy.x - 5, drawY + 18);   // Jaw
            ctx.lineTo(enemy.x + 8, drawY + 18);
            ctx.lineTo(enemy.x + 10, drawY + 8);
        } else {
            ctx.moveTo(enemy.x + 20, drawY + 8);
            ctx.lineTo(enemy.x + 43, drawY + 5);
            ctx.lineTo(enemy.x + 45, drawY + 12);
            ctx.lineTo(enemy.x + 30, drawY + 18);
            ctx.lineTo(enemy.x + 17, drawY + 18);
            ctx.lineTo(enemy.x + 15, drawY + 8);
        }
        ctx.closePath();
        ctx.fill();
        
        // Raptor teeth (jagged line on jaw)
        ctx.fillStyle = '#888';
        if (facingLeft) {
            for (let t = 0; t < 4; t++) {
                ctx.fillRect(enemy.x - 15 + t * 5, drawY + 12, 2, 3);
            }
        } else {
            for (let t = 0; t < 4; t++) {
                ctx.fillRect(enemy.x + 28 + t * 5, drawY + 12, 2, 3);
            }
        }
        
        // === BANDIT MASK across raptor eyes ===
        ctx.fillStyle = '#222';
        if (facingLeft) {
            ctx.fillRect(enemy.x - 8, drawY + 4, 20, 6);
        } else {
            ctx.fillRect(enemy.x + 13, drawY + 4, 20, 6);
        }
        
        // Menacing eye in mask
        ctx.fillStyle = '#fff';
        if (facingLeft) {
            ctx.fillRect(enemy.x + 2, drawY + 5, 4, 4);
        } else {
            ctx.fillRect(enemy.x + 19, drawY + 5, 4, 4);
        }
        
        ctx.fillStyle = '#535353';
        
        // Raptor arms (small, bent forward)
        if (facingLeft) {
            ctx.fillRect(enemy.x - 2, drawY + 18, 8, 4);
            ctx.fillRect(enemy.x - 5, drawY + 20, 5, 3);
            // Claw
            ctx.fillRect(enemy.x - 7, drawY + 21, 3, 4);
        } else {
            ctx.fillRect(enemy.x + 19, drawY + 18, 8, 4);
            ctx.fillRect(enemy.x + 25, drawY + 20, 5, 3);
            ctx.fillRect(enemy.x + 29, drawY + 21, 3, 4);
        }
        
        // Raptor legs (bent, powerful)
        const legOffset = Math.sin(frameCount * 0.25) * 3;
        // Thigh
        ctx.fillRect(enemy.x + 8, drawY + 35, 8, 6);
        // Lower leg (angled back)
        ctx.fillRect(enemy.x + 6, drawY + 39, 5, 8 + legOffset);
        ctx.fillRect(enemy.x + 16, drawY + 39, 5, 8 - legOffset);
        // Raptor sickle claw
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.x + 4, drawY + 44 + legOffset, 3, 4);
        ctx.fillRect(enemy.x + 18, drawY + 44 - legOffset, 3, 4);
        
        ctx.fillStyle = '#535353';
        
        // Long stiff tail (for balance)
        ctx.beginPath();
        if (facingLeft) {
            ctx.moveTo(enemy.x + 25, drawY + 20);
            ctx.lineTo(enemy.x + 50, drawY + 15);
            ctx.lineTo(enemy.x + 50, drawY + 22);
            ctx.lineTo(enemy.x + 25, drawY + 28);
        } else {
            ctx.moveTo(enemy.x, drawY + 20);
            ctx.lineTo(enemy.x - 25, drawY + 15);
            ctx.lineTo(enemy.x - 25, drawY + 22);
            ctx.lineTo(enemy.x, drawY + 28);
        }
        ctx.closePath();
        ctx.fill();
        
        // Gun (when facing player and can shoot)
        if (score >= 100 && facingLeft) {
            ctx.fillStyle = '#333';
            // Gun in claw
            ctx.fillRect(enemy.x - 18, drawY + 18, 12, 5);
            ctx.fillRect(enemy.x - 24, drawY + 19, 8, 3);
        }
    });
}

function drawEnemyBullets() {
    enemyBullets.forEach(bullet => {
        // Bullet body
        ctx.fillStyle = '#535353';
        ctx.beginPath();
        ctx.moveTo(bullet.x + bullet.width, bullet.y);
        ctx.lineTo(bullet.x + 3, bullet.y);
        ctx.quadraticCurveTo(bullet.x - 2, bullet.y + bullet.height / 2, 
                            bullet.x + 3, bullet.y + bullet.height);
        ctx.lineTo(bullet.x + bullet.width, bullet.y + bullet.height);
        ctx.closePath();
        ctx.fill();
        
        // Trail
        ctx.fillStyle = 'rgba(136, 136, 136, 0.5)';
        ctx.fillRect(bullet.x + bullet.width, bullet.y + 1, 10, 2);
    });
}

// Check if player bullet hits enemy
function checkBulletEnemyCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            const bullet = bullets[i];
            const enemy = enemies[j];
            const enemyHitbox = {
                x: enemy.x,
                y: enemy.y - enemy.height,
                width: enemy.width,
                height: enemy.height
            };
            
            if (bullet.x + bullet.width > enemyHitbox.x &&
                bullet.x < enemyHitbox.x + enemyHitbox.width &&
                bullet.y + bullet.height > enemyHitbox.y &&
                bullet.y < enemyHitbox.y + enemyHitbox.height) {
                
                // Enemy hit! Remove both
                bullets.splice(i, 1);
                enemies.splice(j, 1);
                
                // Combo system!
                killCombo++;
                comboTimer = COMBO_TIMEOUT;
                
                // Bonus with combo multiplier
                const basePoints = 5;
                const comboMultiplier = Math.min(killCombo, 5); // Max 5x
                const points = basePoints * comboMultiplier;
                score += points;
                
                // Show combo text
                if (killCombo > 1) {
                    createBonusText(enemy.x, enemy.y - enemy.height - 25, `${killCombo}x COMBO!`, '#333');
                }
                createBonusText(enemy.x, enemy.y - enemy.height - 10, `BANDIT! +${points}`, '#333');
                playComboKillSound(killCombo); // Pitch ramps with combo!
                
                // Death particles (more for combos!)
                const particleCount = 10 + killCombo * 2;
                for (let k = 0; k < particleCount; k++) {
                    particles.push({
                        x: enemy.x + enemy.width / 2,
                        y: enemy.y - enemy.height / 2,
                        vx: (Math.random() - 0.5) * 6,
                        vy: (Math.random() - 0.5) * 6,
                        life: 25 + Math.random() * 15,
                        size: 3 + Math.random() * 3
                    });
                }
                
                break;
            }
        }
    }
}

// Check if enemy bullet hits player
function checkEnemyBulletPlayerCollision() {
    const playerHitbox = player.getHitbox();
    
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        if (bullet.x + bullet.width > playerHitbox.x &&
            bullet.x < playerHitbox.x + playerHitbox.width &&
            bullet.y + bullet.height > playerHitbox.y &&
            bullet.y < playerHitbox.y + playerHitbox.height) {
            return true; // Player hit!
        }
    }
    return false;
}

// Check if player runs into an enemy (not stomping, just collision)
function checkPlayerEnemyCollision() {
    const playerHitbox = player.getHitbox();
    
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const enemyHitbox = {
            x: enemy.x,
            y: enemy.y - enemy.height,
            width: enemy.width,
            height: enemy.height
        };
        
        // Check collision
        if (playerHitbox.x + playerHitbox.width > enemyHitbox.x &&
            playerHitbox.x < enemyHitbox.x + enemyHitbox.width &&
            playerHitbox.y + playerHitbox.height > enemyHitbox.y &&
            playerHitbox.y < enemyHitbox.y + enemyHitbox.height) {
            
            // Only die if not stomping (stomping = falling from above)
            const playerBottom = playerHitbox.y + playerHitbox.height;
            const enemyTop = enemyHitbox.y;
            const isStomping = player.velocityY > 0 && playerBottom <= enemyTop + (enemy.height * 0.7);
            
            if (!isStomping) {
                return true; // Player hit by enemy!
            }
        }
    }
    return false;
}

// Track bullets checked for near miss
const passedBullets = new Set();
let bulletIdCounter = 0;

// Check for near miss with enemy bullets (dodge bonus!)
function checkBulletNearMiss() {
    const playerHitbox = player.getHitbox();
    
    for (let i = 0; i < enemyBullets.length; i++) {
        const bullet = enemyBullets[i];
        
        // Give bullets an ID if they don't have one
        if (bullet.id === undefined) {
            bullet.id = bulletIdCounter++;
        }
        
        // Skip if already gave bonus for this bullet
        if (passedBullets.has(bullet.id)) continue;
        
        // Check if bullet just passed the player (within 20px vertically, bullet is behind player)
        const bulletPastPlayer = bullet.x + bullet.width < playerHitbox.x;
        const verticallyClose = Math.abs((bullet.y + bullet.height/2) - (playerHitbox.y + playerHitbox.height/2)) < 30;
        
        if (bulletPastPlayer && verticallyClose) {
            passedBullets.add(bullet.id);
            score += 15;
            createBonusText(player.x, playerHitbox.y - 10, 'DODGE! +15', '#333');
            playBonusSound();
            triggerCloseCallEffect(); // Screen flash!
        }
    }
    
    // Clean up old bullet IDs
    if (passedBullets.size > 50) {
        passedBullets.clear();
    }
}

// Check if player stomps on enemy (landing on any part while falling)
function checkStompKill() {
    if (!player.isJumping || player.velocityY <= 0) return; // Only when falling down
    
    const playerHitbox = player.getHitbox();
    const playerBottom = playerHitbox.y + playerHitbox.height;
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const enemyTop = enemy.y - enemy.height;
        const enemyBottom = enemy.y;
        const enemyLeft = enemy.x - 10; // Wider hitbox for stomp
        const enemyRight = enemy.x + enemy.width + 10;
        
        // Check if player overlaps horizontally and is landing on enemy
        const horizontalOverlap = playerHitbox.x + playerHitbox.width > enemyLeft && 
                                  playerHitbox.x < enemyRight;
        // Landing anywhere on the enemy body (from head to mid-body)
        const landingOnEnemy = playerBottom >= enemyTop && 
                               playerBottom <= enemyTop + (enemy.height * 0.7); // Top 70% of body
        
        if (horizontalOverlap && landingOnEnemy) {
            // Stomp kill!
            enemies.splice(i, 1);
            
            // Bounce player up
            player.velocityY = -10;
            
            // Combo system!
            killCombo++;
            comboTimer = COMBO_TIMEOUT;
            
            // Bonus with combo multiplier
            const basePoints = 5;
            const comboMultiplier = Math.min(killCombo, 5); // Max 5x
            const points = basePoints * comboMultiplier;
            score += points;
            
            // Show combo text
            if (killCombo > 1) {
                createBonusText(enemy.x, enemyTop - 25, `${killCombo}x COMBO!`, '#333');
            }
            createBonusText(enemy.x, enemyTop - 10, `STOMP! +${points}`, '#333');
            playComboKillSound(killCombo); // Pitch ramps with combo!
            
            // Death particles (more for combos!)
            const particleCount = 10 + killCombo * 2;
            for (let k = 0; k < particleCount; k++) {
                particles.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y - enemy.height / 2,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: 25 + Math.random() * 15,
                    size: 3 + Math.random() * 3
                });
            }
        }
    }
}

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
    // Always draw cacti (western theme)
    cacti.forEach(obstacle => {
        drawCactus(obstacle);
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

// ============================================
// BACKGROUND ELEMENTS
// ============================================
const clouds = [];
const groundLines = [];

// Era landmarks - volcano rises after level 2
const LANDMARK_X = 700;

// Volcano (Level 2+)
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

function drawLandmarks() {
    // Only volcano in the background (western desert theme)
    drawVolcano();
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
            
            // If player is directly above cactus with small clearance (within 40 pixels - more forgiving!)
            if (horizontalOverlap && playerBottom < cactusTop && cactusTop - playerBottom < 40) {
                passedCacti.add(cactus.id);
                score += 25;
                createBonusText(cactus.x + cactus.width / 2, cactus.y - 20, 'CLOSE! +25', '#333');
                playBonusSound();
                triggerCloseCallEffect(); // Screen flash!
            }
        }
        
        // Clean up passed cacti tracking when cactus goes off screen
        if (cactus.x + cactus.width < 0) {
            passedCacti.delete(cactus.id);
        }
    }
    
    return false;
}

// ============================================
// VISUAL EFFECTS
// ============================================
const particles = [];

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

// Close call screen flash and mini shake
let closeCallFlash = 0;

function triggerCloseCallEffect() {
    closeCallFlash = 8; // Frames of flash
    // Mini shake
    gameContainer.classList.add('mini-shake');
    setTimeout(() => gameContainer.classList.remove('mini-shake'), 100);
}

function drawCloseCallFlash() {
    if (closeCallFlash > 0) {
        const alpha = closeCallFlash / 8 * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        closeCallFlash--;
    }
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
    // Level 1: Normal desert, Level 2+: Volcano rises
    let newEra = 'normal';
    if (currentLevel >= 2) {
        newEra = 'volcano';
    }
    
    if (newEra !== currentEra) {
        currentEra = newEra;
        
        // Volcano rises after level 2 and stays up
        volcano.targetHeight = (currentLevel >= 2) ? volcano.height : 0;
    }
}

// ============================================
// SPAWN MANAGEMENT
// ============================================
let lastCactusSpawn = 0;

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
    
    // Spawn enemy bandits after score hits 100
    if (score >= 100 && frameCount - lastEnemySpawn > ENEMY_SPAWN_INTERVAL) {
        // 60% chance to spawn enemy, max 3 on screen
        if (Math.random() < 0.6 && enemies.length < 3) {
            spawnEnemy();
        }
        lastEnemySpawn = frameCount;
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
        updateBullets();
        updateEnemies();
        updateEnemyBullets();
        updateCacti();
        updateBackground();
        updateParticles();
        updateBonusTexts();
        manageSpawns();
        
        // Check bullet-enemy collisions
        checkBulletEnemyCollisions();
        
        // Check for stomp kills (landing on enemy heads)
        checkStompKill();
        
        // Check for bullet dodge bonus
        checkBulletNearMiss();
        
        // Update combo timer
        if (comboTimer > 0) {
            comboTimer--;
            if (comboTimer === 0) {
                killCombo = 0; // Reset combo when timer expires
            }
        }
        
        // Check for collisions (player vs cactus/enemy bullets/enemies)
        if (checkCollisions() || checkEnemyBulletPlayerCollision() || checkPlayerEnemyCollision()) {
            gameOver();
        }
        
        // Update score every 5 frames
        if (frameCount % 5 === 0) {
            updateScore();
        }
    }
    
    // Draw everything
    drawBackground();
    drawCacti();
    drawEnemies();
    drawBullets();
    drawEnemyBullets();
    player.draw();
    drawParticles();
    drawBonusTexts();
    drawLevelUpAnimation();
    drawCloseCallFlash(); // Screen flash on close calls
    
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
    gameState = 'playing';
    score = 0;
    gameSpeed = BASE_SPEED;
    frameCount = 0;
    lastCactusSpawn = 0;
    currentEra = 'normal';
    currentLevel = 1;
    freePlayMode = false;
    levelUpAnimation = 0;
    
    // Clear obstacles and enemies
    cacti.length = 0;
    bullets.length = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    particles.length = 0;
    bonusTexts.length = 0;
    passedCacti.clear();
    passedBullets.clear();
    cactusIdCounter = 0;
    shootCooldown = 0;
    lastEnemySpawn = 0;
    killCombo = 0;
    comboTimer = 0;
    
    // Reset volcano
    volcano.eruptionParticles.length = 0;
    volcano.currentHeight = 0;
    volcano.targetHeight = 0;
    volcano.lavaGlow = 0;
    
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
    
    // Reset name entry form
    const nameEntry = document.getElementById('name-entry');
    const savedName = localStorage.getItem('dinoDrawwPlayerName') || '';
    if (nameEntry) {
        nameEntry.innerHTML = `
            <p>Enter your initials:</p>
            <div class="name-input-container">
                <input type="text" id="name-input" class="name-input" maxlength="3" placeholder="AAA" autocomplete="off" autocapitalize="characters" value="${savedName}">
            </div>
            <button id="btn-submit-score" class="btn-play btn-submit">SUBMIT</button>
        `;
        // Re-attach submit handler
        const submitBtn = document.getElementById('btn-submit-score');
        const nameInput = document.getElementById('name-input');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim();
                if (name.length < 1) {
                    nameInput.focus();
                    return;
                }
                localStorage.setItem('dinoDrawwPlayerName', name);
                submitBtn.disabled = true;
                submitBtn.textContent = '...';
                await submitScore(name, score, false);
                nameEntry.innerHTML = `<p class="submitted-msg">Submitted as ${name.toUpperCase()}</p>`;
                displayLeaderboard('leaderboard-list', 'today', score, name);
            });
        }
    }
    
    // Reset tabs to "today"
    const tabToday = document.getElementById('tab-today');
    const tabAlltime = document.getElementById('tab-alltime');
    if (tabToday) tabToday.classList.add('active');
    if (tabAlltime) tabAlltime.classList.remove('active');
    
    // Load leaderboard
    displayLeaderboard('leaderboard-list', 'today');
    
    // Show rank
    getPlayerRank(score, 'today').then(rank => {
        const rankDisplay = document.getElementById('rank-display');
        if (rankDisplay && rank) {
            rankDisplay.textContent = `Today's Rank: #${rank}`;
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
    
    // Reset name entry form
    const victoryNameEntry = document.getElementById('victory-name-entry');
    const savedName = localStorage.getItem('dinoDrawwPlayerName') || '';
    if (victoryNameEntry) {
        victoryNameEntry.innerHTML = `
            <p>Enter your initials:</p>
            <div class="name-input-container">
                <input type="text" id="victory-name-input" class="name-input" maxlength="3" placeholder="AAA" autocomplete="off" autocapitalize="characters" value="${savedName}">
            </div>
            <button id="btn-victory-submit" class="btn-play btn-submit">SUBMIT</button>
        `;
        // Re-attach submit handler
        const victorySubmitBtn = document.getElementById('btn-victory-submit');
        const victoryNameInput = document.getElementById('victory-name-input');
        if (victorySubmitBtn) {
            victorySubmitBtn.addEventListener('click', async () => {
                const name = victoryNameInput.value.trim();
                if (name.length < 1) {
                    victoryNameInput.focus();
                    return;
                }
                localStorage.setItem('dinoDrawwPlayerName', name);
                victorySubmitBtn.disabled = true;
                victorySubmitBtn.textContent = '...';
                await submitScore(name, score, true);
                victoryNameEntry.innerHTML = `<p class="submitted-msg">Submitted as ${name.toUpperCase()}</p>`;
                displayLeaderboard('victory-leaderboard-list', 'today', score, name);
            });
        }
    }
    
    // Reset tabs to "today"
    const victoryTabToday = document.getElementById('victory-tab-today');
    const victoryTabAlltime = document.getElementById('victory-tab-alltime');
    if (victoryTabToday) victoryTabToday.classList.add('active');
    if (victoryTabAlltime) victoryTabAlltime.classList.remove('active');
    
    // Load leaderboard
    displayLeaderboard('victory-leaderboard-list', 'today');
    
    // Show rank
    getPlayerRank(score, 'today').then(rank => {
        const victoryRankDisplay = document.getElementById('victory-rank-display');
        if (victoryRankDisplay && rank) {
            victoryRankDisplay.textContent = `Today's Rank: #${rank}`;
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
    
    // D key to play again from game over
    if (e.code === 'KeyD') {
        if (gameState === 'gameover') {
            restartGame();
        }
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
    
    // Shoot key: S
    if (e.code === 'KeyS') {
        keys.shoot = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'KeyJ') {
        keys.jump = false;
    }
    if (e.code === 'KeyS') {
        keys.shoot = false;
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
    
    // Start game loop
    gameLoop();
}

// ============================================
// MOBILE TOUCH CONTROLS
// ============================================
function initTouchControls() {
    const btnJump = document.getElementById('btn-jump');
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
    
    if (!btnJump) return;
    
    // JUMP button - tap to jump (same as Space/J)
    btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.jump = true;
        initAudio();
        
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
    
    // SHOOT button - tap to shoot (same as O key)
    const btnShoot = document.getElementById('btn-shoot');
    if (btnShoot) {
        btnShoot.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys.shoot = true;
            initAudio();
        }, { passive: false });
        
        btnShoot.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys.shoot = false;
        }, { passive: false });
        
        btnShoot.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            keys.shoot = false;
        }, { passive: false });
    }
    
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
initLeaderboard();
